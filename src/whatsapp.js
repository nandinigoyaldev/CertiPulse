const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const { delay, validatePhone } = require('./utils');

function createWhatsAppClient() {
  const runtimeState = {
    connected: false,
    disconnected: false,
  };

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: config.whatsappClientId }),
    puppeteer: {
      args: ['--disable-setuid-sandbox', '--no-sandbox'],
      headless: config.whatsappHeadless,
    },
  });

  client.on('qr', (qr) => {
    console.log('\nScan this QR code with WhatsApp to authenticate:\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    runtimeState.connected = true;
    runtimeState.disconnected = false;
    console.log('[WhatsApp] Client is ready.');
  });

  client.on('auth_failure', (message) => {
    runtimeState.disconnected = true;
    runtimeState.connected = false;
    console.error('[WhatsApp] Authentication failed:', message);
  });

  client.on('disconnected', (reason) => {
    runtimeState.disconnected = true;
    runtimeState.connected = false;
    console.error('[WhatsApp] Client disconnected:', reason);
  });

  client.on('change_state', (state) => {
    console.log('[WhatsApp] State changed to:', state);
    if (state === 'CONNECTED') {
      runtimeState.connected = true;
      runtimeState.disconnected = false;
    }
  });

  return { client, runtimeState };
}

function waitForClientReady(client) {
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };

    const onAuthFailure = (message) => {
      cleanup();
      reject(new Error(`WhatsApp authentication failed: ${message}`));
    };

    const onDisconnected = (reason) => {
      cleanup();
      reject(new Error(`WhatsApp disconnected before becoming ready: ${reason}`));
    };

    const cleanup = () => {
      client.off('ready', onReady);
      client.off('auth_failure', onAuthFailure);
      client.off('disconnected', onDisconnected);
    };

    client.once('ready', onReady);
    client.once('auth_failure', onAuthFailure);
    client.once('disconnected', onDisconnected);
  });
}

function isRetryableWhatsAppError(error) {
  const message = String(error && error.message ? error.message : error).toLowerCase();

  return [
    'timed out',
    'timeout',
    'network',
    'socket',
    'econnreset',
    'etag',
    'execution context was destroyed',
  ].some((fragment) => message.includes(fragment));
}

async function sendWhatsAppMessage(client, phone, message, options = {}) {
  const retryCount = Math.max(1, Number(options.retryCount || config.messageRetryCount));
  const retryDelayMs = Math.max(1000, Number(options.retryDelayMs || config.messageRetryDelayMs));
  const validation = validatePhone(phone);

  if (!validation.isValid) {
    const error = new Error(validation.reason);
    error.retryable = false;
    throw error;
  }

  let lastError;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const numberId = await client.getNumberId(validation.digits);

      if (!numberId) {
        const notOnWhatsAppError = new Error(`Phone number ${phone} is not registered on WhatsApp.`);
        notOnWhatsAppError.retryable = false;
        throw notOnWhatsAppError;
      }

      await client.sendMessage(numberId._serialized, message);
      return {
        chatId: numberId._serialized,
        success: true,
      };
    } catch (error) {
      lastError = error;

      if (error && error.retryable === false) {
        throw error;
      }

      if (attempt < retryCount && isRetryableWhatsAppError(error)) {
        console.warn(`[WhatsApp] Send attempt ${attempt} failed. Retrying in ${retryDelayMs}ms...`);
        await delay(retryDelayMs);
        continue;
      }

      break;
    }
  }

  throw lastError;
}

module.exports = {
  createWhatsAppClient,
  sendWhatsAppMessage,
  waitForClientReady,
};