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

const excelInputPath = resolvePath(
  process.env.EXCEL_FOLDER_PATH && String(process.env.EXCEL_FOLDER_PATH).trim()
    ? process.env.EXCEL_FOLDER_PATH.trim()
    : requiredEnv('EXCEL_FILE_PATH'),
);
const sheetName = process.env.SHEET_NAME ? process.env.SHEET_NAME.trim() : null;
const priorityEmail = process.env.PRIORITY_EMAIL ? process.env.PRIORITY_EMAIL.trim().toLowerCase() : 'nandunandinigoyal@gmail.com';
const priorityName = process.env.PRIORITY_NAME ? process.env.PRIORITY_NAME.trim().toLowerCase() : 'nandini goyal';
const priorityPhone = process.env.PRIORITY_PHONE ? process.env.PRIORITY_PHONE.trim() : '917982155266';
const minDelayMs = Math.max(0, parseInteger(process.env.MIN_DELAY_MS, 10000));
const maxDelayMs = Math.max(minDelayMs, parseInteger(process.env.MAX_DELAY_MS, 20000));

module.exports = {
  appName: 'workshop-registration-whatsapp-bot',
  groupLink: requiredEnv('GROUP_LINK'),
  excelInputPath,
  maxDelayMs,
  messageRetryCount: Math.max(1, parseInteger(process.env.MESSAGE_RETRY_COUNT, 3)),
  messageRetryDelayMs: Math.max(1000, parseInteger(process.env.MESSAGE_RETRY_DELAY_MS, 5000)),
  minDelayMs,
  priorityEmail,
  priorityName,
  priorityPhone,
  sheetName,
  whatsappClientId: process.env.WHATSAPP_CLIENT_ID || 'workshop-registration-bot',
  whatsappHeadless: String(process.env.WHATSAPP_HEADLESS || 'true').toLowerCase() !== 'false',
};