const config = require('./config');
const { updateSheetStatus } = require('./sheets');
const { formatTimestamp, randomDelay, sanitizeCellValue, validatePhone } = require('./utils');
const { sendWhatsAppMessage } = require('./whatsapp');

function buildWorkshopMessage(name, groupLink) {
  return `Hi ${sanitizeCellValue(name) || 'there'} 👋\n\nThanks for registering for our workshop.\n\nJoin the official WhatsApp group here:\n${groupLink || config.groupLink}\n\nPlease join before the session starts.`;
}

function normalizePhoneKey(phone) {
  const validation = validatePhone(phone);
  return validation.isValid ? validation.digits : null;
}

function isPriorityRow(row) {
  const normalizedName = sanitizeCellValue(row.name).toLowerCase();
  const normalizedEmail = sanitizeCellValue(row.email).toLowerCase();
  const normalizedPhone = normalizePhoneKey(row.phone);

  return (
    normalizedName === config.priorityName
    || normalizedEmail === config.priorityEmail
    || normalizedPhone === config.priorityPhone
  );
}

function prioritizeRows(rows) {
  const priorityRows = [];
  const remainingRows = [];

  for (const row of rows) {
    if (isPriorityRow(row)) {
      priorityRows.push(row);
      continue;
    }

    remainingRows.push(row);
  }

  return [...priorityRows, ...remainingRows];
}

async function processRow(client, row, log, options = {}) {
  const groupLink = options.groupLink || config.groupLink;
  const phoneCheck = validatePhone(row.phone);

  if (!phoneCheck.isValid) {
    log('WARN', `Skipping row ${row.rowNumber} in ${row.sourcePath}: invalid phone number for ${row.name}`, row.phone);
    await updateSheetStatus(row.sourcePath, row.rowNumber, 'FAILED', formatTimestamp());
    return { skipped: true, reason: 'invalid-phone', recipient: row };
  }

  const message = buildWorkshopMessage(row.name, groupLink);
  log('INFO', `Sending message to ${row.name} (${phoneCheck.digits}) from ${row.sourcePath}`);

  try {
    await sendWhatsAppMessage(client, row.phone, message, {
      retryCount: config.messageRetryCount,
      retryDelayMs: config.messageRetryDelayMs,
    });

    await updateSheetStatus(row.sourcePath, row.rowNumber, 'SENT', formatTimestamp());
    log('INFO', `Message sent successfully to ${row.name} from ${row.sourcePath}`);
    return { skipped: false, success: true, recipient: row };
  } catch (error) {
    await updateSheetStatus(row.sourcePath, row.rowNumber, 'FAILED', formatTimestamp());
    log('ERROR', `Failed to send message to ${row.name} from ${row.sourcePath}`, error.message || error);
    return { skipped: false, success: false, error: error.message || String(error), recipient: row };
  }
}

async function markDuplicateRow(row, log) {
  log('WARN', `Skipping duplicate phone number at row ${row.rowNumber} in ${row.sourcePath}: ${row.phone}`);
  await updateSheetStatus(row.sourcePath, row.rowNumber, 'SKIPPED_DUPLICATE', formatTimestamp());
}

async function processRows(client, rows, options = {}) {
  const log = options.log || ((level, message, details) => console.log(`[${level}] ${message}`, details));
  const orderedRows = prioritizeRows(rows);
  const seenPhones = new Set();
  const groupLink = options.groupLink || config.groupLink;

  const summary = {
    failed: 0,
    invalidPhone: 0,
    processed: 0,
    recipientsNotSent: [],
    skippedDuplicate: 0,
    total: orderedRows.length,
    sent: 0,
  };

  function addNotSent(row, reason, details) {
    summary.recipientsNotSent.push({
      details: details || '',
      email: row.email || '',
      name: row.name || '',
      phone: row.phone || '',
      reason,
      rowNumber: row.rowNumber,
      sourcePath: row.sourcePath,
    });
  }

  for (const row of orderedRows) {
    if (options.shouldStop && options.shouldStop()) {
      throw new Error('Processing stopped by request.');
    }

    const normalizedPhone = normalizePhoneKey(row.phone);

    if (!normalizedPhone) {
      const result = await processRow(client, row, log, { groupLink });
      summary.processed += 1;
      if (result.reason === 'invalid-phone') {
        summary.invalidPhone += 1;
        addNotSent(row, 'invalid-phone', 'Phone number did not match a valid Indian mobile format.');
      } else if (result.success) {
        summary.sent += 1;
      } else {
        summary.failed += 1;
        addNotSent(row, 'failed', result.error || 'Message send failed.');
      }
      continue;
    }

    if (seenPhones.has(normalizedPhone)) {
      await markDuplicateRow(row, log);
      summary.skippedDuplicate += 1;
      addNotSent(row, 'duplicate', 'Duplicate phone number in this run.');
      continue;
    }

    seenPhones.add(normalizedPhone);

    const result = await processRow(client, row, log, { groupLink });
    summary.processed += 1;

    if (result.reason === 'invalid-phone') {
      summary.invalidPhone += 1;
      addNotSent(row, 'invalid-phone', 'Phone number did not match a valid Indian mobile format.');
    } else if (result.success) {
      summary.sent += 1;
    } else {
      summary.failed += 1;
      addNotSent(row, 'failed', result.error || 'Message send failed.');
    }

    log('INFO', `Waiting before the next message for ${row.name}`);
    await randomDelay(config.minDelayMs, config.maxDelayMs);
  }

  return summary;
}

module.exports = {
  processRows,
};