const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { formatTimestamp, normalizeHeaderName, sanitizeCellValue } = require('./utils');

const HEADER_ALIASES = {
  email: ['email', "candidate's email", 'candidate email'],
  name: ['name', "candidate's name", 'candidate name', 'full name'],
  phone: ['phone', 'phone number', 'number', 'mobile', 'mobile number', 'whatsapp', 'whatsapp number', "candidate's mobile", 'candidate mobile'],
  status: ['status'],
  timestamp: ['timestamp', 'time stamp'],
};

function createWorkbook() {
  return new ExcelJS.Workbook();
}

function isExcelWorkbook(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.xlsx' || extension === '.xlsm' || extension === '.csv';
}

function isLikelyPlainTextCsv(filePath) {
  const sample = fs.readFileSync(filePath).subarray(0, 256);

  if (sample.length >= 2 && sample[0] === 0x50 && sample[1] === 0x4b) {
    return false;
  }

  return !sample.includes(0x00);
}

function walkWorkbooks(rootPath) {
  const normalizedRoot = path.resolve(rootPath);

  if (!fs.existsSync(normalizedRoot)) {
    if (path.extname(normalizedRoot)) {
      return [];
    }

    return [];
  }

  const stats = fs.statSync(normalizedRoot);

  if (stats.isFile()) {
    return isExcelWorkbook(normalizedRoot) ? [normalizedRoot] : [];
  }

  const files = [];

  for (const entry of fs.readdirSync(normalizedRoot, { withFileTypes: true })) {
    if (entry.name.startsWith('~$')) {
      continue;
    }

    const entryPath = path.join(normalizedRoot, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkWorkbooks(entryPath));
      continue;
    }

    if (entry.isFile() && isExcelWorkbook(entryPath)) {
      files.push(entryPath);
    }
  }

  return files.sort();
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
  const workbookPath = config.excelInputPath;

  if (!fs.existsSync(path.dirname(workbookPath))) {
    await fs.promises.mkdir(path.dirname(workbookPath), { recursive: true });
  }

  if (!fs.existsSync(workbookPath)) {
    const worksheet = workbook.addWorksheet(config.sheetName || 'Sheet1');
    worksheet.addRow(['Name', 'Email', 'Phone', 'Status', 'Timestamp']);
    await workbook.xlsx.writeFile(workbookPath);
  }

  await workbook.xlsx.readFile(workbookPath);
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

async function loadWorkbookFromPath(workbookPath) {
  const workbook = createWorkbook();
  const fileExtension = path.extname(workbookPath).toLowerCase();

  if (!fs.existsSync(path.dirname(workbookPath))) {
    await fs.promises.mkdir(path.dirname(workbookPath), { recursive: true });
  }

  if (!fs.existsSync(workbookPath)) {
    const worksheet = workbook.addWorksheet(config.sheetName || 'Sheet1');
    worksheet.addRow(['Name', 'Email', 'Phone', 'Status', 'Timestamp']);
    if (fileExtension === '.csv') {
      await workbook.csv.writeFile(workbookPath);
    } else {
      await workbook.xlsx.writeFile(workbookPath);
    }
  }

  if (fileExtension === '.csv') {
    if (!isLikelyPlainTextCsv(workbookPath)) {
      throw new Error(`Unsupported CSV content: ${workbookPath}`);
    }

    await workbook.csv.readFile(workbookPath);
  } else {
    await workbook.xlsx.readFile(workbookPath);
  }
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

  return { headers, workbook, worksheet, workbookPath };
}

async function readSheetData() {
  const workbookPaths = walkWorkbooks(config.excelInputPath);
  const rows = [];

  for (const workbookPath of workbookPaths) {
    rows.push(...await readRowsFromWorkbookPath(workbookPath));
  }

  return rows;
}

async function readRowsFromWorkbookPath(workbookPath) {
  let loaded;

  try {
    loaded = await loadWorkbookFromPath(workbookPath);
  } catch (error) {
    if (String(error.message || error).includes('Unsupported CSV content')) {
      return [];
    }

    throw error;
  }

  const { headers, worksheet } = loaded;
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
      sourcePath: workbookPath,
      status,
      timestamp,
    });
  });

  return rows;
}

async function updateSheetStatus(sourcePath, rowNumber, status, timestamp = formatTimestamp()) {
  const { headers, workbook, worksheet } = await loadWorkbookFromPath(sourcePath);
  const row = worksheet.getRow(rowNumber);

  row.getCell(headers.status).value = status;
  row.getCell(headers.timestamp).value = timestamp;

  if (path.extname(sourcePath).toLowerCase() === '.csv') {
    await workbook.csv.writeFile(sourcePath);
  } else {
    await workbook.xlsx.writeFile(sourcePath);
  }
}

module.exports = {
  loadWorkbookFromPath,
  readSheetData,
  readRowsFromWorkbookPath,
  updateSheetStatus,
  walkWorkbooks,
};