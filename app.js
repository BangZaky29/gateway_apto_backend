// =========================================
// FILE: app.js
// Gateway APTO Backend - API v2.0
// Auto Trial + Feature Access + Cron Job
// =========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// =======================
// ROUTES
// =======================
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const featureRoutes = require('./routes/feature');
const linkRoutes = require('./routes/link');

// Dashboard / Management
const packageRoutes = require('./routes/package');
const userRoutes = require('./routes/user');
const statsRoutes = require('./routes/stats');

// =======================
// UTILS
// =======================
require('./utils/cron'); // Cron job untuk expire token otomatis

// =======================
// APP INIT
// =======================
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =======================
// API ROUTES
// =======================
// Auth & OTP
app.use('/api/auth', authRoutes);

// Payment & confirmation
app.use('/api/payment', paymentRoutes);



// Admin panel
app.use('/api/admin', adminRoutes);

// Feature access (trial / package)
app.use('/api/feature', featureRoutes);

// Links (misc)
app.use('/api/link', linkRoutes);

// Dashboard / management routes
app.use('/api/packages', packageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);

// =======================
// ROOT ENDPOINT
// =======================
app.get('/', (req, res) => {
  res.json({
    message: 'Gateway APTO API Running 🚀',
    version: '2.0',
    endpoints: {
      auth: '/api/auth',
      payment: '/api/payment',
      admin: '/api/admin',
      packages: '/api/packages',
      users: '/api/users',
      stats: '/api/stats',
      feature: '/api/feature',
      link: '/api/link'
    }
  });
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📊 Dashboard API endpoints ready`);
});
