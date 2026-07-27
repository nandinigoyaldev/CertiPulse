const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { formatTimestamp, normalizeHeaderName, sanitizeCellValue, smartFormatName, smartFixEmailTypo } = require('./utils');

const HEADER_ALIASES = {
  email: ['email', 'e-mail', 'mail', 'email address', "candidate's email", 'candidate email', 'participant email', 'student email'],
  name: ['name', 'full name', 'participant', 'participant name', 'student name', "candidate's name", 'candidate name'],
  phone: ['phone', 'phone number', 'number', 'mobile', 'mobile number'],
  status: ['status'],
  timestamp: ['timestamp', 'time stamp'],
  certId: ['cert_id', 'certificate_id', 'cert id', 'certificate id'],
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

function findWorksheet(workbook) {
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

async function loadWorkbookFromPath(workbookPath) {
  const workbook = createWorkbook();
  const fileExtension = path.extname(workbookPath).toLowerCase();

  if (!fs.existsSync(path.dirname(workbookPath))) {
    await fs.promises.mkdir(path.dirname(workbookPath), { recursive: true });
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

    const rawEmail = sanitizeCellValue(row.getCell(headers.email).text || row.getCell(headers.email).value);
    const rawName = sanitizeCellValue(row.getCell(headers.name).text || row.getCell(headers.name).value);
    const phone = sanitizeCellValue(row.getCell(headers.phone).text || row.getCell(headers.phone).value);
    const status = sanitizeCellValue(row.getCell(headers.status).text || row.getCell(headers.status).value).toUpperCase();
    const timestamp = sanitizeCellValue(row.getCell(headers.timestamp).text || row.getCell(headers.timestamp).value);
    const certId = sanitizeCellValue(row.getCell(headers.certId).text || row.getCell(headers.certId).value);

    if (!rawEmail && !rawName && !phone && !status) {
      return;
    }

    const email = smartFixEmailTypo(rawEmail);
    const name = smartFormatName(rawName || rawEmail.split('@')[0] || 'Participant');

    rows.push({
      email,
      name,
      phone,
      certId,
      rowNumber,
      sourcePath: workbookPath,
      status,
      timestamp,
      missingFields: {
        name: !rawName,
        email: !rawEmail,
        phone: !phone,
      },
    });
  });

  return rows;
}

async function updateSheetStatus(sourcePath, rowNumber, status, certId = '', timestamp = formatTimestamp()) {
  try {
    const { headers, workbook, worksheet } = await loadWorkbookFromPath(sourcePath);
    const row = worksheet.getRow(rowNumber);

    row.getCell(headers.status).value = status;
    row.getCell(headers.timestamp).value = timestamp;
    if (certId && headers.certId) {
      row.getCell(headers.certId).value = certId;
    }

    if (path.extname(sourcePath).toLowerCase() === '.csv') {
      await workbook.csv.writeFile(sourcePath);
    } else {
      await workbook.xlsx.writeFile(sourcePath);
    }
  } catch (err) {
    console.error(`Failed to update sheet status for row ${rowNumber}:`, err.message || err);
  }
}

module.exports = {
  loadWorkbookFromPath,
  readRowsFromWorkbookPath,
  updateSheetStatus,
};