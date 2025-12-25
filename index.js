const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { create, decryptMedia } = require("@open-wa/wa-automate");

// CLI UI Libraries
const inquirer = require("inquirer");
const chalk = require("chalk");
const ora = require("ora");
const figlet = require("figlet");
const boxen = require("boxen");
const ArabicReshaper = require("arabic-reshaper");

// 👇 FIXED HELPER: Only reshape/reverse if text contains Arabic
function reshaper(text) {
  if (!text) return "";

  // Regex to check if the string contains any Arabic characters
  const hasArabic = /[\u0600-\u06FF]/.test(text);

  if (!hasArabic) {
    return text; // Return English/Numbers/Symbols exactly as is
  }

  // 1. Connect the Arabic letters
  const connected = ArabicReshaper.convertArabic(text); 
  // 2. Reverse for visual display in LTR terminals
  return connected.split("").reverse().join("");
}

const app = express();
app.use(express.json());
app.use(cors());

let client;
let isCliActive = false;

// ---------------- SERVER & CLIENT SETUP ---------------- //

create({
  sessionId: "MY_SESSION",
  multiDevice: true,
  headless: true,
}).then(async (waClient) => {
  client = waClient;
  
  console.clear();
  console.log(chalk.green(figlet.textSync('WhatsApp CLI', { horizontalLayout: 'full' })));
  console.log(boxen(chalk.cyan(reshaper('🤖 تم الاتصال بنجاح! السيرفر يعمل الآن.')), { padding: 1, borderStyle: 'round' }));

  startArabicCLI();

  client.onMessage(async (message) => {
    if (!isCliActive && message.mimetype) {
       // Automatic processing here
    }
  });
});

// ---------------- ARABIC CLI LOGIC ---------------- //

async function startArabicCLI() {
  isCliActive = true;
  const chats = await client.getAllChats();
  
  // Sort by time
  const sortedChats = chats.sort((a, b) => b.t - a.t);
  
  showChatList(sortedChats, 0);
}

async function showChatList(chats, pageIndex) {
  console.clear();
  console.log(chalk.yellow.bold(reshaper(`📋 قائمة المحادثات - صفحة`) + ` ${pageIndex + 1}\n`));

  const pageSize = 10;
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  
  const currentChats = chats.slice(start, end);
  
  const choices = currentChats.map((chat) => {
    const name = chat.contact.formattedName || chat.contact.pushname || chat.id;
    const date = new Date(chat.t * 1000).toLocaleDateString('ar-EG');
    
    // Reshape name only if it's Arabic. Numbers/English names will stay correct.
    return {
        name: `${chalk.green(reshaper(name))} ${chalk.gray("(" + date + ")")}`,
        value: chat.id
    };
  });

  // 👇 FIXED: English text is concatenated OUTSIDE the reshaper function
  if (end < chats.length) {
    choices.push(new inquirer.Separator());
    choices.push({ name: chalk.blue(reshaper("➡️  التالي") + " (Next 10)"), value: "NEXT" });
  }
  if (pageIndex > 0) {
    choices.push({ name: chalk.blue(reshaper("⬅️  السابق") + " (Previous 10)"), value: "PREV" });
  }
  
  choices.push(new inquirer.Separator());
  choices.push({ name: chalk.red(reshaper("❌ خروج") + " (Exit)"), value: "EXIT" });

  const { selectedChatId } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedChatId",
      message: reshaper("اختر رقمًا لعرض الخيارات:"),
      choices: choices,
      pageSize: 15
    },
  ]);

  if (selectedChatId === "NEXT") return showChatList(chats, pageIndex + 1);
  if (selectedChatId === "PREV") return showChatList(chats, pageIndex - 1);
  if (selectedChatId === "EXIT") {
    console.log(chalk.gray(reshaper("إغلاق القائمة...")));
    isCliActive = false;
    return;
  }

  const chatName = chats.find(c => c.id === selectedChatId).contact.formattedName;
  await showDownloadMenu(selectedChatId, chatName);
}

async function showDownloadMenu(chatId, chatName) {
  console.clear();
  // Name is reshaped separately to ensure mixed text displays correctly
  console.log(boxen(chalk.white(reshaper("المحادثة المختارة:") + ` ${reshaper(chatName)}`), { padding: 1, borderColor: 'green' }));

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: reshaper("ماذا تريد أن تفعل؟"),
      choices: [
        { name: reshaper("🖼️  تحميل جميع الصور") + " (Images)", value: "image" },
        { name: reshaper("📄 تحميل جميع ملفات") + " PDF", value: "pdf" },
        { name: reshaper("📊 تحميل ملفات أوفيس") + " (Word, Excel)", value: "office" },
        { name: reshaper("🔙 رجوع للقائمة الرئيسية"), value: "back" }
      ]
    }
  ]);

  if (action === "back") return startArabicCLI();

  await processDownloads(chatId, action);
}

async function processDownloads(chatId, type) {
  const spinner = ora(chalk.yellow(reshaper("جاري جلب الرسائل من المحادثة..."))).start();
  
  try {
    const messages = await client.getAllMessagesInChat(chatId, true, false);
    
    spinner.text = reshaper("جاري تصفية الملفات...");
    
    const mediaMessages = messages.filter(m => {
      if (!m.mimetype) return false;
      if (type === "image") return m.mimetype.includes("image");
      if (type === "pdf") return m.mimetype.includes("pdf");
      if (type === "office") {
        return m.mimetype.includes("word") || m.mimetype.includes("excel") || m.mimetype.includes("powerpoint") || m.mimetype.includes("officedocument");
      }
      return false;
    });

    if (mediaMessages.length === 0) {
      spinner.fail(chalk.red(reshaper("لم يتم العثور على ملفات من هذا النوع.")));
      await wait(2000);
      return showDownloadMenu(chatId, "Unknown");
    }

    spinner.text = reshaper("تم العثور على") + ` ${mediaMessages.length} ` + reshaper("ملف. جاري التحميل...");

    const safeName = chatId.replace(/[^a-zA-Z0-9]/g, "_");
    const downloadDir = path.join(__dirname, 'downloads', safeName, type);
    
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

    let count = 0;
    for (const msg of mediaMessages) {
        try {
            const buffer = await decryptMedia(msg);
            let ext = msg.mimetype.split("/")[1].split(";")[0];
            if (msg.mimetype.includes("word")) ext = "docx";
            if (msg.mimetype.includes("sheet") || msg.mimetype.includes("excel")) ext = "xlsx";
            if (msg.mimetype.includes("presentation")) ext = "pptx";

            const filename = path.join(downloadDir, `${msg.t}_${msg.id}.${ext}`);
            fs.writeFileSync(filename, buffer);
            count++;
            spinner.text = reshaper("تم تحميل") + ` ${count} / ${mediaMessages.length}`;
        } catch (e) {
            // ignore error
        }
    }

    spinner.succeed(chalk.green(reshaper("✅ تم الانتهاء! تم حفظ") + ` ${count} ` + reshaper("ملف")));
    
    await inquirer.prompt([{ type: 'input', name: 'ok', message: reshaper('اضغط Enter للمتابعة') }]);
    
    return startArabicCLI();

  } catch (error) {
    spinner.fail(reshaper("حدث خطأ أثناء جلب الرسائل."));
    console.error(error);
    await wait(3000);
    return startArabicCLI();
  }
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get("/", (req, res) => {
  res.send("WhatsApp REST API is running 🚀");
});

app.listen(3000);