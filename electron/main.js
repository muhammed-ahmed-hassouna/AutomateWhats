const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const isDev =
  process.env.NODE_ENV === "development" || process.argv.includes("--dev");
const waService = require("./waService");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    const prodIndex = path.join(__dirname, "..", "dist", "index.html");
    const fallbackIndex = path.join(__dirname, "..", "index.html");
    if (fs.existsSync(prodIndex)) {
      win.loadFile(prodIndex);
    } else if (fs.existsSync(fallbackIndex)) {
      win.loadFile(fallbackIndex);
    } else {
      win.loadURL("about:blank");
      console.error(
        "Renderer not found: run `npm run dev` for development or `npm run build:renderer` before `npm start`."
      );
    }
  }

  // Debugging helpers: surface renderer errors to main process logs
  win.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error("Renderer failed to load", {
        errorCode,
        errorDescription,
        validatedURL,
      });
    }
  );

  win.webContents.on("console-message", (e, level, message, line, sourceId) => {
    console.log(
      `Renderer console [${level}] ${message} (source: ${sourceId}:${line})`
    );
  });

  win.webContents.on("crashed", () => {
    console.error("Renderer process crashed");
  });

  win.webContents.on("render-process-gone", (event, details) => {
    console.error("Renderer process gone", details);
  });
}

app.whenReady().then(async () => {
  await waService.init();
  createWindow();

  // forward WA service new-message events to renderer
  waService.emitter.on("new-message", (payload) => {
    const wins = BrowserWindow.getAllWindows();
    for (const w of wins) {
      try {
        w.webContents.send("wa:newMessage", payload);
      } catch (e) {
        // ignore
      }
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// IPC handlers
ipcMain.handle("wa:getChats", async () => {
  return waService.getChats();
});

ipcMain.handle("wa:getMessages", async (event, chatId) => {
  return waService.getMessages(chatId);
});

ipcMain.handle("wa:downloadMedia", async (event, chatId, type) => {
  try {
    const result = await waService.downloadMedia(chatId, type, (progress) => {
      event.sender.send("wa:progress", progress);
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("wa:openFolder", async (event, folderPath) => {
  try {
    await require("electron").shell.openPath(folderPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("wa:downloadMessage", async (event, chatId, messageId) => {
  try {
    // Get the specific message
    const messages = await waService.getMessages(chatId);
    const message = messages.find(m => m.id === messageId);
    
    if (!message || !message.mimetype) {
      return { ok: false, error: "Message not found or has no media" };
    }
    
    // Download single file
    const safeName = chatId.replace(/[^a-zA-Z0-9]/g, "_");
    const downloadDir = path.join(__dirname, "..", "downloads", safeName, "individual");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    const buffer = await require("@open-wa/wa-automate").decryptMedia(message);
    let ext = (message.mimetype || "").split("/")[1] || "bin";
    const filename = path.join(downloadDir, `${message.filename || message.id}.${ext}`);
    fs.writeFileSync(filename, buffer);
    
    return { ok: true, result: { folder: downloadDir } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});