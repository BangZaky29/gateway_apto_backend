const whatsappClient = require('../whatsappClient');
const { logInfo, logError } = require('../../middlewares/logger');

function sendAsync(taskName, fn) {
  setImmediate(async () => {
    try {
      if (!whatsappClient.isReady) {
        logInfo(`WhatsApp not ready, skip ${taskName}`);
        return;
      }
      await fn();
    } catch (err) {
      logError(err, taskName);
    }
  });
}

module.exports = {
  sendExpiryWarning(data) {
    sendAsync('Send Expiry Warning', async () => {
      await whatsappClient.sendExpiryWarning(
        data.phone,
        data.name,
        data.package_name,
        data.days_left
      );
    });
  },

  sendExpiredNotification(data) {
    sendAsync('Send Expired Notification', async () => {
      await whatsappClient.sendPackageExpired(
        data.phone,
        data.name,
        data.package_name
      );
    });
  }
};
