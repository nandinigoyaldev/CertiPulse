const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { formatTimestamp, normalizeHeaderName, sanitizeCellValue } = require('./utils');

const HEADER_ALIASES = {
  email: ['email'],
  name: ['name'],
  phone: ['phone', 'phone number', 'number', 'mobile', 'mobile number', 'whatsapp', 'whatsapp number'],
  status: ['status'],
  timestamp: ['timestamp', 'time stamp'],
};

function createWorkbook() {
  return new ExcelJS.Workbook();
}

function findWorksheet(workbook) {
  if (config.sheetName) {
    const namedSheet = workbook.getWorksheet(config.sheetName);
    if (namedSheet) {
      return namedSheet;
    }
  }

  const firstSheet = workbook.worksheets[0];
  if (!firstSheet) {
    throw new Error('The Excel workbook does not contain any worksheets.');
  }

  return firstSheet;
}

function getHeaderMap(worksheet) {
  const headerMap = new Map();
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell((cell, columnNumber) => {
    const normalized = normalizeHeaderName(cell.value);
    if (normalized) {
      headerMap.set(normalized, columnNumber);
    }
  });

  return headerMap;
}

function findHeaderColumn(headerMap, aliases) {
  for (const alias of aliases) {
    const column = headerMap.get(normalizeHeaderName(alias));
    if (column) {
      return column;
    }
  }

  return null;
}

async function loadWorkbook() {
  const workbook = createWorkbook();
  const workbookPath = config.excelFilePath;

  if (!fs.existsSync(path.dirname(workbookPath))) {
    await fs.promises.mkdir(path.dirname(workbookPath), { recursive: true });
  }

  if (!fs.existsSync(workbookPath)) {
    const worksheet = workbook.addWorksheet(config.sheetName || 'Sheet1');
    worksheet.addRow(['Name', 'Email', 'Phone', 'Status', 'Timestamp']);
    await workbook.xlsx.writeFile(workbookPath);
  }

  await workbook.xlsx.readFile(config.excelFilePath);
  const worksheet = findWorksheet(workbook);
  const headerMap = getHeaderMap(worksheet);
  const headers = {};

  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const existing = findHeaderColumn(headerMap, aliases);

    if (existing) {
      headers[key] = existing;
      continue;
    }

    const newColumn = worksheet.columnCount + 1;
    worksheet.getRow(1).getCell(newColumn).value = key === 'timestamp' ? 'Timestamp' : key.charAt(0).toUpperCase() + key.slice(1);
    headers[key] = newColumn;
  }

  return { headers, workbook, worksheet };
}

async function readSheetData() {
  const { headers, worksheet } = await loadWorkbook();
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const phone = sanitizeCellValue(row.getCell(headers.phone).text || row.getCell(headers.phone).value);
    const name = sanitizeCellValue(row.getCell(headers.name).text || row.getCell(headers.name).value);
    const email = sanitizeCellValue(row.getCell(headers.email).text || row.getCell(headers.email).value);
    const status = sanitizeCellValue(row.getCell(headers.status).text || row.getCell(headers.status).value).toUpperCase();
    const timestamp = sanitizeCellValue(row.getCell(headers.timestamp).text || row.getCell(headers.timestamp).value);

    if (!phone && !name && !email && !status && !timestamp) {
      return;
    }

    rows.push({
      email,
      name,
      phone,
      rowNumber,
      status,
      timestamp,
    });
  });

  return rows;
}

async function updateSheetStatus(rowNumber, status, timestamp = formatTimestamp()) {
  const { headers, workbook, worksheet } = await loadWorkbook();
  const row = worksheet.getRow(rowNumber);

  row.getCell(headers.status).value = status;
  row.getCell(headers.timestamp).value = timestamp;

  await workbook.xlsx.writeFile(config.excelFilePath);
}

module.exports = {
  readSheetData,
  updateSheetStatus,
};