// =========================================
// FILE: utils/cron.js (FIXED)
// =========================================

const db = require('../config/db'); // 🔥 PENTING
const whatsappClient = require('./whatsappClient');
const { logInfo, logError } = require('../middlewares/logger');

async function expireTokens() {
  try {
    const [result] = await db.query(`
      UPDATE user_tokens
      SET is_active = 0
      WHERE expired_at < NOW()
        AND is_active = 1
    `);

    if (result.affectedRows > 0) {
      logInfo(`⏱️ Cron: ${result.affectedRows} token expired`);
    }
  } catch (err) {
    logError(err, 'Expire Tokens Cron');
  }
}

async function sendExpiryWarnings() {
  try {
    const [rows] = await db.query(`
      SELECT u.name, u.phone, pk.name AS package_name,
             DATEDIFF(ut.expired_at, NOW()) AS days_left
      FROM user_tokens ut
      JOIN users u ON u.id = ut.user_id
      JOIN packages pk ON pk.id = ut.package_id
      WHERE ut.is_active = 1
        AND DATEDIFF(ut.expired_at, NOW()) = 3
    `);

    for (const item of rows) {
      if (whatsappClient.isReady) {
        await whatsappClient.sendExpiryWarning(
          item.phone,
          item.name,
          item.package_name,
          item.days_left
        );
      }
    }
  } catch (err) {
    logError(err, 'Expiry Warning Cron');
  }
}

async function sendExpiredNotifications() {
  try {
    const [rows] = await db.query(`
      SELECT u.name, u.phone, pk.name AS package_name
      FROM user_tokens ut
      JOIN users u ON u.id = ut.user_id
      JOIN packages pk ON pk.id = ut.package_id
      WHERE ut.is_active = 0
        AND DATE(ut.expired_at) = CURDATE()
    `);

    for (const item of rows) {
      if (whatsappClient.isReady) {
        await whatsappClient.sendPackageExpired(
          item.phone,
          item.name,
          item.package_name
        );
      }
    }
  } catch (err) {
    logError(err, 'Expired Notification Cron');
  }
}

/**
 * 🚀 START CRON
 */
function startCron() {
  logInfo('🕒 Cron jobs started');

  setInterval(expireTokens, 60 * 1000);
  setInterval(sendExpiryWarnings, 60 * 60 * 1000);
  setInterval(sendExpiredNotifications, 60 * 60 * 1000);

  setTimeout(() => {
    expireTokens();
    sendExpiryWarnings();
    sendExpiredNotifications();
  }, 5000);
}

module.exports = startCron;
