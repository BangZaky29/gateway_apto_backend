const db = require('../../config/db');
const { logInfo, logError } = require('../../middlewares/logger');
const whatsappJob = require('../jobs/whatsappJob');

/**
 * Expire token
 */
async function expireTokens() {
  try {
    const [result] = await db.query(`
      UPDATE user_tokens
      SET is_active = 0
      WHERE expired_at < NOW()
      AND is_active = 1
    `);

    if (result.affectedRows > 0) {
      logInfo(`Expired ${result.affectedRows} tokens`);
    }
  } catch (err) {
    logError(err, 'Expire Tokens Cron');
  }
}

/**
 * Warning 3 days before expiry
 */
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

    if (rows.length > 0) {
      logInfo(`Found ${rows.length} packages expiring in 3 days`);
    }

    for (const row of rows) {
      whatsappJob.sendExpiryWarning(row); // 🚀 NON-BLOCKING
    }
  } catch (err) {
    logError(err, 'Expiry Warning Cron');
  }
}

/**
 * Expired today
 */
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

    if (rows.length > 0) {
      logInfo(`Found ${rows.length} expired today`);
    }

    for (const row of rows) {
      whatsappJob.sendExpiredNotification(row); // 🚀 NON-BLOCKING
    }
  } catch (err) {
    logError(err, 'Expired Notification Cron');
  }
}

module.exports = {
  expireTokens,
  sendExpiryWarnings,
  sendExpiredNotifications
};
