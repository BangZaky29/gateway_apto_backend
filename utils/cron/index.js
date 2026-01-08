const {
  expireTokens,
  sendExpiryWarnings,
  sendExpiredNotifications
} = require('./tokenCron');

function startCron() {
  setInterval(expireTokens, 60 * 60 * 1000);          // 1 jam
  setInterval(sendExpiryWarnings, 60 * 60 * 1000);   // 1 jam
  setInterval(sendExpiredNotifications, 60 * 60 * 1000);
}

module.exports = startCron;
