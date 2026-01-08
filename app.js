// =========================================
// FILE: app.js (UPGRADED)
// Add Logger Middleware
// =========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const startCron = require('./utils/cron');


// 🆕 Logger Middleware
const { logger } = require('./middlewares/logger');

// Routes
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const featureRoutes = require('./routes/feature');
const linkRoutes = require('./routes/link');
const whatsappRoutes = require('./routes/whatsapp');
const packageRoutes = require('./routes/package');
const userRoutes = require('./routes/user');
const statsRoutes = require('./routes/stats');

// Utils
const whatsappClient = require('./utils/whatsappClient');

// App Init
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🆕 Logger Middleware (Add this AFTER express.json())
app.use(logger);

// Socket.IO
io.on('connection', (socket) => {
  console.log('👤 Admin client connected:', socket.id);
  const status = whatsappClient.getStatus();
  socket.emit('whatsapp-status', status);

  socket.on('disconnect', () => {
    console.log('👋 Admin client disconnected:', socket.id);
  });

  socket.on('request-qr', () => {
    const status = whatsappClient.getStatus();
    socket.emit('whatsapp-qr', {
      qr: status.qrCode,
      status: status.status
    });
  });
});

// Initialize WhatsApp
setTimeout(() => {
  console.log('🚀 Initializing WhatsApp Client...');
  whatsappClient.initialize(io);
}, 2000);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feature', featureRoutes);
app.use('/api/link', linkRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'Gateway APTO API Running 🚀',
    version: '2.2',
    features: {
      whatsappBot: whatsappClient.isReady ? '✅ Connected' : '❌ Disconnected',
      logging: '✅ Enabled',
      forgotPassword: '✅ Enabled'
    },
    endpoints: {
      auth: '/api/auth',
      payment: '/api/payment',
      admin: '/api/admin',
      packages: '/api/packages',
      users: '/api/users',
      stats: '/api/stats',
      feature: '/api/feature',
      link: '/api/link',
      whatsapp: '/api/whatsapp'
    }
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📊 Dashboard API endpoints ready`);
  console.log(`💬 WhatsApp Bot initializing...`);
  console.log(`🔌 Socket.IO ready for real-time updates`);
  console.log(`📝 Logging system enabled`);

  startCron(); // ⏱️ ringan, tidak blocking
});

module.exports = app;