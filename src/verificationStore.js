const fs = require('fs');
const path = require('path');

const os = require('os');

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

function registerCertificate({ recipientName, recipientEmail, eventTitle, issueDate, expiryDate = null, issuerName, extraData = {} }) {
  let certId = generateCertId();
  while (store[certId]) {
    certId = generateCertId();
  }

  const record = {
    certId,
    recipientName: recipientName.trim(),
    recipientEmail: recipientEmail.trim().toLowerCase(),
    eventTitle: eventTitle.trim(),
    issueDate: issueDate || new Date().toISOString().split('T')[0],
    expiryDate: expiryDate || null,
    issuerName: issuerName ? issuerName.trim() : 'CertiPulse Organizer',
    issuedAt: new Date().toISOString(),
    status: 'VERIFIED', // 'VERIFIED', 'REVOKED', 'EXPIRED'
    revocationReason: null,
    viewCount: 0,
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

module.exports = {
  registerCertificate,
  getCertificate,
  revokeCertificate,
  getAllCertificates,
  generateCertId,
};
