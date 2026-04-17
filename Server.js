const express = require('express');
const cors = require('cors');

const omise = require('omise')({
  publicKey: 'pkey_test_67amk7ovg402vun4xie',
  secretKey: 'skey_test_67amk7pc5xqi15qjvsr'
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let paid = {};

app.post('/create', async (req, res) => {
  try {
    const { file } = req.body; // 🔥 เพิ่มตรงนี้

    const charge = await omise.charges.create({
      amount: 2000,
      currency: 'thb',
      source: { type: 'promptpay' }
    });

    paid[charge.id] = {
      status: false,
      time: Date.now(),
      file: file // 🔥 เพิ่มตรงนี้
    };

    res.json({
      id: charge.id,
      qr: charge.source.scannable_code.image.download_uri
    });

  } catch (err) {
    console.log("ERROR:", err); // 👈 สำคัญมาก
    res.status(500).send("error");
  }
});
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

app.get('/check/:id', (req, res) => {
  const data = paid[req.params.id];

  if (!data) {
    return res.json({ paid: false });
  }

  const expired = (Date.now() - data.time) > 600000; // 10 นาที

  res.json({
    paid: data.status && !expired
  });
});

app.get('/testpay/:id', (req, res) => {
  if (paid[req.params.id]) {
    paid[req.params.id].status = true;
    res.send("จำลองจ่ายเงินแล้ว");
  } else {
    res.send("ไม่พบรายการ");
  }
});

const path = require('path');

app.get('/download/:id', (req, res) => {
  const data = paid[req.params.id];

  if (!data) return res.send("ไม่มีข้อมูล");

  const expired = (Date.now() - data.time) > 600000;

  if (data.status && !expired) {

     delete paid[req.params.id];

    const filePath = path.join(__dirname, data.file);

    console.log("กำลังส่งไฟล์:", filePath);
    console.log("โหลดไฟล์แล้ว!");

    res.download(filePath, (err) => {
      if (err) {
        console.log("โหลดไม่ได้:", err);
        res.send("โหลดไฟล์ไม่สำเร็จ");
      }
    });

  } else {
    res.send("หมดเวลา หรือยังไม่จ่าย");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server run", PORT);
});