const path = require('path');
require('dotenv').config();

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePath(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

module.exports = {
  appName: 'CertiPulse',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInteger(process.env.SMTP_PORT, 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpSecure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  fromEmail: process.env.FROM_EMAIL || process.env.SMTP_USER || 'certificates@certipulse.app',
  fromName: process.env.FROM_NAME || 'CertiPulse Credentials',
  minDelayMs: Math.max(0, parseInteger(process.env.MIN_DELAY_MS, 1000)),
  maxDelayMs: Math.max(1000, parseInteger(process.env.MAX_DELAY_MS, 3000)),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  adminToken: process.env.ADMIN_TOKEN || '',
};