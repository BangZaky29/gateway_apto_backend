module.exports = function normalizePhone(phone) {
  if (!phone) return phone;

  let p = phone.trim();

  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '62' + p.slice(1);

  return p;
};
