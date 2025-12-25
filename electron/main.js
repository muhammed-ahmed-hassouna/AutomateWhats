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

// ipcMain.handle("wa:downloadMedia", async (event, chatId, type) => {
//   try {
//     const result = await waService.downloadMedia(chatId, type, (progress) => {
//       event.sender.send("wa:progress", progress);
//     });
//     return { ok: true, result };
//   } catch (e) {
//     return { ok: false, error: String(e) };
//   }
// });

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
    // Get the raw full message (contains mediaKey/filehash/etc.)
    const rawMessage = await waService.getRawMessage(chatId, messageId);

    if (!rawMessage || !rawMessage.mimetype) {
      return { ok: false, error: "Message not found or has no media" };
    }

    // Download single file
    const safeName = chatId.replace(/[^a-zA-Z0-9]/g, "_");
    const downloadDir = path.join(__dirname, "..", "downloads", safeName, "individual");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const buffer = await require("@open-wa/wa-automate").decryptMedia(rawMessage);
    let ext = (rawMessage.mimetype || "").split("/")[1] || "bin";
    const filename = path.join(downloadDir, `${rawMessage.filename || rawMessage.id}.${ext}`);
    fs.writeFileSync(filename, buffer);

    return { ok: true, result: { folder: downloadDir } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
// Add these handlers to your existing main.js

// Get list of available printers
ipcMain.handle("print:getPrinters", async () => {
  try {
    const { getPrinters } = require("pdf-to-printer");
    const printers = await getPrinters();
    const defaultPrinter = printers.find(p => p.default)?.name || printers[0]?.name || "";
    return { 
      ok: true, 
      printers: printers.map(p => p.name),
      default: defaultPrinter
    };
  } catch (e) {
    return { ok: false, error: String(e), printers: [], default: "" };
  }
});

// Updated downloadMedia to return file list
ipcMain.handle("wa:downloadMedia", async (event, chatId, type) => {
  try {
    const result = await waService.downloadMedia(chatId, type, (progress) => {
      event.sender.send("wa:progress", progress);
    });
    
    // Get list of downloaded files
    const files = [];
    if (result.folder && fs.existsSync(result.folder)) {
      const fileList = fs.readdirSync(result.folder);
      for (const filename of fileList) {
        const fullPath = path.join(result.folder, filename);
        const stats = fs.statSync(fullPath);
        files.push({
          path: fullPath,
          filename: filename,
          size: formatFileSize(stats.size)
        });
      }
    }
    
    return { 
      ok: true, 
      result: {
        ...result,
        files: files
      }
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// Updated print handler with N-up support
ipcMain.handle("print:printPdfs", async (event, jobs) => {
  try {
    const { print } = require("pdf-to-printer");
    
    for (const job of jobs) {
      const filePath = job.path;
      const opts = job.options || {};

      const printOpts = {};
      
      // Printer selection
      if (opts.printer) printOpts.printer = opts.printer;
      
      // Duplex
      if (opts.duplex && opts.duplex !== "none") {
        printOpts.duplex = opts.duplex;
      }
      
      // Color
      if (opts.color === false) {
        printOpts.monochrome = true;
      }
      
      // Copies
      if (opts.copies && opts.copies > 1) {
        printOpts.copies = opts.copies;
      }
      
      // N-up (pages per sheet)
      if (opts.nup && opts.nup !== "1") {
        printOpts.pagesPerSheet = parseInt(opts.nup);
      }
      
      await print(filePath, printOpts);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}