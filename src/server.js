require('dotenv').config();
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const config = require('./config');
const { createWhatsAppClient, waitForClientReady } = require('./whatsapp');
const { processRows } = require('./jobRunner');
const { readRowsFromWorkbookPath } = require('./sheets');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const UPLOAD_DIR = path.join(UPLOAD_ROOT, 'incoming');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const { client, runtimeState } = createWhatsAppClient();
const readyPromise = waitForClientReady(client);

let queue = Promise.resolve();
const jobs = new Map();

function log(level, message, details) {
  const prefix = `[${new Date().toISOString()}] [${level}]`;

  if (details !== undefined) {
    console.log(prefix, message, details);
    return;
  }

  console.log(prefix, message);
}

function sanitizeFilename(value) {
  return String(value || 'upload')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'upload';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isAuthorized(req) {
  const header = String(req.get('authorization') || req.get('x-admin-token') || req.query.admin_token || '');
  if (!header) return false;
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim() === ADMIN_TOKEN;
  return header.trim() === ADMIN_TOKEN;
}

function renderJob(job) {
  const notSent = job.summary?.recipientsNotSent || [];
  const notSentHtml = notSent.length
    ? `
      <div class="unsent">
        <div class="unsent-title">Didn’t send to ${notSent.length} people</div>
        <ul>${notSent.slice(0, 12).map((entry) => `
          <li>
            <strong>${escapeHtml(entry.name || entry.phone || 'Unknown')}</strong>
            <span>${escapeHtml(entry.reason)}</span>
            <small>${escapeHtml(entry.phone || '')}${entry.details ? ` · ${escapeHtml(entry.details)}` : ''}</small>
          </li>
        `).join('')}</ul>
      </div>
    `
    : '';

  const summary = job.summary
    ? `<div class="summary">Sent ${job.summary.sent} | Failed ${job.summary.failed} | Invalid ${job.summary.invalidPhone} | Duplicates ${job.summary.skippedDuplicate} | Unsent ${notSent.length}</div>`
    : '';

  return `
    <article class="job ${job.status}">
      <div class="job-top">
        <div>
          <h3>${escapeHtml(job.originalName)}</h3>
          <p>${escapeHtml(job.status)}</p>
        </div>
        <span>${job.rowsProcessed ?? 0} rows</span>
      </div>
      <div class="meta">${escapeHtml(job.filePath)}</div>
      ${summary}
      ${notSentHtml}
      ${job.error ? `<div class="error">${escapeHtml(job.error)}</div>` : ''}
    </article>
  `;
}

function renderPage() {
  const jobsHtml = Array.from(jobs.values())
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 8)
    .map(renderJob)
    .join('') || '<div class="empty">No uploads yet. Drop a spreadsheet to start.</div>';

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Workshop Invite Bot</title>
    <style>
      :root { color-scheme: light; --bg: #f4efe7; --panel: rgba(255,255,255,.78); --ink: #171717; --muted: #5e5a52; --accent: #0f766e; --accent-2: #b45309; --line: rgba(23,23,23,.09); }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: radial-gradient(circle at top left, #fff8e6 0, transparent 32%), radial-gradient(circle at top right, #d7f3ef 0, transparent 24%), linear-gradient(180deg, #f8f4ec 0%, #f4efe7 100%); color: var(--ink); }
      .wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 56px; }
      .hero { display: grid; gap: 18px; grid-template-columns: 1.45fr .95fr; align-items: end; margin-bottom: 26px; }
      .eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .16em; color: var(--accent); font-weight: 700; }
      h1 { margin: 10px 0 12px; font-size: clamp(2.4rem, 5vw, 4.8rem); line-height: .94; letter-spacing: -.05em; }
      .lede { margin: 0; font-size: 1.05rem; line-height: 1.6; max-width: 58ch; color: var(--muted); }
      .panel { background: var(--panel); backdrop-filter: blur(18px); border: 1px solid var(--line); border-radius: 24px; box-shadow: 0 30px 70px rgba(23,23,23,.08); }
      .upload { padding: 20px; display: grid; gap: 14px; }
      .upload label { font-weight: 700; }
      .upload input[type=file] { width: 100%; padding: 14px; border: 1px dashed rgba(23,23,23,.22); border-radius: 16px; background: rgba(255,255,255,.66); }
      .upload button { border: 0; border-radius: 999px; padding: 14px 20px; background: linear-gradient(135deg, var(--accent), #14532d); color: white; font-weight: 700; cursor: pointer; }
      .upload small { color: var(--muted); line-height: 1.5; }
      .status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0 28px; }
      .stat { padding: 16px; }
      .stat .value { font-size: 1.7rem; font-weight: 800; margin-top: 4px; }
      .stat .label { color: var(--muted); font-size: .9rem; }
      .section-title { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 28px 2px 14px; }
      .jobs { display: grid; gap: 12px; }
      .job { padding: 18px; }
      .job h3 { margin: 0 0 4px; font-size: 1rem; }
      .job p, .meta { margin: 0; color: var(--muted); }
      .job-top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .summary, .error { margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.7); border: 1px solid var(--line); font-size: .92rem; }
      .error { color: #9a3412; }
      .unsent { margin-top: 10px; padding: 12px; border-radius: 14px; border: 1px solid rgba(185,28,28,.12); background: rgba(254,242,242,.8); }
      .unsent-title { font-weight: 700; margin-bottom: 10px; color: #991b1b; }
      .unsent ul { margin: 0; padding-left: 18px; display: grid; gap: 8px; }
      .unsent li { display: grid; gap: 2px; }
      .unsent span, .unsent small { color: var(--muted); }
      .empty { padding: 24px; color: var(--muted); }
      .processing { outline: 2px solid rgba(15,118,110,.25); }
      .done { }
      .failed { outline: 2px solid rgba(185,28,28,.2); }
      @media (max-width: 860px) { .hero { grid-template-columns: 1fr; } .status-grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="hero">
        <div>
          <div class="eyebrow">Workshop Invite Bot</div>
          <h1>Upload a spreadsheet and let the bot send the WhatsApp invite.</h1>
          <p class="lede">Drop an Excel or CSV file, and the backend will read every valid mobile number, send the group invite message, and update the sheet with delivery status.</p>
        </div>
        <div class="panel upload">
          <form action="/upload" method="post" enctype="multipart/form-data">
            <label for="workbook">Upload workbook</label>
            <input id="workbook" name="workbook" type="file" accept=".xlsx,.xlsm,.csv" required />
            <label for="groupLink">WhatsApp group invite link</label>
            <input id="groupLink" name="groupLink" type="url" placeholder="https://chat.whatsapp.com/..." />
            <button type="submit">Upload and process</button>
          </form>
          <small>Leave the group link empty to use the default in `.env`. WhatsApp must stay logged in on this machine. If the session is new, scan the QR once in the terminal and uploads will keep working after that.</small>
        </div>
      </section>

      <section class="status-grid">
        <div class="panel stat"><div class="label">WhatsApp</div><div class="value">${runtimeState.connected ? 'Ready' : 'Starting'}</div></div>
        <div class="panel stat"><div class="label">Queued jobs</div><div class="value">${Array.from(jobs.values()).filter((job) => job.status === 'queued' || job.status === 'processing').length}</div></div>
        <div class="panel stat"><div class="label">Processed uploads</div><div class="value">${jobs.size}</div></div>
      </section>

      <div class="section-title">
        <h2 style="margin:0">Recent uploads</h2>
        <span style="color:var(--muted)">Processing happens automatically after upload</span>
      </div>
      <section class="jobs">${jobsHtml}</section>
      <footer style="margin-top:28px; text-align:center; color:var(--muted); font-size:0.95rem;">
        <div style="margin-top:18px;">Made with ❤️ — connect:</div>
        <div style="display:flex; gap:12px; justify-content:center; margin-top:8px;">
          <a href="https://instagram.com/self_taught_bob" target="_blank" rel="noreferrer">Instagram</a>
          <a href="https://github.com/goyaljiiiiii" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://www.youtube.com/@self_taught_bob" target="_blank" rel="noreferrer">YouTube</a>
        </div>
      </footer>
    </div>
  </body>
  </html>`;
}

function enqueue(task) {
  const next = queue.then(task);
  queue = next.catch(() => {});
  return next;
}

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname);
    const baseName = sanitizeFilename(path.basename(file.originalname, extension));
    callback(null, `${Date.now()}-${baseName}${extension.toLowerCase()}`);
  },
});

const upload = multer({
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xlsm', '.csv'].includes(extension)) {
      callback(null, true);
      return;
    }

    callback(new Error('Only .xlsx, .xlsm, or .csv files are supported.'));
  },
  limits: { fileSize: 25 * 1024 * 1024 },
  storage,
});

app.get('/', (req, res) => {
  if (ADMIN_TOKEN && !isAuthorized(req)) {
    res.set('WWW-Authenticate', 'Bearer realm="Upload UI"');
    res.status(401).send('Unauthorized');
    return;
  }

  res.type('html').send(renderPage());
});

app.get('/jobs', (req, res) => {
  if (ADMIN_TOKEN && !isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json(Array.from(jobs.values()).sort((left, right) => right.createdAt - left.createdAt));
});

app.get('/health', (req, res) => {
  res.json({ ok: true, connected: !!runtimeState.connected });
});

app.post('/upload', upload.single('workbook'), (req, res, next) => {
  if (ADMIN_TOKEN && !isAuthorized(req)) {
    res.status(401).send('Unauthorized');
    return;
  }

  if (!req.file) {
    res.status(400).send('No workbook uploaded.');
    return;
  }

  const jobId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const job = {
    createdAt: Date.now(),
    filePath: req.file.path,
    id: jobId,
    originalName: req.file.originalname,
    rowsProcessed: 0,
    status: 'queued',
    groupLink: String(req.body.groupLink || '').trim() || config.groupLink,
  };

  jobs.set(jobId, job);

  enqueue(async () => {
    job.status = 'processing';
    try {
      await readyPromise;
      const rows = await readRowsFromWorkbookPath(job.filePath);
      const summary = await processRows(client, rows, {
        log: (level, message, details) => log(level, `[${job.originalName}] ${message}`, details),
        groupLink: job.groupLink,
        shouldStop: () => runtimeState.disconnected,
      });

      job.rowsProcessed = summary.total;
      job.summary = summary;
      job.status = 'done';
      job.finishedAt = Date.now();
      log('INFO', `Upload job completed for ${job.originalName}`, summary);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message || String(error);
      job.finishedAt = Date.now();
      log('ERROR', `Upload job failed for ${job.originalName}`, job.error);
    }
  }).catch((error) => {
    job.status = 'failed';
    job.error = error.message || String(error);
    job.finishedAt = Date.now();
  });

  res.redirect('/');
});

app.use((error, req, res, next) => {
  log('ERROR', 'Request failed', error.message || error);
  res.status(400).send(error.message || 'Upload failed.');
});

async function start() {
  app.listen(PORT, () => {
    log('INFO', `Web upload bot listening on http://localhost:${PORT}`);
  });

  await client.initialize();
}

start().catch((error) => {
  log('ERROR', 'Failed to start web server', error.message || error);
  process.exitCode = 1;
});