const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const omise = require('omise')({
  publicKey: 'YOUR_PUBLIC_KEY',
  secretKey: 'YOUR_SECRET_KEY'
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let paid = {};
let downloadCount = {}; // 🔥 เก็บยอดโหลด

// ✅ CREATE
app.post('/create', async (req, res) => {
  try {
    const { file } = req.body;

    const charge = await omise.charges.create({
      amount: 2000,
      currency: 'thb',
      source: { type: 'promptpay' }
    });

    const token = crypto.randomBytes(16).toString('hex');

    paid[charge.id] = {
      status: false,
      time: Date.now(),
      file: file,
      token: token
    };

    res.json({
      id: charge.id,
      token: token,
      qr: charge.source.scannable_code.image.download_uri
    });

  } catch (err) {
  console.log("ERROR:", err);
  res.status(500).json({ error: err.message });
}
});

// ✅ CHECK
app.get('/check/:id', (req, res) => {
  const data = paid[req.params.id];

  if (!data) return res.json({ paid: false });

  const expired = (Date.now() - data.time) > 600000;

  res.json({
    paid: data.status && !expired
  });
});

// ✅ WEBHOOK (ใช้ตอน live)
app.post('/webhook', (req, res) => {
  const event = req.body;

  if (event.key === 'charge.complete') {
    if (event.data.status === 'successful') {
      if (paid[event.data.id]) {
        paid[event.data.id].status = true;
      }
    }
  }

  res.sendStatus(200);
});

// ✅ TEST PAY
app.get('/testpay/:id', (req, res) => {
  if (paid[req.params.id]) {
    paid[req.params.id].status = true;
    res.send("จำลองจ่ายเงินแล้ว");
  } else {
    res.send("ไม่พบรายการ");
  }
});

// ✅ DOWNLOAD
app.get('/download/:id/:token', (req, res) => {
  const data = paid[req.params.id];

  if (!data) return res.send("ไม่มีข้อมูล");

  const expired = (Date.now() - data.time) > 600000;

  if (data.status && !expired && data.token === req.params.token) {

    // 🔥 นับยอดโหลด
    downloadCount[data.file] = (downloadCount[data.file] || 0) + 1;

    delete paid[req.params.id];

    const filePath = path.join(__dirname, data.file);

    res.download(filePath);

  } else {
    res.send("หมดเวลา / token ผิด / ยังไม่จ่าย");
  }
});

// ✅ GET COUNT
app.get('/count', (req, res) => {
  res.json(downloadCount);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server run", PORT));