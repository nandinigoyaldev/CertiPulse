const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

/**
 * Advanced PDF Certificate Generator.
 * Strictly synchronized with HTML Canvas rendering engine.
 */
async function generateCertificateBuffer(options = {}) {
  const {
    recipientName = 'Jane Doe',
    eventTitle = '',
    certificateSubtitle = '',
    issueDate = new Date().toISOString().split('T')[0],
    issuerName = '',
    certId = 'CERT-DEMO1234',
    verificationUrl = `http://localhost:3000/verify/${certId}`,
    themeColor = '#e05638',
    textColor = '#1a1d20',
    badgeText = 'OFFICIAL CREDENTIAL',
    customBackground = null,
    templatePreset = 'modern',
    layoutSettings = {},
  } = options;

  const {
    showName = true,
    nameY = 230,
    nameSize = 34,

    showQr = true,
    qrX = 680,
    qrY = 430,
    qrSize = 80,

    showEvent = false,
    eventY = 310,
    eventSize = 20,

    showSubtitle = false,
    showBadge = false,
    showFooter = false,
    footerY = 460,

    customLayers = [],
  } = layoutSettings;

  // Generate QR Code Buffer
  let qrBuffer = null;
  if (showQr) {
    qrBuffer = await QRCode.toBuffer(verificationUrl, {
      margin: 1,
      width: Math.max(60, qrSize * 2),
      color: {
        dark: '#1a1d20',
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
          } else {
            const publicPath = path.resolve(process.cwd(), 'public', customBackground.replace(/^\//, ''));
            if (fs.existsSync(publicPath)) {
              bgBuffer = fs.readFileSync(publicPath);
            } else if (fs.existsSync(customBackground)) {
              bgBuffer = fs.readFileSync(customBackground);
            }
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

    // Fallback: If no custom background, render preset background frame
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
        doc.lineWidth(6).strokeColor('#1a1d20').rect(24, 24, width - 48, height - 48).stroke();
      } else {
        // Modern Terracotta (default)
        doc.rect(0, 0, width, height).fill('#faf8f5');
        doc.lineWidth(4).strokeColor(themeColor).rect(20, 20, width - 40, height - 40).stroke();
        doc.lineWidth(1.5).strokeColor('#1a1d20').rect(28, 28, width - 56, height - 56).stroke();

        // Decorative corner accents
        doc.rect(20, 20, 36, 36).fill(themeColor);
        doc.rect(width - 56, 20, 36, 36).fill(themeColor);
        doc.rect(20, height - 56, 36, 36).fill(themeColor);
        doc.rect(width - 56, height - 56, 36, 36).fill(themeColor);
      }

      // Header Badge (Only if enabled)
      if (showBadge && badgeText) {
        doc.fillColor(themeColor).fontSize(14).font('Helvetica-Bold').text(badgeText.toUpperCase(), 0, 65, {
          align: 'center',
          characterSpacing: 2,
        });
      }

      // Subtitle (Only if enabled)
      if (showSubtitle && certificateSubtitle) {
        doc.fillColor(templatePreset === 'tech' ? '#f8fafc' : '#1a1d20').fontSize(24).font('Helvetica-Bold').text(certificateSubtitle, 0, 95, {
          align: 'center',
        });
        doc.moveTo(width / 2 - 100, 126).lineTo(width / 2 + 100, 126).lineWidth(2).strokeColor(themeColor).stroke();
        doc.fillColor(templatePreset === 'tech' ? '#94a3b8' : '#5a6065').fontSize(11).font('Helvetica-Bold').text('THIS IS PROUDLY PRESENTED TO', 0, 150, {
          align: 'center',
        });
      }
    }

    // 1. Recipient Name (Only if enabled)
    if (showName && recipientName) {
      const fontColor = templatePreset === 'tech' && !hasCustomBg ? '#ffffff' : textColor;
      doc.fillColor(fontColor).fontSize(nameSize).font('Helvetica-Bold').text(recipientName, 40, nameY, {
        align: 'center',
        width: width - 80,
      });
    }

    // 2. Event Title (Only if enabled)
    if (showEvent && eventTitle) {
      doc.fillColor(themeColor).fontSize(eventSize).font('Helvetica-Bold').text(eventTitle, 60, eventY, {
        align: 'center',
        width: width - 120,
      });
    }

    // 3. Custom Text Layers
    if (Array.isArray(customLayers)) {
      customLayers.forEach((layer) => {
        if (!layer.text) return;
        const textToRender = layer.text
          .replace(/\{\{\s*name\s*\}\}/gi, recipientName)
          .replace(/\{\{\s*event\s*\}\}/gi, eventTitle)
          .replace(/\{\{\s*issuer\s*\}\}/gi, issuerName)
          .replace(/\{\{\s*date\s*\}\}/gi, issueDate)
          .replace(/\{\{\s*cert_id\s*\}\}/gi, certId)
          .replace(/\{\{\s*certid\s*\}\}/gi, certId);

        const alignment = layer.align || 'center';
        const xPos = layer.x !== undefined ? Number(layer.x) : 40;
        const textWidth = alignment === 'left' || alignment === 'right' ? 500 : width - 80;

        doc.fillColor(layer.color || '#5a6065').fontSize(layer.size || 16).font('Helvetica').text(textToRender, xPos, layer.y || 340, {
          align: alignment,
          width: textWidth,
        });
      });
    }

    // 4. Footer Details (Organizer & Issue Date - Only if enabled)
    if (showFooter && !hasCustomBg) {
      const fontColor = templatePreset === 'tech' ? '#ffffff' : textColor;
      doc.fillColor('#5a6065').fontSize(10).font('Helvetica-Bold').text('ISSUE DATE', 90, footerY);
      doc.fillColor(fontColor).fontSize(11).font('Helvetica').text(issueDate, 90, footerY + 16);

      doc.fillColor('#5a6065').fontSize(10).font('Helvetica-Bold').text('CERTIFICATE ID', 90, footerY + 38);
      doc.fillColor(themeColor).fontSize(11).font('Helvetica-Bold').text(certId, 90, footerY + 54);

      if (issuerName) {
        doc.fillColor(fontColor).fontSize(14).font('Helvetica-Bold').text(issuerName, width / 2 - 120, footerY + 42, {
          align: 'center',
          width: 240,
        });
        doc.fillColor('#5a6065').fontSize(10).font('Helvetica').text('Authorized Issuer', width / 2 - 120, footerY + 60, {
          align: 'center',
          width: 240,
        });
      }
    }

    // 5. Scannable QR Code & Verification ID (Only if enabled)
    if (showQr && qrBuffer) {
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      doc.fillColor('#5a6065').fontSize(7.5).font('Helvetica').text('Scan to Verify', qrX - 15, qrY + qrSize + 3, {
        align: 'center',
        width: qrSize + 30,
      });
    }

    doc.end();
  });
}

module.exports = {
  generateCertificateBuffer,
};
