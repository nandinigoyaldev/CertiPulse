const config = require('./config');
const { readSheetData, updateSheetStatus } = require('./sheets');
const { createWhatsAppClient, sendWhatsAppMessage, waitForClientReady } = require('./whatsapp');
const { formatTimestamp, randomDelay, sanitizeCellValue, validatePhone } = require('./utils');

function log(level, message, details) {
  const prefix = `[${new Date().toISOString()}] [${level}]`;

  if (details !== undefined) {
    console.log(prefix, message, details);
    return;
  }

  console.log(prefix, message);
}

function buildWorkshopMessage(name) {
  return `Hi ${sanitizeCellValue(name) || 'there'} 👋\n\nThanks for registering for our workshop.\n\nJoin the official WhatsApp group here:\n${config.groupLink}\n\nPlease join before the session starts.`;
}

function shouldProcessRow(status) {
  const normalizedStatus = sanitizeCellValue(status).toUpperCase();
  return normalizedStatus === '' || normalizedStatus === 'NOT_SENT';
}

function normalizePhoneKey(phone) {
  const validation = validatePhone(phone);
  return validation.isValid ? validation.digits : null;
}

async function processRow(client, row) {
  const phoneCheck = validatePhone(row.phone);

  if (!phoneCheck.isValid) {
    log('WARN', `Skipping row ${row.rowNumber}: invalid phone number for ${row.name}`, row.phone);
    await updateSheetStatus(row.rowNumber, 'FAILED', formatTimestamp());
    return { skipped: true, reason: 'invalid-phone' };
  }

  const message = buildWorkshopMessage(row.name);
  log('INFO', `Sending message to ${row.name} (${phoneCheck.digits})`);

  try {
    await sendWhatsAppMessage(client, row.phone, message, {
      retryCount: config.messageRetryCount,
      retryDelayMs: config.messageRetryDelayMs,
    });

    await updateSheetStatus(row.rowNumber, 'SENT', formatTimestamp());
    log('INFO', `Message sent successfully to ${row.name}`);
    return { skipped: false, success: true };
  } catch (error) {
    await updateSheetStatus(row.rowNumber, 'FAILED', formatTimestamp());
    log('ERROR', `Failed to send message to ${row.name}`, error.message || error);
    return { skipped: false, success: false };
  }
}

async function markDuplicateRow(row) {
  log('WARN', `Skipping duplicate phone number at row ${row.rowNumber}: ${row.phone}`);
  await updateSheetStatus(row.rowNumber, 'SKIPPED_DUPLICATE', formatTimestamp());
}

async function main() {
  log('INFO', 'Starting workshop registration bot');

  const { client, runtimeState } = createWhatsAppClient();

  try {
    const readyPromise = waitForClientReady(client);
    await client.initialize();
    await readyPromise;

    log('INFO', 'Reading rows from the local Excel workbook');
    const rows = await readSheetData();
    log('INFO', `Loaded ${rows.length} row(s) from the workbook`);
    const seenPhones = new Set();

    for (const row of rows) {
      if (runtimeState.disconnected) {
        throw new Error('WhatsApp client disconnected. Stopping the bot to avoid partial sends.');
      }

      if (!shouldProcessRow(row.status)) {
        log('INFO', `Skipping row ${row.rowNumber}: status is ${row.status || 'EMPTY'}`);
        continue;
      }

      const normalizedPhone = normalizePhoneKey(row.phone);

      if (!normalizedPhone) {
        await processRow(client, row);
        continue;
      }

      if (seenPhones.has(normalizedPhone)) {
        await markDuplicateRow(row);
        continue;
      }

      seenPhones.add(normalizedPhone);

      await processRow(client, row);

      if (runtimeState.disconnected) {
        throw new Error('WhatsApp client disconnected while processing rows.');
      }

      log('INFO', `Waiting before the next message for ${row.name}`);
      await randomDelay(config.minDelayMs, config.maxDelayMs);
    }

    log('INFO', 'All eligible rows have been processed');
  } catch (error) {
    log('ERROR', 'Bot execution failed', error.message || error);
    process.exitCode = 1;
  } finally {
    try {
      await client.destroy();
    } catch (destroyError) {
      log('WARN', 'Failed to destroy WhatsApp client cleanly', destroyError.message || destroyError);
    }
  }
}

process.on('unhandledRejection', (error) => {
  log('ERROR', 'Unhandled promise rejection', error.message || error);
  process.exitCode = 1;
});

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception', error.message || error);
  process.exitCode = 1;
});

main();