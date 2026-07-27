require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { generateCertificateBuffer } = require('./certificateGenerator');
const { processJobRows } = require('./jobRunner');
const { readRowsFromWorkbookPath } = require('./sheets');
const { getCertificate } = require('./verificationStore');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const UPLOAD_DIR = path.join(UPLOAD_ROOT, 'incoming');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

// Security Middleware: Helmet & Rate Limiter
app.use(
  helmet({
    contentSecurityPolicy: false, // Allowed for embedded inline styles & fonts in local dashboard
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/', apiLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

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
    callback(new Error('Only .xlsx, .xlsm, or .csv spreadsheet files are supported.'));
  },
  limits: { fileSize: 25 * 1024 * 1024 },
  storage,
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, app: 'CertiPulse', timestamp: new Date().toISOString() });
});

// Serve Main UI
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Generate PDF Certificate Preview Endpoint
app.post('/api/preview-certificate', async (req, res) => {
  try {
    const { recipientName, eventTitle, certificateSubtitle, issuerName, issueDate, themeColor } = req.body || {};

    const pdfBuffer = await generateCertificateBuffer({
      recipientName: recipientName || 'Jane Doe',
      eventTitle: eventTitle || 'Full-Stack Web Development Workshop',
      certificateSubtitle: certificateSubtitle || 'Certificate of Completion',
      issuerName: issuerName || 'CertiPulse Academy',
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      certId: 'CERT-PREVIEW88',
      verificationUrl: `${config.appBaseUrl}/verify/CERT-PREVIEW88`,
      themeColor: themeColor || '#0f766e',
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Certificate_Preview.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    log('ERROR', 'Failed to generate preview certificate', err.message || err);
    res.status(500).json({ error: 'Failed to generate preview certificate: ' + (err.message || String(err)) });
  }
});

// Get Upload Jobs
app.get('/jobs', (req, res) => {
  res.json(Array.from(jobs.values()).sort((left, right) => right.createdAt - left.createdAt));
});

// Verification API
app.get('/api/verify/:certId', (req, res) => {
  const certId = req.params.certId;
  const cert = getCertificate(certId);
  if (!cert) {
    return res.status(404).json({ valid: false, message: 'Certificate not found' });
  }
  res.json({ valid: true, certificate: cert });
});

// Public Verification Page Route
app.get('/verify/:certId', (req, res) => {
  const certId = req.params.certId;
  const cert = getCertificate(certId);

  const statusText = cert ? 'Authentic Credential' : 'Invalid or Unverified Credential';
  const recipientName = cert ? cert.recipientName : 'Unknown';
  const eventTitle = cert ? cert.eventTitle : 'Unknown Event';
  const issueDate = cert ? cert.issueDate : 'N/A';
  const issuerName = cert ? cert.issuerName : 'N/A';

  const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate Verification — ${certId}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Plus Jakarta Sans', sans-serif; background: #090d16; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
      .card { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px; max-width: 540px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
      .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; margin-bottom: 20px; ${cert ? 'background: rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);' : 'background: rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);'} }
      h1 { margin: 0 0 8px 0; font-size: 1.6rem; }
      p { color: #94a3b8; margin: 0 0 24px 0; font-size: 0.95rem; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: rgba(2,6,23,0.5); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); }
      .item label { font-size: 0.78rem; color: #94a3b8; display: block; }
      .item span { font-size: 1rem; font-weight: 700; color: #fff; }
      .footer { margin-top: 24px; text-align: center; font-size: 0.8rem; color: #64748b; }
      .btn { display: inline-block; margin-top: 20px; width: 100%; padding: 12px; background: #0f766e; color: white; text-align: center; text-decoration: none; font-weight: 700; border-radius: 8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">${statusText}</div>
      <h1>${cert ? 'Verified Certificate' : 'Unverified Certificate'}</h1>
      <p>Official record issued by CertiPulse Credential Platform.</p>

      <div class="grid">
        <div class="item"><label>Certificate ID</label><span>${certId}</span></div>
        <div class="item"><label>Recipient</label><span>${recipientName}</span></div>
        <div class="item"><label>Workshop / Event</label><span>${eventTitle}</span></div>
        <div class="item"><label>Issue Date</label><span>${issueDate}</span></div>
        <div class="item"><label>Issuer</label><span>${issuerName}</span></div>
        <div class="item"><label>Verification Status</label><span style="color:${cert ? '#10b981' : '#ef4444'}">${cert ? 'VERIFIED' : 'INVALID'}</span></div>
      </div>

      <a href="/" class="btn">Return to CertiPulse Platform</a>
      <div class="footer">CertiPulse · Tamper-proof Event Credential Verification</div>
    </div>
  </body>
  </html>`;

  res.type('html').send(html);
});

// Process Batch Upload & Email Dispatch Endpoint
app.post('/upload', upload.single('workbook'), async (req, res) => {
  if (!req.file) {
    res.status(400).send('No spreadsheet file uploaded.');
    return;
  }

  const jobId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const smtpConfig = {
    host: String(req.body.smtpHost || '').trim(),
    port: Number.parseInt(req.body.smtpPort || '', 10) || undefined,
    user: String(req.body.smtpUser || '').trim(),
    pass: String(req.body.smtpPass || '').trim(),
  };

  const certificateOptions = {
    eventTitle: String(req.body.eventTitle || '').trim(),
    certificateSubtitle: String(req.body.certificateSubtitle || '').trim(),
    issuerName: String(req.body.issuerName || '').trim(),
    issueDate: String(req.body.issueDate || '').trim(),
    themeColor: String(req.body.themeColor || '').trim(),
  };

  const emailTemplateOptions = {
    subject: String(req.body.emailSubject || '').trim(),
    bodyHtml: String(req.body.emailBody || '').trim(),
  };

  const job = {
    id: jobId,
    createdAt: Date.now(),
    filePath: req.file.path,
    originalName: req.file.originalname,
    rowsProcessed: 0,
    totalRows: 0,
    status: 'queued',
  };

  jobs.set(jobId, job);

  enqueue(async () => {
    job.status = 'processing';
    try {
      const rows = await readRowsFromWorkbookPath(job.filePath);
      job.totalRows = rows.length;

      const summary = await processJobRows(rows, {
        log: (level, message, details) => log(level, `[${job.originalName}] ${message}`, details),
        smtpConfig,
        certificateOptions,
        emailTemplateOptions,
        appBaseUrl: config.appBaseUrl,
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
  });

  res.status(200).json({ ok: true, jobId, message: 'Spreadsheet uploaded and dispatch queued.' });
});

// Global error handler
app.use((error, req, res, next) => {
  log('ERROR', 'Unhandled request error', error.message || error);
  res.status(400).json({ error: error.message || 'Request failed.' });
});

async function start() {
  app.listen(PORT, () => {
    log('INFO', `🚀 CertiPulse platform running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  log('ERROR', 'Failed to start server', error.message || error);
  process.exitCode = 1;
});