const path = require('path');
require('dotenv').config();

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

const excelFilePath = resolvePath(requiredEnv('EXCEL_FILE_PATH'));
const sheetName = process.env.SHEET_NAME ? process.env.SHEET_NAME.trim() : null;
const minDelayMs = Math.max(0, parseInteger(process.env.MIN_DELAY_MS, 10000));
const maxDelayMs = Math.max(minDelayMs, parseInteger(process.env.MAX_DELAY_MS, 20000));

module.exports = {
  appName: 'workshop-registration-whatsapp-bot',
  groupLink: requiredEnv('GROUP_LINK'),
  excelFilePath,
  maxDelayMs,
  messageRetryCount: Math.max(1, parseInteger(process.env.MESSAGE_RETRY_COUNT, 3)),
  messageRetryDelayMs: Math.max(1000, parseInteger(process.env.MESSAGE_RETRY_DELAY_MS, 5000)),
  minDelayMs,
  sheetName,
  whatsappClientId: process.env.WHATSAPP_CLIENT_ID || 'workshop-registration-bot',
  whatsappHeadless: String(process.env.WHATSAPP_HEADLESS || 'true').toLowerCase() !== 'false',
};