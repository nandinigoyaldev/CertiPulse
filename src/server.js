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
const {
  getCertificate,
  revokeCertificate,
  getAllCertificates,
  getAnalyticsSummary,
  getOpenBadge3Metadata,
  trackShare,
} = require('./verificationStore');
const { createEmailTransporter, sendCertificateEmail } = require('./email');

const os = require('os');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);
let UPLOAD_ROOT = isVercel ? path.join(os.tmpdir(), 'uploads') : path.resolve(process.cwd(), 'uploads');
let UPLOAD_DIR = path.join(UPLOAD_ROOT, 'incoming');

try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  UPLOAD_ROOT = path.join(os.tmpdir(), 'uploads');
  UPLOAD_DIR = path.join(UPLOAD_ROOT, 'incoming');
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (ignored) {}
}

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

// Analytics Overview API
app.get('/api/analytics', (req, res) => {
  res.json(getAnalyticsSummary());
});

// Certificate Registry & Search API
app.get('/api/certificates', (req, res) => {
  const q = String(req.query.q || '').trim();
  const list = getAllCertificates(q);
  res.json(list);
});

// Open Badges 3.0 / W3C Verifiable Credentials Endpoint
app.get('/api/certificates/:certId/badge.json', (req, res) => {
  const badge = getOpenBadge3Metadata(req.params.certId, config.appBaseUrl);
  if (!badge) {
    return res.status(404).json({ error: 'Certificate not found' });
  }
  res.setHeader('Content-Type', 'application/json');
  res.json(badge);
});

// Track Social Share API
app.post('/api/certificates/:certId/track-share', (req, res) => {
  const platform = req.body?.platform || 'general';
  const updated = trackShare(req.params.certId, platform);
  if (!updated) {
    return res.status(404).json({ error: 'Certificate not found' });
  }
  res.json({ ok: true, shareCount: updated.shareCount });
});

// Direct Certificate PDF Download Endpoint
app.get('/api/certificates/:certId/pdf', async (req, res) => {
  const certId = req.params.certId;
  const cert = getCertificate(certId, false);
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  try {
    const verificationUrl = `${config.appBaseUrl}/verify/${cert.certId}`;
    const pdfBuffer = await generateCertificateBuffer({
      recipientName: cert.recipientName,
      eventTitle: cert.eventTitle,
      issueDate: cert.issueDate,
      issuerName: cert.issuerName,
      certId: cert.certId,
      verificationUrl,
    });

    const fileName = `${sanitizeFilename(cert.recipientName)}_${cert.certId}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF download: ' + err.message });
  }
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

// Public Verification Page (10/10 Responsive Dark Slate UI)
app.get('/verify/:certId', (req, res) => {
  const certId = req.params.certId;
  const cert = getCertificate(certId);

  const isValid = cert && cert.status === 'VERIFIED';
  const isRevoked = cert && cert.status === 'REVOKED';
  const isExpired = cert && cert.status === 'EXPIRED';

  let statusBadgeColor = 'linear-gradient(135deg, #10b981, #059669)';
  let statusText = 'Authentic Verified Credential';
  if (isRevoked) {
    statusBadgeColor = 'linear-gradient(135deg, #ef4444, #dc2626)';
    statusText = 'Credential Revoked';
  } else if (isExpired) {
    statusBadgeColor = 'linear-gradient(135deg, #f59e0b, #d97706)';
    statusText = 'Credential Expired';
  } else if (!cert) {
    statusBadgeColor = 'linear-gradient(135deg, #64748b, #475569)';
    statusText = 'Unverified Credential';
  }

  const recipientName = cert ? cert.recipientName : 'Unknown Recipient';
  const eventTitle = cert ? cert.eventTitle : 'Unknown Event';
  const issueDate = cert ? cert.issueDate : 'N/A';
  const issuerName = cert ? cert.issuerName : 'N/A';
  const fingerprintHash = cert ? cert.fingerprintHash || 'N/A' : 'N/A';
  const viewCount = cert ? cert.viewCount || 1 : 0;
  const shareCount = cert ? cert.shareCount || 0 : 0;

  const verifyUrl = `${config.appBaseUrl}/verify/${certId}`;
  const pdfDownloadUrl = `/api/certificates/${certId}/pdf`;
  const badgeJsonUrl = `/api/certificates/${certId}/badge.json`;

  const linkedinUrl = cert
    ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(eventTitle)}&organizationName=${encodeURIComponent(issuerName)}&issueYear=${issueDate.split('-')[0] || '2026'}&issueMonth=${issueDate.split('-')[1] || '01'}&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(certId)}`
    : '#';

  const twitterUrl = cert
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I am proud to share my verified Certificate of Completion for "${eventTitle}" issued by ${issuerName}! 🎓 Check it out:`)}&url=${encodeURIComponent(verifyUrl)}`
    : '#';

  const whatsappUrl = cert
    ? `https://api.whatsapp.com/send?text=${encodeURIComponent(`Hey! Check out my official Certificate of Completion for "${eventTitle}": ${verifyUrl}`)}`
    : '#';

  const iframeSnippet = `<iframe src="${verifyUrl}" width="560" height="400" frameborder="0"></iframe>`;

  const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verified Credential — ${recipientName} | CertiPulse</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg-dark: #0b0f17;
        --card-bg: rgba(17, 24, 39, 0.75);
        --card-border: rgba(255, 255, 255, 0.1);
        --text-primary: #f8fafc;
        --text-secondary: #94a3b8;
        --accent-teal: #10b981;
        --accent-blue: #38bdf8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 40px 16px;
        font-family: 'Inter', sans-serif;
        background: var(--bg-dark);
        background-image: 
          radial-gradient(at 15% 15%, rgba(16, 185, 129, 0.12) 0px, transparent 50%),
          radial-gradient(at 85% 85%, rgba(56, 189, 248, 0.12) 0px, transparent 50%);
        color: var(--text-primary);
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .verify-container {
        width: 100%;
        max-width: 640px;
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: 20px;
        padding: 36px;
        backdrop-filter: blur(16px);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }
      .badge-header {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 9999px;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #ffffff;
        background: ${statusBadgeColor};
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        margin-bottom: 24px;
      }
      h1 {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 1.75rem;
        font-weight: 800;
        margin: 0 0 6px 0;
        background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .subtitle {
        color: var(--text-secondary);
        font-size: 0.92rem;
        margin: 0 0 28px 0;
      }
      .data-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 20px;
        margin-bottom: 28px;
      }
      .grid-item label {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .grid-item span {
        font-size: 0.98rem;
        font-weight: 600;
        color: #ffffff;
      }
      .hash-box {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 28px;
        font-family: monospace;
        font-size: 0.78rem;
        color: #a7f3d0;
        word-break: break-all;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .hash-box label {
        font-family: 'Inter', sans-serif;
        font-size: 0.7rem;
        color: var(--text-secondary);
        text-transform: uppercase;
      }
      .actions-flex {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 12px 20px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 0.92rem;
        text-decoration: none;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
      }
      .btn-download {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
      }
      .btn-download:hover { transform: translateY(-1px); opacity: 0.95; }
      .btn-linkedin { background: #0a66c2; color: #ffffff; }
      .btn-twitter { background: #000000; color: #ffffff; border: 1px solid #334155; }
      .btn-whatsapp { background: #25d366; color: #ffffff; }
      .btn-secondary { background: rgba(255, 255, 255, 0.06); color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.1); }
      .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
      .share-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .embed-box {
        margin-top: 24px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 14px;
      }
      .embed-box summary { font-size: 0.82rem; color: var(--text-secondary); cursor: pointer; font-weight: 600; }
      .embed-box input { width: 100%; margin-top: 10px; background: #000000; border: 1px solid #334155; color: #38bdf8; font-family: monospace; font-size: 0.78rem; padding: 8px; border-radius: 6px; }
      .meta-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 28px;
        padding-top: 18px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
    </style>
  </head>
  <body>
    <div class="verify-container">
      <div class="badge-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
        ${statusText}
      </div>

      <h1>${isValid ? 'Verified Certificate' : isRevoked ? 'Certificate Revoked' : 'Credential Record'}</h1>
      <p class="subtitle">Official cryptographic record registered on CertiPulse Platform.</p>

      <div class="data-grid">
        <div class="grid-item"><label>Certificate ID</label><span>${certId}</span></div>
        <div class="grid-item"><label>Recipient Name</label><span>${recipientName}</span></div>
        <div class="grid-item"><label>Event / Workshop</label><span>${eventTitle}</span></div>
        <div class="grid-item"><label>Issue Date</label><span>${issueDate}</span></div>
        <div class="grid-item"><label>Issuer / Host</label><span>${issuerName}</span></div>
        <div class="grid-item"><label>Verification Views</label><span>${viewCount} scan${viewCount === 1 ? '' : 's'}</span></div>
      </div>

      <div class="hash-box">
        <label>🔒 SHA-256 Cryptographic Fingerprint Hash</label>
        <span>${fingerprintHash}</span>
      </div>

      ${isRevoked && cert.revocationReason ? `<div style="padding:14px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; font-size:0.85rem; border-radius:10px; margin-bottom:24px;"><strong>Revocation Reason:</strong> ${cert.revocationReason}</div>` : ''}

      <div class="actions-flex">
        ${isValid ? `
        <a href="${pdfDownloadUrl}" class="btn btn-download" target="_blank">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download PDF Certificate
        </a>

        <div class="share-row">
          <a href="${linkedinUrl}" target="_blank" rel="noopener" class="btn btn-linkedin">
            LinkedIn
          </a>
          <a href="${twitterUrl}" target="_blank" rel="noopener" class="btn btn-twitter">
            X / Twitter
          </a>
          <a href="${whatsappUrl}" target="_blank" rel="noopener" class="btn btn-whatsapp">
            WhatsApp
          </a>
        </div>
        ` : ''}

        <a href="${badgeJsonUrl}" target="_blank" class="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Open Badges 3.0 W3C JSON Metadata
        </a>
      </div>

      <details class="embed-box">
        <summary>⚡ Embed Badge Code (Website / Portfolio)</summary>
        <input type="text" readonly value="${iframeSnippet.replace(/"/g, '&quot;')}" onclick="this.select()">
      </details>

      <div class="meta-footer">
        <span>CertiPulse Credential Engine v2.0</span>
        <span>${shareCount} Social Shares</span>
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
  const server = app.listen(PORT, () => {
    log('INFO', `🚀 CertiPulse platform running at http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log('ERROR', `Port ${PORT} is already in use by another process.`);
      log('INFO', `To kill the process using port ${PORT}, run: npx kill-port ${PORT} or kill $(lsof -t -i:${PORT})`);
      process.exit(1);
    } else {
      log('ERROR', 'Server encountered error:', err.message || err);
    }
  });

  return server;
}

if (require.main === module && !isVercel) {
  start().catch((error) => {
    log('ERROR', 'Failed to start server', error.message || error);
    process.exitCode = 1;
  });
}

module.exports = app;