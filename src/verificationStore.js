const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.cwd(), 'data');
const VERIFY_FILE = path.join(DATA_DIR, 'certificates.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

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

function registerCertificate({ recipientName, recipientEmail, eventTitle, issueDate, issuerName, extraData = {} }) {
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
    issuerName: issuerName ? issuerName.trim() : 'CertiPulse Organizer',
    issuedAt: new Date().toISOString(),
    status: 'VERIFIED',
    extraData,
  };

  store[certId] = record;
  saveStore(store);
  return record;
}

function getCertificate(certId) {
  if (!certId) return null;
  const cleanId = String(certId).trim().toUpperCase();
  return store[cleanId] || null;
}

function getAllCertificates() {
  return Object.values(store);
}

module.exports = {
  registerCertificate,
  getCertificate,
  getAllCertificates,
  generateCertId,
};
