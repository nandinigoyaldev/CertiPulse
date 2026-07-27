const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);
let DATA_DIR = isVercel ? path.join(os.tmpdir(), 'data') : path.resolve(process.cwd(), 'data');
let VERIFY_FILE = path.join(DATA_DIR, 'certificates.json');

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (err) {
  DATA_DIR = path.join(os.tmpdir(), 'data');
  VERIFY_FILE = path.join(DATA_DIR, 'certificates.json');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (ignored) {}
}

function loadStore() {
  if (!fs.existsSync(VERIFY_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(VERIFY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse certificate store:', err);
    return {};
  }
}

function saveStore(store) {
  try {
    fs.writeFileSync(VERIFY_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save certificate store:', err);
  }
}

const store = loadStore();

function generateCertId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'CERT-';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateFingerprint(certId, recipientEmail, eventTitle, issuedAt) {
  const payload = `${certId}:${recipientEmail}:${eventTitle}:${issuedAt}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function registerCertificate({
  recipientName,
  recipientEmail,
  eventTitle,
  issueDate,
  expiryDate = null,
  issuerName,
  extraData = {},
}) {
  let certId = generateCertId();
  while (store[certId]) {
    certId = generateCertId();
  }

  const issuedAt = new Date().toISOString();
  const recipientCleanEmail = (recipientEmail || '').trim().toLowerCase();
  const cleanEvent = (eventTitle || 'Event').trim();

  const fingerprintHash = generateFingerprint(certId, recipientCleanEmail, cleanEvent, issuedAt);

  const record = {
    certId,
    recipientName: (recipientName || 'Participant').trim(),
    recipientEmail: recipientCleanEmail,
    eventTitle: cleanEvent,
    issueDate: issueDate || new Date().toISOString().split('T')[0],
    expiryDate: expiryDate || null,
    issuerName: issuerName ? issuerName.trim() : 'CertiPulse Organizer',
    issuedAt,
    fingerprintHash,
    status: 'VERIFIED', // 'VERIFIED', 'REVOKED', 'EXPIRED'
    revocationReason: null,
    viewCount: 0,
    shareCount: 0,
    lastVerifiedAt: null,
    extraData,
  };

  store[certId] = record;
  saveStore(store);
  return record;
}

function getCertificate(certId, incrementView = true) {
  if (!certId) return null;
  const cleanId = String(certId).trim().toUpperCase();
  const record = store[cleanId];
  if (!record) return null;

  if (incrementView) {
    record.viewCount = (record.viewCount || 0) + 1;
    record.lastVerifiedAt = new Date().toISOString();
    saveStore(store);
  }

  // Check if expired
  if (record.status === 'VERIFIED' && record.expiryDate) {
    const exp = new Date(record.expiryDate);
    if (exp < new Date()) {
      record.status = 'EXPIRED';
      saveStore(store);
    }
  }

  return record;
}

function trackShare(certId, platform = 'general') {
  if (!certId) return null;
  const cleanId = String(certId).trim().toUpperCase();
  const record = store[cleanId];
  if (!record) return null;

  record.shareCount = (record.shareCount || 0) + 1;
  saveStore(store);
  return record;
}

function revokeCertificate(certId, reason = 'Revoked by organizer') {
  const cleanId = String(certId).trim().toUpperCase();
  const record = store[cleanId];
  if (!record) return null;

  record.status = 'REVOKED';
  record.revocationReason = reason;
  record.revokedAt = new Date().toISOString();
  saveStore(store);
  return record;
}

function getAllCertificates(filterQuery = '') {
  const list = Object.values(store);
  if (!filterQuery) return list.sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));

  const q = filterQuery.toLowerCase();
  return list
    .filter(
      (c) =>
        c.certId.toLowerCase().includes(q) ||
        c.recipientName.toLowerCase().includes(q) ||
        c.recipientEmail.toLowerCase().includes(q) ||
        c.eventTitle.toLowerCase().includes(q)
    )
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
}

function getAnalyticsSummary() {
  const list = Object.values(store);
  const totalIssued = list.length;
  const verifiedCount = list.filter((c) => c.status === 'VERIFIED').length;
  const revokedCount = list.filter((c) => c.status === 'REVOKED').length;
  const totalViews = list.reduce((acc, c) => acc + (c.viewCount || 0), 0);
  const totalShares = list.reduce((acc, c) => acc + (c.shareCount || 0), 0);

  return {
    totalIssued,
    verifiedCount,
    revokedCount,
    totalViews,
    totalShares,
    timestamp: new Date().toISOString(),
  };
}

function getOpenBadge3Metadata(certId, baseUrl = 'http://localhost:3000') {
  const cert = getCertificate(certId, false);
  if (!cert) return null;

  const appUrl = baseUrl.replace(/\/$/, '');

  return {
    '@context': 'https://w3id.org/openbadges/v2',
    id: `${appUrl}/api/certificates/${cert.certId}/badge.json`,
    type: 'Assertion',
    recipient: {
      type: 'email',
      hashed: false,
      identity: cert.recipientEmail,
    },
    issuedOn: cert.issuedAt,
    verification: {
      type: 'hosted',
      url: `${appUrl}/verify/${cert.certId}`,
    },
    badge: {
      id: `${appUrl}/badge-class/${encodeURIComponent(cert.eventTitle)}`,
      type: 'BadgeClass',
      name: cert.eventTitle,
      description: `Official Certificate of Completion for ${cert.eventTitle} issued to ${cert.recipientName}.`,
      image: `${appUrl}/api/certificates/${cert.certId}/preview.png`,
      issuer: {
        id: appUrl,
        type: 'Profile',
        name: cert.issuerName,
        url: appUrl,
      },
    },
    evidence: `${appUrl}/verify/${cert.certId}`,
    signature: {
      type: 'CryptographicHashSHA256',
      hash: cert.fingerprintHash,
      status: cert.status,
    },
  };
}

module.exports = {
  registerCertificate,
  getCertificate,
  trackShare,
  revokeCertificate,
  getAllCertificates,
  getAnalyticsSummary,
  getOpenBadge3Metadata,
  generateCertId,
  generateFingerprint,
};
