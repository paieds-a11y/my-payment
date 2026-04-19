const express = require('express');
const cors = require('cors');
const path = require('path');

const omise = require('omise')({
  publicKey: 'pkey_test_67amk7ovg402vun4xie',
  secretKey: 'skey_test_67amk7pc5xqi15qjvsr'
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let paid = {};

// 🔥 whitelist สินค้า (กันยิงมั่ว)
const products = {
  "money.pdf": "money.pdf",
  "herb.pdf": "herb.pdf",
  "online.pdf": "online.pdf"
};

// 🔥 สร้าง token กันเดา link
function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now();
}

// ================= CREATE =================
app.post('/create', async (req, res) => {
  try {
    const { file } = req.body;

    // ❗ กันยิงมั่ว
    if (!products[file]) {
      return res.status(400).send("สินค้าไม่ถูกต้อง");
    }

    const charge = await omise.charges.create({
      amount: 2000,
      currency: 'thb',
      source: { type: 'promptpay' }
    });

    const token = generateToken();

    paid[charge.id] = {
      status: false,
      time: Date.now(),
      file: file,
      token: token // 🔥 เก็บ token
    };

    res.json({
      id: charge.id,
      qr: charge.source.scannable_code.image.download_uri,
      token: token // 🔥 ส่ง token กลับไป
    });

  } catch (err) {
    console.log("ERROR:", err);
    res.status(500).send("error");
  }
});

// ================= WEBHOOK =================
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

// ================= CHECK =================
app.get('/check/:id', (req, res) => {
  const data = paid[req.params.id];

  if (!data) {
    return res.json({ paid: false });
  }

  const expired = (Date.now() - data.time) > 600000;

  res.json({
    paid: data.status && !expired
  });
});

// ================= TEST =================
app.get('/testpay/:id', (req, res) => {
  if (paid[req.params.id]) {
    paid[req.params.id].status = true;
    res.send("จำลองจ่ายเงินแล้ว");
  } else {
    res.send("ไม่พบรายการ");
  }
});

// ================= DOWNLOAD =================
app.get('/download/:id/:token', (req, res) => {
  const data = paid[req.params.id];

  if (!data) return res.send("ไม่มีข้อมูล");

  const expired = (Date.now() - data.time) > 600000;

  // 🔥 เช็ค token + สถานะ + เวลา
  if (
    data.status &&
    !expired &&
    req.params.token === data.token
  ) {

    const filePath = path.join(__dirname, data.file);

    delete paid[req.params.id]; // โหลดได้ครั้งเดียว

    res.download(filePath);

  } else {
    res.send("หมดเวลา / token ไม่ถูกต้อง / ยังไม่จ่าย");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server run", PORT);
});