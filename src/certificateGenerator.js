const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Generate a PDF Certificate Buffer with dynamic fields and QR code verification.
 */
async function generateCertificateBuffer(options = {}) {
  const {
    recipientName = 'John Doe',
    eventTitle = 'Full-Stack Web Development Workshop',
    certificateSubtitle = 'Certificate of Completion',
    issueDate = new Date().toISOString().split('T')[0],
    issuerName = 'CertiPulse Academy',
    certId = 'CERT-DEMO1234',
    verificationUrl = `http://localhost:3000/verify/${certId}`,
    themeColor = '#0f766e', // Teal / Gold accent
    badgeText = 'OFFICIAL CREDENTIAL',
  } = options;

  // Generate QR Code Buffer
  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    margin: 1,
    width: 140,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
  });

  return new Promise((resolve, reject) => {
    // Landscape A4 size (841.89 x 595.28 points)
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const width = 841.89;
    const height = 595.28;

    // Background Gradient / Outer Container
    doc.rect(0, 0, width, height).fill('#faf8f5');

    // Outer Decorative Border Frame
    doc.lineWidth(3).strokeColor(themeColor).rect(20, 20, width - 40, height - 40).stroke();
    doc.lineWidth(1).strokeColor('#cbd5e1').rect(26, 26, width - 52, height - 52).stroke();

    // Inner Elegant Border
    doc.rect(32, 32, width - 64, height - 64).lineWidth(1.5).strokeColor(themeColor).stroke();

    // Top Accent Corner Flourishes
    doc.rect(20, 20, 40, 40).fill(themeColor);
    doc.rect(width - 60, 20, 40, 40).fill(themeColor);
    doc.rect(20, height - 60, 40, 40).fill(themeColor);
    doc.rect(width - 60, height - 60, 40, 40).fill(themeColor);

    // Header Logo / Badge
    doc.fillColor(themeColor).fontSize(14).font('Helvetica-Bold').text(badgeText.toUpperCase(), 0, 65, {
      align: 'center',
      characterSpacing: 2,
    });

    // Main Certificate Subtitle
    doc.fillColor('#334155').fontSize(26).font('Helvetica').text(certificateSubtitle, 0, 95, {
      align: 'center',
    });

    // Decorative Line
    doc.moveTo(width / 2 - 120, 132).lineTo(width / 2 + 120, 132).lineWidth(2).strokeColor(themeColor).stroke();

    // "PROUDLY PRESENTED TO"
    doc.fillColor('#64748b').fontSize(11).font('Helvetica-Bold').text('THIS IS PROUDLY PRESENTED TO', 0, 152, {
      align: 'center',
      characterSpacing: 1.5,
    });

    // Recipient Name (Big & Bold)
    doc.fillColor('#0f172a').fontSize(34).font('Helvetica-Bold').text(recipientName, 0, 180, {
      align: 'center',
    });

    // Underline for Recipient Name
    const nameWidth = Math.min(600, Math.max(300, recipientName.length * 18));
    doc.moveTo((width - nameWidth) / 2, 222).lineTo((width + nameWidth) / 2, 222).lineWidth(1).strokeColor('#94a3b8').stroke();

    // Event Accomplishment Text
    doc.fillColor('#475569').fontSize(13).font('Helvetica').text('for successfully participating in and completing', 0, 242, {
      align: 'center',
    });

    // Event Title
    doc.fillColor(themeColor).fontSize(22).font('Helvetica-Bold').text(eventTitle, 60, 270, {
      align: 'center',
      width: width - 120,
    });

    // Issue Date & Authority Box
    const footerY = 410;

    // Left Column: Issue Date & ID
    doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold').text('ISSUE DATE', 90, footerY);
    doc.fillColor('#1e293b').fontSize(11).font('Helvetica').text(issueDate, 90, footerY + 16);

    doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold').text('CERTIFICATE ID', 90, footerY + 38);
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(certId, 90, footerY + 54);

    // Center Column: Authorized Signature
    doc.moveTo(width / 2 - 90, footerY + 35).lineTo(width / 2 + 90, footerY + 35).lineWidth(1).strokeColor('#cbd5e1').stroke();

    doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(issuerName, width / 2 - 120, footerY + 42, {
      align: 'center',
      width: 240,
    });
    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text('Authorized Organizer', width / 2 - 120, footerY + 60, {
      align: 'center',
      width: 240,
    });

    // Right Column: QR Code & Verification Label
    const qrSize = 75;
    const qrX = width - 180;
    const qrY = footerY - 5;

    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Scan to Verify Authenticity', qrX - 25, qrY + qrSize + 4, {
      align: 'center',
      width: qrSize + 50,
    });

    // Bottom Footer note
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(`Verified by CertiPulse · ${verificationUrl}`, 0, height - 38, {
      align: 'center',
    });

    doc.end();
  });
}

module.exports = {
  generateCertificateBuffer,
};
