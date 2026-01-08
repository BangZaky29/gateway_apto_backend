// =========================================
// FILE: utils/whatsappClient.js - UPGRADED
// Enhanced WhatsApp Client with Multiple Notifications
// =========================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { logWhatsApp, logError } = require('../middlewares/logger');

class WhatsAppClient {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.status = 'disconnected';
    this.io = null;
  }

  /**
   * Initialize WhatsApp client
   */
  initialize(io) {
    this.io = io;

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // QR Code generated
    this.client.on('qr', async (qr) => {
      logWhatsApp('QR Code generated');
      this.status = 'qr';
      
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        if (this.io) {
          this.io.emit('whatsapp-qr', { qr: this.qrCode, status: 'qr' });
        }
      } catch (err) {
        logError(err, 'WhatsApp QR Generation');
      }
    });

    // Client ready
    this.client.on('ready', () => {
      logWhatsApp('Client is ready!');
      this.isReady = true;
      this.status = 'ready';
      this.qrCode = null;

      if (this.io) {
        this.io.emit('whatsapp-status', {
          status: 'ready',
          message: 'WhatsApp connected successfully'
        });
      }
    });

    // Authentication
    this.client.on('authenticated', () => {
      logWhatsApp('Authenticated successfully');
      this.status = 'connecting';
    });

    // Auth failure
    this.client.on('auth_failure', (msg) => {
      logError(new Error(msg), 'WhatsApp Authentication');
      this.status = 'disconnected';
      this.isReady = false;
    });

    // Disconnected
    this.client.on('disconnected', (reason) => {
      logWhatsApp(`Disconnected: ${reason}`);
      this.status = 'disconnected';
      this.isReady = false;
      this.qrCode = null;
    });

    this.client.initialize();
  }

  /**
   * Format phone number to WhatsApp format
   */
  formatPhoneNumber(phoneNumber) {
    let formatted = phoneNumber.replace(/[^0-9]/g, '');
    
    if (!formatted.startsWith('62')) {
      if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substring(1);
      } else {
        formatted = '62' + formatted;
      }
    }
    
    return formatted;
  }

  /**
   * Check if number is registered on WhatsApp
   */
  async isNumberRegistered(phoneNumber) {
    if (!this.isReady) return false;

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';
      return await this.client.isRegisteredUser(chatId);
    } catch (error) {
      logError(error, 'WhatsApp Number Check');
      return false;
    }
  }

  /**
   * 1️⃣ Send OTP Message
   */
  async sendOTP(phoneNumber, otpCode, userName) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';

      const isRegistered = await this.client.isRegisteredUser(chatId);
      if (!isRegistered) {
        throw new Error('Number is not registered on WhatsApp');
      }

      const message = `🔐 *Gateway SOLUTION - Verification Code*\n\n` +
                     `Hello ${userName || 'User'}! 👋\n\n` +
                     `Your OTP verification code is:\n\n` +
                     `*${otpCode}*\n\n` +
                     `⏰ This code is valid for 5 minutes.\n` +
                     `🔒 Please do not share this code with anyone.\n\n` +
                     `If you didn't request this code, please ignore this message.\n\n` +
                     `_Gateway SOLUTION Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`OTP sent to ${formatted}`);

      return { success: true, formattedNumber: formatted };
    } catch (error) {
      logError(error, 'WhatsApp Send OTP');
      throw error;
    }
  }

  /**
   * 2️⃣ Send Welcome Message (After Registration)
   */
  async sendWelcomeMessage(phoneNumber, userName) {
    if (!this.isReady) return;

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';

      const message = `🎉 *Welcome to Gateway SOLUTION!*\n\n` +
                     `Hi ${userName}! 👋\n\n` +
                     `Thank you for registering with us!\n\n` +
                     `✅ Your account has been verified successfully.\n` +
                     `🎁 You now have access to our 3-day trial package!\n\n` +
                     `Explore all our premium features and tools during your trial period.\n\n` +
                     `Need help? Contact us:\n` +
                     `📧 cs@nuansasolution.id\n` +
                     `📱 0896-4444-8721\n\n` +
                     `_Gateway SOLUTION Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`Welcome message sent to ${formatted}`);
    } catch (error) {
      logError(error, 'WhatsApp Welcome Message');
    }
  }

  /**
   * 3️⃣ Send Login Notification
   */
  async sendLoginNotification(phoneNumber, userName, ipAddress) {
    if (!this.isReady) return;

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';
      const timestamp = new Date().toLocaleString('id-ID');

      const message = `🔔 *Login Notification*\n\n` +
                     `Hi ${userName}!\n\n` +
                     `A new login to your Gateway SOLUTION account was detected:\n\n` +
                     `⏰ Time: ${timestamp}\n` +
                     `📍 IP: ${ipAddress}\n\n` +
                     `If this wasn't you, please change your password immediately.\n\n` +
                     `_Gateway SOLUTION Security Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`Login notification sent to ${formatted}`);
    } catch (error) {
      logError(error, 'WhatsApp Login Notification');
    }
  }

  /**
   * 4️⃣ Send Payment Confirmation (Pending)
   */
  async sendPaymentReceived(phoneNumber, userName, packageName, amount) {
    if (!this.isReady) return;

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';

      const message = `💳 *Payment Received*\n\n` +
                     `Hi ${userName}!\n\n` +
                     `We've received your payment for:\n\n` +
                     `📦 Package: ${packageName}\n` +
                     `💰 Amount: Rp ${amount.toLocaleString('id-ID')}\n\n` +
                     `⏳ Status: Pending Verification\n\n` +
                     `Our team is reviewing your payment. You'll receive another notification once it's confirmed (usually within 1-5 minutes).\n\n` +
                     `Thank you for your patience!\n\n` +
                     `_Gateway SOLUTION Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`Payment received notification sent to ${formatted}`);
    } catch (error) {
      logError(error, 'WhatsApp Payment Received');
    }
  }

  /**
   * 5️⃣ Send Payment Approved
   */
  async sendPaymentApproved(phoneNumber, userName, packageName, expiryDate) {
    if (!this.isReady) return;

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';

      const message = `✅ *Payment Approved!*\n\n` +
                     `Great news, ${userName}!\n\n` +
                     `Your payment has been verified and your package is now active! 🎉\n\n` +
                     `📦 Package: ${packageName}\n` +
                     `📅 Valid Until: ${expiryDate}\n\n` +
                     `You now have full access to all features included in your package.\n\n` +
                     `Visit your dashboard to start using our services:\n` +
                     `🌐 https://nuansasolution.id/profile\n\n` +
                     `Enjoy! 🚀\n\n` +
                     `_Gateway SOLUTION Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`Payment approved notification sent to ${formatted}`);
    } catch (error) {
      logError(error, 'WhatsApp Payment Approved');
    }
  }

  /**
   * 6️⃣ Send Package Expiry Warning (3 days before)
   */
  async sendExpiryWarning(phoneNumber, userName, packageName, daysLeft) {
    if (!this.isReady) return;

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';

      const message = `⚠️ *Package Expiring Soon*\n\n` +
                     `Hi ${userName},\n\n` +
                     `Your ${packageName} package will expire in ${daysLeft} days.\n\n` +
                     `Don't lose access to your favorite features!\n\n` +
                     `Renew now to continue enjoying:\n` +
                     `✨ All premium features\n` +
                     `📊 Unlimited usage\n` +
                     `🛡️ Priority support\n\n` +
                     `Visit: https://nuansasolution.id/payment\n\n` +
                     `_Gateway SOLUTION Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`Expiry warning sent to ${formatted}`);
    } catch (error) {
      logError(error, 'WhatsApp Expiry Warning');
    }
  }

  /**
   * 7️⃣ Send Package Expired
   */
  async sendPackageExpired(phoneNumber, userName, packageName) {
    if (!this.isReady) return;

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';

      const message = `⏰ *Package Expired*\n\n` +
                     `Hi ${userName},\n\n` +
                     `Your ${packageName} package has expired.\n\n` +
                     `To regain access to premium features, please renew your subscription.\n\n` +
                     `Choose a package that suits your needs:\n` +
                     `🌐 https://nuansasolution.id/payment\n\n` +
                     `We look forward to serving you again!\n\n` +
                     `_Gateway SOLUTION Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`Package expired notification sent to ${formatted}`);
    } catch (error) {
      logError(error, 'WhatsApp Package Expired');
    }
  }

  /**
   * 8️⃣ Send Password Reset OTP
   */
  async sendPasswordResetOTP(phoneNumber, userName, otpCode) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';

      const message = `🔒 *Password Reset Request*\n\n` +
                     `Hi ${userName},\n\n` +
                     `You requested to reset your password.\n\n` +
                     `Your verification code is:\n\n` +
                     `*${otpCode}*\n\n` +
                     `⏰ This code expires in 5 minutes.\n\n` +
                     `If you didn't request this, please ignore this message and your password will remain unchanged.\n\n` +
                     `_Gateway SOLUTION Security Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`Password reset OTP sent to ${formatted}`);

      return { success: true, formattedNumber: formatted };
    } catch (error) {
      logError(error, 'WhatsApp Password Reset OTP');
      throw error;
    }
  }

  /**
   * 9️⃣ Send Password Changed Confirmation
   */
  async sendPasswordChanged(phoneNumber, userName) {
    if (!this.isReady) return;

    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      const chatId = formatted + '@c.us';
      const timestamp = new Date().toLocaleString('id-ID');

      const message = `✅ *Password Changed Successfully*\n\n` +
                     `Hi ${userName},\n\n` +
                     `Your Gateway SOLUTION password has been changed.\n\n` +
                     `⏰ Time: ${timestamp}\n\n` +
                     `If you didn't make this change, please contact us immediately:\n` +
                     `📧 cs@nuansasolution.id\n` +
                     `📱 0896-4444-8721\n\n` +
                     `_Gateway SOLUTION Security Team_`;

      await this.client.sendMessage(chatId, message);
      logWhatsApp(`Password changed notification sent to ${formatted}`);
    } catch (error) {
      logError(error, 'WhatsApp Password Changed');
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      status: this.status,
      isReady: this.isReady,
      qrCode: this.qrCode
    };
  }

  /**
   * Disconnect
   */
  async disconnect() {
    if (this.client) {
      await this.client.destroy();
      this.isReady = false;
      this.status = 'disconnected';
      this.qrCode = null;
      logWhatsApp('Client disconnected');
    }
  }

  /**
   * Restart
   */
  async restart(io) {
    await this.disconnect();
    setTimeout(() => {
      this.initialize(io);
    }, 2000);
  }
}

const whatsappClient = new WhatsAppClient();
module.exports = whatsappClient;