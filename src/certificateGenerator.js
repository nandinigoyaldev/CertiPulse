const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');

/**
 * Advanced PDF Certificate Generator with Custom Background Image & Dynamic QR Code support.
 */
async function generateCertificateBuffer(options = {}) {
  const {
    recipientName = 'Jane Doe',
    eventTitle = 'Full-Stack Web Development Workshop',
    certificateSubtitle = 'Certificate of Completion',
    issueDate = new Date().toISOString().split('T')[0],
    issuerName = 'CertiPulse Academy',
    certId = 'CERT-DEMO1234',
    verificationUrl = `http://localhost:3000/verify/${certId}`,
    themeColor = '#0f766e',
    textColor = '#0f172a',
    badgeText = 'OFFICIAL CREDENTIAL',
    customBackground = null, // Buffer or base64 or file path
    templatePreset = 'modern', // 'modern', 'gold', 'tech', 'classic'
    layoutSettings = {},
  } = options;

  const {
    nameY = 200,
    nameSize = 34,
    eventY = 280,
    eventSize = 22,
    footerY = 410,
    showQr = true,
    qrX = 660,
    qrY = 400,
    qrSize = 80,
  } = layoutSettings;

  // Generate QR Code Buffer
  let qrBuffer = null;
  if (showQr) {
    qrBuffer = await QRCode.toBuffer(verificationUrl, {
      margin: 1,
      width: Math.max(60, qrSize * 2),
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  }

  return new Promise((resolve, reject) => {
    // Standard A4 Landscape: 841.89 x 595.28 points
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

    // Check if custom background image provided
    let hasCustomBg = false;
    if (customBackground) {
      try {
        let bgBuffer = customBackground;
        if (typeof customBackground === 'string') {
          if (customBackground.startsWith('data:image')) {
            const base64Data = customBackground.replace(/^data:image\/\w+;base64,/, '');
            bgBuffer = Buffer.from(base64Data, 'base64');
          } else if (fs.existsSync(customBackground)) {
            bgBuffer = fs.readFileSync(customBackground);
          }
        }
        if (Buffer.isBuffer(bgBuffer)) {
          doc.image(bgBuffer, 0, 0, { width, height });
          hasCustomBg = true;
        }
      } catch (err) {
        console.error('Failed to apply custom background image:', err);
      }
    }

    // Fallback: If no custom image, draw preset background frame
    if (!hasCustomBg) {
      if (templatePreset === 'gold') {
        doc.rect(0, 0, width, height).fill('#fdfbf7');
        doc.lineWidth(4).strokeColor('#b45309').rect(20, 20, width - 40, height - 40).stroke();
        doc.lineWidth(1.5).strokeColor('#d97706').rect(28, 28, width - 56, height - 56).stroke();
      } else if (templatePreset === 'tech') {
        doc.rect(0, 0, width, height).fill('#0f172a');
        doc.lineWidth(3).strokeColor('#38bdf8').rect(20, 20, width - 40, height - 40).stroke();
      } else if (templatePreset === 'classic') {
        doc.rect(0, 0, width, height).fill('#ffffff');
        doc.lineWidth(6).strokeColor('#1e293b').rect(24, 24, width - 48, height - 48).stroke();
      } else {
        // Modern Teal (default)
        doc.rect(0, 0, width, height).fill('#faf8f5');
        doc.lineWidth(3).strokeColor(themeColor).rect(20, 20, width - 40, height - 40).stroke();
        doc.lineWidth(1).strokeColor('#cbd5e1').rect(26, 26, width - 52, height - 52).stroke();
        doc.rect(32, 32, width - 64, height - 64).lineWidth(1.5).strokeColor(themeColor).stroke();

        // Decorative corner accents
        doc.rect(20, 20, 40, 40).fill(themeColor);
        doc.rect(width - 60, 20, 40, 40).fill(themeColor);
        doc.rect(20, height - 60, 40, 40).fill(themeColor);
        doc.rect(width - 60, height - 60, 40, 40).fill(themeColor);
      }

      // Default Top Badge & Header Text
      if (badgeText) {
        doc.fillColor(themeColor).fontSize(14).font('Helvetica-Bold').text(badgeText.toUpperCase(), 0, 65, {
          align: 'center',
          characterSpacing: 2,
        });
      }

      doc.fillColor(templatePreset === 'tech' ? '#f8fafc' : '#334155').fontSize(26).font('Helvetica').text(certificateSubtitle, 0, 95, {
        align: 'center',
      });

      doc.moveTo(width / 2 - 120, 132).lineTo(width / 2 + 120, 132).lineWidth(2).strokeColor(themeColor).stroke();

      doc.fillColor(templatePreset === 'tech' ? '#94a3b8' : '#64748b').fontSize(11).font('Helvetica-Bold').text('THIS IS PROUDLY PRESENTED TO', 0, 155, {
        align: 'center',
        characterSpacing: 1.5,
      });
    }

    // Render Dynamic Recipient Name
    const fontColor = templatePreset === 'tech' && !hasCustomBg ? '#ffffff' : textColor;
    doc.fillColor(fontColor).fontSize(nameSize).font('Helvetica-Bold').text(recipientName, 40, nameY, {
      align: 'center',
      width: width - 80,
    });

    if (!hasCustomBg) {
      // Underline
      const nameWidth = Math.min(600, Math.max(300, recipientName.length * (nameSize * 0.55)));
      doc.moveTo((width - nameWidth) / 2, nameY + nameSize + 10).lineTo((width + nameWidth) / 2, nameY + nameSize + 10).lineWidth(1).strokeColor('#94a3b8').stroke();

      doc.fillColor(templatePreset === 'tech' ? '#cbd5e1' : '#475569').fontSize(13).font('Helvetica').text('for successfully participating in and completing', 0, eventY - 26, {
        align: 'center',
      });
    }

    // Render Dynamic Event Title
    doc.fillColor(themeColor).fontSize(eventSize).font('Helvetica-Bold').text(eventTitle, 60, eventY, {
      align: 'center',
      width: width - 120,
    });

    // Render Footer Details (Issue Date, Issuer Name, Cert ID)
    if (!hasCustomBg) {
      doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold').text('ISSUE DATE', 90, footerY);
      doc.fillColor(fontColor).fontSize(11).font('Helvetica').text(issueDate, 90, footerY + 16);

      doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold').text('CERTIFICATE ID', 90, footerY + 38);
      doc.fillColor(themeColor).fontSize(11).font('Helvetica-Bold').text(certId, 90, footerY + 54);

      // Signature line
      doc.moveTo(width / 2 - 90, footerY + 35).lineTo(width / 2 + 90, footerY + 35).lineWidth(1).strokeColor('#cbd5e1').stroke();
      doc.fillColor(fontColor).fontSize(14).font('Helvetica-Bold').text(issuerName, width / 2 - 120, footerY + 42, {
        align: 'center',
        width: 240,
      });
      doc.fillColor('#64748b').fontSize(10).font('Helvetica').text('Authorized Issuer', width / 2 - 120, footerY + 60, {
        align: 'center',
        width: 240,
      });
    } else {
      // On custom backgrounds, display compact Verification ID & Date at bottom left
      doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text(`ID: ${certId}  |  Date: ${issueDate}`, 40, height - 35);
    }

    // Render Dynamic Scannable QR Code
    if (showQr && qrBuffer) {
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('Scan to Verify', qrX - 15, qrY + qrSize + 3, {
        align: 'center',
        width: qrSize + 30,
      });
    }

    // Global Verification Footer Link
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(`Verified Credential · ${verificationUrl}`, 0, height - 22, {
      align: 'center',
    });

    doc.end();
  });
}

module.exports = {
  generateCertificateBuffer,
};
