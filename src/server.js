require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const AdmZip = require('adm-zip');

const config = require('./config');
const { generateCertificateBuffer } = require('./certificateGenerator');
const { processJobRows } = require('./jobRunner');
const { readRowsFromWorkbookPath } = require('./sheets');
const { getCertificate, revokeCertificate, getAllCertificates } = require('./verificationStore');
const { createEmailTransporter, sendCertificateEmail } = require('./email');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const UPLOAD_DIR = path.join(UPLOAD_ROOT, 'incoming');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/', apiLimiter);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
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
    if (['.xlsx', '.xlsm', '.csv', '.png', '.jpg', '.jpeg'].includes(extension)) {
      callback(null, true);
      return;
    }
    callback(new Error('Only .xlsx, .xlsm, .csv, .png, or .jpg files are supported.'));
  },
  limits: { fileSize: 25 * 1024 * 1024 },
  storage,
});

app.get('/health', (req, res) => {
  res.json({ ok: true, app: 'CertiPulse', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Preview Certificate Endpoint
app.post('/api/preview-certificate', async (req, res) => {
  try {
    const {
      recipientName,
      eventTitle,
      certificateSubtitle,
      issuerName,
      issueDate,
      themeColor,
      customBgDataUrl,
      templatePreset,
      nameY,
      nameSize,
      eventY,
      eventSize,
      showQr,
      qrX,
      qrY,
      qrSize,
    } = req.body || {};

    const pdfBuffer = await generateCertificateBuffer({
      recipientName: recipientName || 'Jane Doe',
      eventTitle: eventTitle || 'Full-Stack Web Development Workshop',
      certificateSubtitle: certificateSubtitle || 'Certificate of Completion',
      issuerName: issuerName || 'CertiPulse Academy',
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      certId: 'CERT-PREVIEW88',
      verificationUrl: `${config.appBaseUrl}/verify/CERT-PREVIEW88`,
      themeColor: themeColor || '#0f766e',
      customBackground: customBgDataUrl || null,
      templatePreset: templatePreset || 'modern',
      layoutSettings: {
        nameY: Number.parseInt(nameY || '200', 10),
        nameSize: Number.parseInt(nameSize || '34', 10),
        eventY: Number.parseInt(eventY || '280', 10),
        eventSize: Number.parseInt(eventSize || '22', 10),
        showQr: String(showQr) !== 'false',
        qrX: Number.parseInt(qrX || '660', 10),
        qrY: Number.parseInt(qrY || '400', 10),
        qrSize: Number.parseInt(qrSize || '80', 10),
      },
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

// List Upload Jobs
app.get('/jobs', (req, res) => {
  res.json(Array.from(jobs.values()).sort((left, right) => right.createdAt - left.createdAt));
});

// Download Certificates ZIP Archive
app.get('/api/jobs/:jobId/download-zip', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  try {
    const rows = await readRowsFromWorkbookPath(job.filePath);
    const zip = new AdmZip();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const certId = row.certId || `CERT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const recipientName = row.name || `Participant_${i + 1}`;

      const pdfBuffer = await generateCertificateBuffer({
        recipientName,
        eventTitle: job.certificateOptions?.eventTitle || 'Workshop & Event Automation',
        certificateSubtitle: job.certificateOptions?.certificateSubtitle || 'Certificate of Completion',
        issueDate: job.certificateOptions?.issueDate || new Date().toISOString().split('T')[0],
        issuerName: job.certificateOptions?.issuerName || 'CertiPulse Organizer',
        certId,
        verificationUrl: `${config.appBaseUrl}/verify/${certId}`,
        themeColor: job.certificateOptions?.themeColor || '#0f766e',
        customBackground: job.certificateOptions?.customBgDataUrl || null,
        templatePreset: job.certificateOptions?.templatePreset || 'modern',
        layoutSettings: job.certificateOptions?.layoutSettings || {},
      });

      const safeFileName = `${sanitizeFilename(recipientName)}_${certId}.pdf`;
      zip.addFile(safeFileName, pdfBuffer);
    }

    const zipBuffer = zip.toBuffer();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="Certificates_${sanitizeFilename(job.originalName)}.zip"`,
      'Content-Length': zipBuffer.length,
    });
    res.send(zipBuffer);
  } catch (err) {
    log('ERROR', 'ZIP download failed', err.message || err);
    res.status(500).json({ error: 'Failed to generate ZIP archive: ' + err.message });
  }
});

// Certificate Registry & Search API
app.get('/api/certificates', (req, res) => {
  const q = String(req.query.q || '').trim();
  const list = getAllCertificates(q);
  res.json(list);
});

// Revoke Certificate API
app.post('/api/certificates/:certId/revoke', (req, res) => {
  const certId = req.params.certId;
  const reason = req.body?.reason || 'Revoked by event organizer';
  const updated = revokeCertificate(certId, reason);
  if (!updated) {
    return res.status(404).json({ error: 'Certificate not found' });
  }
  res.json({ ok: true, certificate: updated });
});

// Resend Certificate Email API
app.post('/api/certificates/:certId/resend', async (req, res) => {
  const certId = req.params.certId;
  const cert = getCertificate(certId, false);
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  try {
    const transporter = createEmailTransporter();
    const verificationUrl = `${config.appBaseUrl}/verify/${cert.certId}`;

    const pdfBuffer = await generateCertificateBuffer({
      recipientName: cert.recipientName,
      eventTitle: cert.eventTitle,
      issueDate: cert.issueDate,
      issuerName: cert.issuerName,
      certId: cert.certId,
      verificationUrl,
    });

    await sendCertificateEmail(transporter, {
      toEmail: cert.recipientEmail,
      toName: cert.recipientName,
      eventTitle: cert.eventTitle,
      pdfBuffer,
      certId: cert.certId,
      verificationUrl,
    });

    res.json({ ok: true, message: `Resent certificate email to ${cert.recipientEmail}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend email: ' + (err.message || String(err)) });
  }
});

// Verification API
app.get('/api/verify/:certId', (req, res) => {
  const certId = req.params.certId;
  const cert = getCertificate(certId);
  if (!cert) {
    return res.status(404).json({ valid: false, message: 'Certificate not found' });
  }
  res.json({ valid: cert.status === 'VERIFIED', certificate: cert });
});

// Public Verification Page
app.get('/verify/:certId', (req, res) => {
  const certId = req.params.certId;
  const cert = getCertificate(certId);

  const isValid = cert && cert.status === 'VERIFIED';
  const isRevoked = cert && cert.status === 'REVOKED';
  const isExpired = cert && cert.status === 'EXPIRED';

  let statusText = 'Invalid or Unverified Credential';
  if (isValid) statusText = 'Authentic Verified Credential';
  if (isRevoked) statusText = 'Revoked Credential';
  if (isExpired) statusText = 'Expired Credential';

  const recipientName = cert ? cert.recipientName : 'Unknown';
  const eventTitle = cert ? cert.eventTitle : 'Unknown Event';
  const issueDate = cert ? cert.issueDate : 'N/A';
  const issuerName = cert ? cert.issuerName : 'N/A';
  const viewCount = cert ? cert.viewCount || 1 : 0;
  const verifyUrl = `${config.appBaseUrl}/verify/${certId}`;

  const linkedinUrl = cert
    ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(eventTitle)}&organizationName=${encodeURIComponent(issuerName)}&issueYear=${issueDate.split('-')[0] || '2026'}&issueMonth=${issueDate.split('-')[1] || '01'}&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(certId)}`
    : '#';

  const twitterUrl = cert
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just verified my official Certificate of Completion for "${eventTitle}" issued by ${issuerName}! 🎓 Check it out:`)}&url=${encodeURIComponent(verifyUrl)}`
    : '#';

  const iframeSnippet = `<iframe src="${verifyUrl}" width="500" height="300" frameborder="0"></iframe>`;

  const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate Verification — ${certId}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;800&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
      .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px; max-width: 580px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
      .badge { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 999px; font-size: 0.82rem; font-weight: 600; margin-bottom: 20px; ${isValid ? 'background:#ecfdf5; color:#10b981; border:1px solid #a7f3d0;' : isRevoked ? 'background:#fef2f2; color:#ef4444; border:1px solid #fecaca;' : 'background:#fffbeb; color:#f59e0b; border:1px solid #fde68a;'} }
      h1 { font-family: 'Plus Jakarta Sans', sans-serif; margin: 0 0 6px 0; font-size: 1.6rem; color: #0f172a; }
      p { color: #64748b; margin: 0 0 20px 0; font-size: 0.9rem; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f1f5f9; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; }
      .item label { font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 2px; }
      .item span { font-size: 0.92rem; font-weight: 600; color: #0f172a; }
      .actions { display: flex; flex-direction: column; gap: 10px; }
      .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 11px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 0.9rem; box-sizing: border-box; cursor: pointer; border: 1px solid transparent; }
      .btn-linkedin { background: #0a66c2; color: white; }
      .btn-twitter { background: #000000; color: white; }
      .btn-secondary { background: #ffffff; color: #0f172a; border-color: #cbd5e1; }
      .btn-secondary:hover { background: #f8fafc; }
      .meta-bar { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: #94a3b8; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">
        <span style="width:6px; height:6px; border-radius:50%; background:${isValid ? '#10b981' : '#ef4444'};"></span>
        ${statusText}
      </div>
      <h1>${isValid ? 'Verified Event Credential' : isRevoked ? 'Credential Revoked' : 'Credential Invalid'}</h1>
      <p>Official tamper-proof credential record issued via CertiPulse Platform.</p>

      <div class="grid">
        <div class="item"><label>Certificate ID</label><span>${certId}</span></div>
        <div class="item"><label>Recipient Name</label><span>${recipientName}</span></div>
        <div class="item"><label>Workshop / Event</label><span>${eventTitle}</span></div>
        <div class="item"><label>Issue Date</label><span>${issueDate}</span></div>
        <div class="item"><label>Issuer / Host</label><span>${issuerName}</span></div>
        <div class="item"><label>Status</label><span style="color:${isValid ? '#10b981' : '#ef4444'}">${cert ? cert.status : 'INVALID'}</span></div>
      </div>

      ${isRevoked && cert.revocationReason ? `<div style="padding:12px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:0.85rem; border-radius:8px; margin-bottom:20px;"><strong>Revocation Reason:</strong> ${cert.revocationReason}</div>` : ''}

      <div class="actions">
        ${isValid ? `
        <a href="${linkedinUrl}" target="_blank" rel="noopener" class="btn btn-linkedin">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
          Add to LinkedIn Profile
        </a>
        <a href="${twitterUrl}" target="_blank" rel="noopener" class="btn btn-twitter">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Share Certificate on X / Twitter
        </a>` : ''}
        <a href="/" class="btn btn-secondary">CertiPulse Platform Dashboard</a>
      </div>

      <div class="meta-bar">
        <span>Verified ${viewCount} time${viewCount === 1 ? '' : 's'}</span>
        <span>Tamper-proof Registry</span>
      </div>
    </div>
  </body>
  </html>`;

  res.type('html').send(html);
});

// Batch Upload Endpoint
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
    customBgDataUrl: String(req.body.customBgDataUrl || '').trim() || null,
    templatePreset: String(req.body.templatePreset || 'modern').trim(),
    layoutSettings: {
      nameY: Number.parseInt(req.body.nameY || '200', 10),
      nameSize: Number.parseInt(req.body.nameSize || '34', 10),
      eventY: Number.parseInt(req.body.eventY || '280', 10),
      eventSize: Number.parseInt(req.body.eventSize || '22', 10),
      showQr: String(req.body.showQr) !== 'false',
      qrX: Number.parseInt(req.body.qrX || '660', 10),
      qrY: Number.parseInt(req.body.qrY || '400', 10),
      qrSize: Number.parseInt(req.body.qrSize || '80', 10),
    },
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
    certificateOptions,
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