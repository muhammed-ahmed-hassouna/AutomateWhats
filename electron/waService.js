const { create, decryptMedia } = require("@open-wa/wa-automate");
const path = require("path");
const fs = require("fs");
const ArabicReshaper = require("arabic-reshaper");
const { EventEmitter } = require("events");

const emitter = new EventEmitter();

let client;

function reshaper(text) {
  if (!text) return "";
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  if (!hasArabic) return text;
  const connected = ArabicReshaper.convertArabic(text);
  return connected.split("").reverse().join("");
}

async function init() {
  client = await create({
    sessionId: "MY_SESSION",
    multiDevice: true,
    headless: true,
  });

  // forward incoming messages via emitter
  client.onMessage((message) => {
    try {
      const payload = {
        id: message.id,
        from: message.from || message.chatId || null,
        chatId: message.chatId || null,
        body: message.body || null,
        mimetype: message.mimetype || null,
        t: message.t || Date.now(),
      };
      emitter.emit("new-message", payload);
    } catch (e) {
      // ignore
    }
  });
}

async function getChats() {
  if (!client) throw new Error("WA client not ready");
  const chats = await client.getAllChats();
  // map to lightweight data
  return chats.map((c) => ({
    id: c.id,
    name: c.contact?.formattedName || c.contact?.pushname || c.id,
    t: c.t,
  }));
}

async function getMessages(chatId) {
  if (!client) throw new Error("WA client not ready");
  const messages = await client.getAllMessagesInChat(chatId, true, false);
  const out = [];
  for (const m of messages) {
    const obj = {
      id: m.id,
      t: m.t,
      mimetype: m.mimetype,
      filename: m.filename || null,
      body: m.body || null,
      from: m.from || m.sender || null,
      mediaUrl: null,
    };

    // For images, attempt to decrypt and include inline data URL for preview
    try {
      if (m.mimetype && m.mimetype.includes("image")) {
        const buf = await decryptMedia(m);
        const base64 = buf.toString("base64");
        obj.mediaUrl = `data:${m.mimetype};base64,${base64}`;
      }
    } catch (e) {
      // ignore decryption/preview errors
    }

    out.push(obj);
  }

  return out;
}

async function downloadMedia(chatId, type, progressCb) {
  if (!client) throw new Error("WA client not ready");
  const messages = await client.getAllMessagesInChat(chatId, true, false);
  const mediaMessages = messages.filter(
    (m) =>
      m.mimetype &&
      ((type === "image" && m.mimetype.includes("image")) ||
        (type === "pdf" && m.mimetype.includes("pdf")) ||
        (type === "office" &&
          (m.mimetype.includes("word") ||
            m.mimetype.includes("excel") ||
            m.mimetype.includes("presentation") ||
            m.mimetype.includes("officedocument"))))
  );

  const safeName = chatId.replace(/[^a-zA-Z0-9]/g, "_");
  const downloadDir = path.join(__dirname, "..", "downloads", safeName, type);
  if (!fs.existsSync(downloadDir))
    fs.mkdirSync(downloadDir, { recursive: true });

  let count = 0;
  for (const msg of mediaMessages) {
    try {
      const buffer = await decryptMedia(msg);
      let ext = (msg.mimetype || "").split("/")[1] || "bin";
      if (msg.mimetype && msg.mimetype.includes("word")) ext = "docx";
      if (
        msg.mimetype &&
        (msg.mimetype.includes("sheet") || msg.mimetype.includes("excel"))
      )
        ext = "xlsx";
      if (msg.mimetype && msg.mimetype.includes("presentation")) ext = "pptx";

      const filename = path.join(downloadDir, `${msg.t}_${msg.id}.${ext}`);
      fs.writeFileSync(filename, buffer);
      count++;
      if (progressCb)
        progressCb({
          total: mediaMessages.length,
          completed: count,
          lastFile: filename,
        });
    } catch (e) {
      // ignore
    }
  }

  return { total: mediaMessages.length, saved: count, folder: downloadDir };
}


module.exports = {
  init,
  getChats,
  getMessages,
  downloadMedia,
  reshaper,
  emitter,
};
