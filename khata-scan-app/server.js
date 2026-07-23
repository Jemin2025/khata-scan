require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const storageRoutes = require('./routes/storage');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '6mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/storage', storageRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve the frontend (public/index.html is the Khata Scan app)
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Khata Scan server chal raha hai: http://localhost:${PORT}`);
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET set nahi hai (.env dekho) — production mein zaroor set karo.');
  }
});
