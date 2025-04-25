const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Razorpay instance with LIVE credentials from .env
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const readData = () =>
  fs.existsSync('orders.json') ? JSON.parse(fs.readFileSync('orders.json')) : [];

const writeData = (data) =>
  fs.writeFileSync('orders.json', JSON.stringify(data, null, 2));

// Create order endpoint
app.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: parseInt(amount) * 100,
      currency: 'INR',
      receipt: 'receipt_' + Math.random().toString(36).substring(2, 10),
    };

    const order = await razorpay.orders.create(options);

    const orders = readData();
    orders.push({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: 'created',
    });
    writeData(orders);

    res.json(order);
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Payment verification
app.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    const orders = readData();
    const order = orders.find(o => o.razorpay_order_id === razorpay_order_id);
    if (order) {
      order.status = 'paid';
      order.payment_id = razorpay_payment_id;
      writeData(orders);
    }
    res.json({ status: 'ok' });
  } else {
    res.status(400).json({ status: 'verification_failed' });
  }
});

app.get('/payment-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
