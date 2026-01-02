const db = require('../config/db');

/**
 * checkLinkAccess
 * POST body: { path: "/invoice" }
 * req.user.id => didapat dari authMiddleware (JWT)
 */
exports.checkLinkAccess = (req, res) => {
  let { path } = req.body;

  if (!path) {
    return res.status(400).json({
      success: false,
      message: 'Path is required'
    });
  }

  // =========================
  // NORMALISASI PATH
  path = path.replace(/\/+$/, '').toLowerCase();

  // Ambil fitur dari tabel features
  const featureQuery = `
    SELECT id, name, code, status 
    FROM features 
    WHERE LOWER(code) = ?
    LIMIT 1
  `;

  db.query(featureQuery, [path], (err, features) => {
    if (err) return res.status(500).json({ success:false, message:'Database error', error:err });

    if (features.length === 0) {
      // fitur tidak ada → public
      return res.json({
        success: true,
        allowed: true,
        message: 'Public feature'
      });
    }

    const feature = features[0];

    // free → akses semua
    if (feature.status === 'free') {
      return res.json({
        success: true,
        allowed: true,
        feature: feature.name,
        message: 'Free feature, akses dibuka'
      });
    }

    // premium → harus login
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        allowed: false,
        reason: 'NOT_LOGIN',
        feature: feature.name,
        message: 'Silakan login terlebih dahulu'
      });
    }

    // cek subscription user via payments + package_features
    const subscriptionQuery = `
      SELECT p.id AS payment_id
      FROM payments p
      JOIN package_features pf ON pf.package_id = p.package_id
      WHERE p.user_id = ? 
        AND p.status = 'confirmed'
        AND pf.feature_id = ?
      LIMIT 1
    `;

    db.query(subscriptionQuery, [req.user.id, feature.id], (err2, subs) => {
      if (err2) return res.status(500).json({ success:false, message:'DB error', error: err2 });

      if (!subs || subs.length === 0) {
        return res.status(403).json({
          success: false,
          allowed: false,
          reason: 'NOT_SUBSCRIBED',
          feature: feature.name,
          message: 'Anda belum berlangganan untuk fitur ini'
        });
      }

      // akses granted
      return res.json({
        success: true,
        allowed: true,
        feature: feature.name,
        message: 'Access granted'
      });
    });

  });
};
