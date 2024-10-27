const express = require("express");
const { Client, middleware } = require("@line/bot-sdk");
const OpenAI = require("openai");
const fs = require("fs");
const pdf = require("pdf-parse");
const dotenv = require("dotenv");
// ตั้งค่า config ของ LINE bot
const env = dotenv.config().parsed;
const lineConfig = {
  channelAccessToken: env.CAT_TOKEN,
  channelSecret: env.CS_TOKEN, // ใส่ Secret ที่ได้จาก LINE Developer Console
};

// สร้าง OpenAI client
const openai = new OpenAI({
  apiKey: env.CHAT_GPT_API_KEY, // ใส่ OpenAI API Key ของคุณที่นี่
});

// สร้าง LINE bot client
const client = new Client(lineConfig);
const app = express();

// ใช้ middleware สำหรับการตรวจสอบ signature
app.use(middleware(lineConfig));

// ฟังก์ชันสำหรับอ่านข้อมูลจาก PDF
const readPdf = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text; // ส่งกลับข้อความจาก PDF
};

// ฟังก์ชันในการถาม AI
const askAi = async (query, pdfText) => {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: `จากข้อมูลใน PDF:\n${pdfText}\n\nคำถามของฉันคือ: ${query}`,
      },
    ],
  });
  return response.choices[0].message.content;
};

// รับ callback จาก LINE
app.post("/callback", async (req, res) => {
  const events = req.body.events;

  Promise.all(events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// ฟังก์ชันสำหรับจัดการเหตุการณ์
async function handleEvent(event) {
  if (event.type === "message" && event.message.type === "text") {
    const userMessage = event.message.text;

    // อ่านข้อมูลจาก PDF
    const pdfText = await readPdf("data.pdf"); // เปลี่ยนเป็น path ที่ถูกต้อง

    // ถาม AI
    const aiResponse = await askAi(userMessage, pdfText);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: aiResponse,
    });
  }
  return Promise.resolve(null);
}

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
