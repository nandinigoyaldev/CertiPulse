const { generateCertificateBuffer } = require('./certificateGenerator');
const { createEmailTransporter, sendCertificateEmail } = require('./email');
const { updateSheetStatus } = require('./sheets');
const { registerCertificate } = require('./verificationStore');
const config = require('./config');

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJobRows(rows, options = {}) {
  const {
    log = console.log,
    smtpConfig = {},
    certificateOptions = {},
    emailTemplateOptions = {},
    appBaseUrl = config.appBaseUrl,
  } = options;

  const transporter = createEmailTransporter(smtpConfig);
  const seenEmails = new Set();

  const summary = {
    total: rows.length,
    sent: 0,
    failed: 0,
    skippedDuplicate: 0,
    invalidEmail: 0,
    recipientsNotSent: [],
  };

  log('INFO', `Starting job execution for ${rows.length} rows`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawEmail = (row.email || '').trim().toLowerCase();
    const recipientName = (row.name || 'Participant').trim();

    if (!isValidEmail(rawEmail)) {
      summary.invalidEmail++;
      summary.failed++;
      summary.recipientsNotSent.push({
        name: recipientName,
        email: rawEmail,
        reason: 'Invalid email address format',
      });
      await updateSheetStatus(row.sourcePath, row.rowNumber, 'FAILED_INVALID_EMAIL');
      continue;
    }

    const recipientKey = `${recipientName.toLowerCase()}:${rawEmail}`;
    if (seenEmails.has(recipientKey)) {
      summary.skippedDuplicate++;
      summary.recipientsNotSent.push({
        name: recipientName,
        email: rawEmail,
        reason: 'Duplicate recipient entry in upload batch',
      });
      await updateSheetStatus(row.sourcePath, row.rowNumber, 'SKIPPED_DUPLICATE');
      continue;
    }

    seenEmails.add(recipientKey);

    try {
      // 1. Register certificate record in verification store
      const certRecord = registerCertificate({
        recipientName,
        recipientEmail: rawEmail,
        eventTitle: certificateOptions.eventTitle || '',
        issueDate: certificateOptions.issueDate || new Date().toISOString().split('T')[0],
        issuerName: certificateOptions.issuerName || '',
        extraData: {
          phone: row.phone || null,
          customBgDataUrl: certificateOptions.customBgDataUrl || null,
          templatePreset: certificateOptions.templatePreset || 'modern',
          themeColor: certificateOptions.themeColor || '#e05638',
          layoutSettings: certificateOptions.layoutSettings || {},
        },
      });

      const verificationUrl = `${appBaseUrl.replace(/\/$/, '')}/verify/${certRecord.certId}`;

      // 2. Generate PDF Certificate
      const pdfBuffer = await generateCertificateBuffer({
        recipientName,
        eventTitle: certificateOptions.eventTitle || '',
        certificateSubtitle: certificateOptions.certificateSubtitle || '',
        issueDate: certRecord.issueDate,
        issuerName: certRecord.issuerName,
        certId: certRecord.certId,
        verificationUrl,
        themeColor: certificateOptions.themeColor || '#e05638',
        customBackground: certificateOptions.customBgDataUrl || null,
        templatePreset: certificateOptions.templatePreset || 'modern',
        layoutSettings: certificateOptions.layoutSettings || {},
      });

      // 3. Send Email with PDF Attachment
      await sendCertificateEmail(transporter, {
        fromEmail: smtpConfig.fromEmail || config.fromEmail,
        fromName: smtpConfig.fromName || config.fromName,
        toEmail: rawEmail,
        toName: recipientName,
        subjectTemplate: emailTemplateOptions.subject || 'Your Certificate of Completion for {{event}}',
        bodyTemplate: emailTemplateOptions.bodyHtml || null,
        pdfBuffer,
        certId: certRecord.certId,
        eventTitle: certificateOptions.eventTitle || 'Workshop & Event Automation',
        verificationUrl,
      });

      summary.sent++;
      log('INFO', `[${i + 1}/${rows.length}] Certificate sent successfully to ${recipientName} (${rawEmail}) [ID: ${certRecord.certId}]`);

      await updateSheetStatus(row.sourcePath, row.rowNumber, 'SENT', certRecord.certId);
    } catch (err) {
      summary.failed++;
      const errorMessage = err.message || String(err);
      log('ERROR', `Failed to process row ${row.rowNumber} (${rawEmail}): ${errorMessage}`);

      summary.recipientsNotSent.push({
        name: recipientName,
        email: rawEmail,
        reason: 'Email dispatch error',
        details: errorMessage,
      });

      await updateSheetStatus(row.sourcePath, row.rowNumber, 'FAILED');
    }

    // Delay between email sends to adhere to rate limits and prevent spam blocks
    if (i < rows.length - 1) {
      const delayMs = Math.floor(Math.random() * (config.maxDelayMs - config.minDelayMs + 1)) + config.minDelayMs;
      await delay(delayMs);
    }
  }

  log('INFO', 'Job execution finished', summary);
  return summary;
}

module.exports = {
  processJobRows,
  isValidEmail,
};