const nodemailer = require('nodemailer');

/**
 * Creates a Nodemailer transport from custom settings or fallback config.
 */
function createEmailTransporter(customSmtp = {}) {
  const host = customSmtp.host || process.env.SMTP_HOST;
  const port = Number.parseInt(customSmtp.port || process.env.SMTP_PORT || '587', 10);
  const user = customSmtp.user || process.env.SMTP_USER;
  const pass = customSmtp.pass || process.env.SMTP_PASS;
  const secure = customSmtp.secure !== undefined ? customSmtp.secure : port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // Fallback: JSON Transport for dry-run / local testing without real credentials
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

/**
 * Helper to replace template placeholders like {{name}}, {{event}}, {{certificate_id}}, {{verification_url}}
 */
function renderTemplate(templateStr, data = {}) {
  let result = String(templateStr || '');
  Object.keys(data).forEach((key) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, data[key] ?? '');
  });
  return result;
}

/**
 * Send a single certificate email to attendee
 */
async function sendCertificateEmail(transporter, options = {}) {
  const {
    fromEmail = process.env.FROM_EMAIL || 'certificates@certipulse.app',
    fromName = process.env.FROM_NAME || 'CertiPulse Credentials',
    toEmail,
    toName,
    subjectTemplate = 'Your Certificate of Completion for {{event}}',
    bodyTemplate,
    pdfBuffer,
    certId,
    eventTitle,
    verificationUrl,
  } = options;

  if (!toEmail || !String(toEmail).includes('@')) {
    throw new Error(`Invalid target email address: "${toEmail}"`);
  }

  const templateData = {
    name: toName || 'Participant',
    event: eventTitle || 'Workshop',
    certificate_id: certId,
    verification_url: verificationUrl,
    date: new Date().toLocaleDateString(),
  };

  const subject = renderTemplate(subjectTemplate, templateData);

  const defaultBodyHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
      <h2 style="color: #0f766e; margin-top: 0;">Congratulations, ${toName}! 🎉</h2>
      <p>Thank you for participating in <strong>${eventTitle}</strong>. We are thrilled to share your official Certificate of Completion.</p>
      <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0;"><strong>Certificate ID:</strong> ${certId}</p>
        <p style="margin: 0;"><strong>Verification Link:</strong> <a href="${verificationUrl}" style="color: #0f766e;">${verificationUrl}</a></p>
      </div>
      <p>Your PDF certificate is attached to this email. You can also share your certificate directly on LinkedIn using the verification link above!</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #64748b; margin: 0;">Issued securely via CertiPulse Certificate Platform.</p>
    </div>
  `;

  const htmlBody = bodyTemplate ? renderTemplate(bodyTemplate, templateData) : defaultBodyHtml;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: `"${toName}" <${toEmail}>`,
    subject,
    html: htmlBody,
    attachments: pdfBuffer
      ? [
          {
            filename: `Certificate_${certId}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : [],
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
}

module.exports = {
  createEmailTransporter,
  renderTemplate,
  sendCertificateEmail,
};
