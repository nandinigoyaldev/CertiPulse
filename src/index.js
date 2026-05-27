const { readSheetData } = require('./sheets');
const { createWhatsAppClient, waitForClientReady } = require('./whatsapp');
const { processRows } = require('./jobRunner');

function log(level, message, details) {
  const prefix = `[${new Date().toISOString()}] [${level}]`;

  if (details !== undefined) {
    console.log(prefix, message, details);
    return;
  }

  console.log(prefix, message);
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
    const summary = await processRows(client, rows, {
      log,
      shouldStop: () => runtimeState.disconnected,
    });

    log('INFO', 'Processing summary', summary);

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