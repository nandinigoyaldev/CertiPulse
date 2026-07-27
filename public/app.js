document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tabId}`)?.classList.add('active');

      if (tabId === 'registry') {
        loadRegistryTable();
      }
    });
  });

  // Certificate Studio Canvas & Controls
  const canvas = document.getElementById('certCanvas');
  const ctx = canvas.getContext('2d');

  const templatePresetSelect = document.getElementById('templatePreset');
  const customBgFileInput = document.getElementById('customBgFile');
  const pngFileStatus = document.getElementById('png-file-status');
  const pngDropZone = document.getElementById('pngDropZone');

  const eventTitleInput = document.getElementById('eventTitle');
  const subtitleInput = document.getElementById('certificateSubtitle');
  const issuerNameInput = document.getElementById('issuerName');
  const issueDateInput = document.getElementById('issueDate');

  // Positioning & QR Sliders
  const nameYInput = document.getElementById('nameY');
  const nameSizeInput = document.getElementById('nameSize');
  const eventYInput = document.getElementById('eventY');
  const eventSizeInput = document.getElementById('eventSize');
  const showQrCheckbox = document.getElementById('showQr');
  const qrXInput = document.getElementById('qrX');
  const qrYInput = document.getElementById('qrY');

  let activeThemeColor = '#0f766e';
  let loadedCustomBgImage = null;
  let customBgDataUrl = null;

  // Set default issue date to today
  if (issueDateInput && !issueDateInput.value) {
    issueDateInput.value = new Date().toISOString().split('T')[0];
  }

  // Handle Custom PNG Background File Upload
  function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload a valid PNG or JPG image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      customBgDataUrl = evt.target.result;
      const img = new Image();
      img.onload = () => {
        loadedCustomBgImage = img;
        if (templatePresetSelect) templatePresetSelect.value = 'custom';
        if (pngFileStatus) {
          pngFileStatus.textContent = `✓ Loaded PNG Artwork: ${file.name} (${img.width}x${img.height}px)`;
          pngFileStatus.classList.remove('hidden');
        }
        renderCanvasPreview();
      };
      img.src = customBgDataUrl;
    };
    reader.readAsDataURL(file);
  }

  customBgFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  });

  if (pngDropZone) {
    ['dragenter', 'dragover'].forEach((evt) => {
      pngDropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        pngDropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((evt) => {
      pngDropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        pngDropZone.classList.remove('dragover');
      });
    });

    pngDropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });
  }

  templatePresetSelect?.addEventListener('change', () => {
    renderCanvasPreview();
  });

  function renderCanvasPreview() {
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const preset = templatePresetSelect?.value || (loadedCustomBgImage ? 'custom' : 'modern');

    // 1. Draw Background (Custom image or Preset)
    if (preset === 'custom' && loadedCustomBgImage) {
      ctx.drawImage(loadedCustomBgImage, 0, 0, w, h);
    } else {
      if (preset === 'gold') {
        ctx.fillStyle = '#fdfbf7';
        ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#b45309';
        ctx.strokeRect(20, 20, w - 40, h - 40);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#d97706';
        ctx.strokeRect(28, 28, w - 56, h - 56);
      } else if (preset === 'tech') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#38bdf8';
        ctx.strokeRect(20, 20, w - 40, h - 40);
      } else if (preset === 'classic') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1e293b';
        ctx.strokeRect(24, 24, w - 48, h - 48);
      } else {
        // Modern Teal (default)
        ctx.fillStyle = '#faf8f5';
        ctx.fillRect(0, 0, w, h);

        ctx.lineWidth = 4;
        ctx.strokeStyle = activeThemeColor;
        ctx.strokeRect(20, 20, w - 40, h - 40);

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(26, 26, w - 52, h - 52);

        ctx.lineWidth = 2;
        ctx.strokeStyle = activeThemeColor;
        ctx.strokeRect(32, 32, w - 64, h - 64);

        // Corner accents
        ctx.fillStyle = activeThemeColor;
        ctx.fillRect(20, 20, 36, 36);
        ctx.fillRect(w - 56, 20, 36, 36);
        ctx.fillRect(20, h - 56, 36, 36);
        ctx.fillRect(w - 56, h - 56, 36, 36);
      }

      // Default Header / Subtitle
      if (preset !== 'custom') {
        ctx.textAlign = 'center';
        ctx.fillStyle = activeThemeColor;
        ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('OFFICIAL CREDENTIAL', w / 2, 70);

        ctx.fillStyle = preset === 'tech' ? '#f8fafc' : '#334155';
        ctx.font = '28px "Outfit", sans-serif';
        ctx.fillText(subtitleInput?.value || 'Certificate of Completion', w / 2, 105);

        ctx.beginPath();
        ctx.moveTo(w / 2 - 100, 130);
        ctx.lineTo(w / 2 + 100, 130);
        ctx.strokeStyle = activeThemeColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = preset === 'tech' ? '#94a3b8' : '#64748b';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('THIS IS PROUDLY PRESENTED TO', w / 2, 155);
      }
    }

    // 2. Draw Recipient Name (Dynamic Position & Size)
    const nameY = Number.parseInt(nameYInput?.value || '198', 10);
    const nameSize = Number.parseInt(nameSizeInput?.value || '36', 10);

    ctx.textAlign = 'center';
    ctx.fillStyle = preset === 'tech' && preset !== 'custom' ? '#ffffff' : '#0f172a';
    ctx.font = `bold ${nameSize}px "Outfit", sans-serif`;
    ctx.fillText('Jane Doe (Sample Recipient)', w / 2, nameY);

    // Underline
    if (preset !== 'custom') {
      ctx.beginPath();
      ctx.moveTo(w / 2 - 180, nameY + 22);
      ctx.lineTo(w / 2 + 180, nameY + 22);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 3. Draw Event Accomplishment & Title (Dynamic Position & Size)
    const eventY = Number.parseInt(eventYInput?.value || '285', 10);
    const eventSize = Number.parseInt(eventSizeInput?.value || '24', 10);

    if (preset !== 'custom') {
      ctx.fillStyle = preset === 'tech' ? '#cbd5e1' : '#475569';
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('for successfully participating in and completing', w / 2, eventY - 26);
    }

    ctx.fillStyle = activeThemeColor;
    ctx.font = `bold ${eventSize}px "Outfit", sans-serif`;
    ctx.fillText(eventTitleInput?.value || 'Workshop Title', w / 2, eventY);

    // 4. Draw Footer Details (For Presets)
    const footerY = 440;
    if (preset !== 'custom') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('ISSUE DATE', 90, footerY);
      ctx.fillStyle = preset === 'tech' ? '#fff' : '#1e293b';
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(issueDateInput?.value || new Date().toISOString().split('T')[0], 90, footerY + 18);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('CERTIFICATE ID', 90, footerY + 42);
      ctx.fillStyle = activeThemeColor;
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('CERT-PREVIEW88', 90, footerY + 58);

      ctx.textAlign = 'center';
      ctx.beginPath();
      ctx.moveTo(w / 2 - 80, footerY + 30);
      ctx.lineTo(w / 2 + 80, footerY + 30);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = preset === 'tech' ? '#fff' : '#0f172a';
      ctx.font = 'bold 15px "Outfit", sans-serif';
      ctx.fillText(issuerNameInput?.value || 'Organizer Name', w / 2, footerY + 48);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Authorized Issuer', w / 2, footerY + 66);
    }

    // 5. Draw Dynamic Scannable Verification QR Code Overlay
    if (showQrCheckbox?.checked) {
      const qrX = Number.parseInt(qrXInput?.value || '680', 10);
      const qrY = Number.parseInt(qrYInput?.value || '430', 10);
      const qrSize = 70;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = activeThemeColor;
      ctx.strokeRect(qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[QR CODE]', qrX + qrSize / 2, qrY + qrSize / 2 + 3);

      ctx.fillStyle = '#64748b';
      ctx.font = '9px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Scan to Verify', qrX + qrSize / 2, qrY + qrSize + 14);
    }
  }

  // Attach live preview event listeners
  [
    eventTitleInput,
    subtitleInput,
    issuerNameInput,
    issueDateInput,
    nameYInput,
    nameSizeInput,
    eventYInput,
    eventSizeInput,
    showQrCheckbox,
    qrXInput,
    qrYInput,
  ].forEach((el) => {
    el?.addEventListener('input', renderCanvasPreview);
    el?.addEventListener('change', renderCanvasPreview);
  });

  renderCanvasPreview();

  // Accordion Toggle for Position Sliders
  document.getElementById('toggle-positions')?.addEventListener('click', () => {
    document.getElementById('positions-panel')?.classList.toggle('hidden');
  });

  // Generate PDF Preview Button
  document.getElementById('btn-preview-pdf')?.addEventListener('click', async () => {
    try {
      const isCustom = templatePresetSelect?.value === 'custom' || !!customBgDataUrl;
      const res = await fetch('/api/preview-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: 'Jane Doe',
          eventTitle: eventTitleInput?.value,
          certificateSubtitle: subtitleInput?.value,
          issuerName: issuerNameInput?.value,
          issueDate: issueDateInput?.value,
          themeColor: activeThemeColor,
          customBgDataUrl: isCustom ? customBgDataUrl : null,
          templatePreset: isCustom ? 'custom' : (templatePresetSelect?.value || 'modern'),
          nameY: nameYInput?.value,
          nameSize: nameSizeInput?.value,
          eventY: eventYInput?.value,
          eventSize: eventSizeInput?.value,
          showQr: showQrCheckbox?.checked,
          qrX: qrXInput?.value,
          qrY: qrYInput?.value,
        }),
      });

      if (!res.ok) throw new Error('Preview generation failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      alert('Error generating PDF preview: ' + err.message);
    }
  });

  document.getElementById('btn-proceed-dispatch')?.addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="dispatch"]')?.click();
  });

  // Roster File Upload Drop Zone
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('file-info');

  if (dropZone && fileInput) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateFileInfo();
      }
    });

    fileInput.addEventListener('change', updateFileInfo);
  }

  function updateFileInfo() {
    if (fileInput.files.length) {
      const f = fileInput.files[0];
      fileInfo.textContent = `Selected Roster File: ${f.name} (${Math.round(f.size / 1024)} KB)`;
      fileInfo.classList.remove('hidden');
    }
  }

  // Accordion Toggle for SMTP Setup
  document.getElementById('toggle-smtp')?.addEventListener('click', () => {
    document.getElementById('smtp-panel')?.classList.toggle('hidden');
  });

  // Tag Buttons Insertion into Email Textarea
  const emailBodyTextarea = document.getElementById('emailBody');
  document.querySelectorAll('.tag-btn').forEach((tagBtn) => {
    tagBtn.addEventListener('click', () => {
      const tag = tagBtn.getAttribute('data-tag');
      if (emailBodyTextarea && tag) {
        const start = emailBodyTextarea.selectionStart;
        const end = emailBodyTextarea.selectionEnd;
        const val = emailBodyTextarea.value;
        emailBodyTextarea.value = val.substring(0, start) + tag + val.substring(end);
        emailBodyTextarea.focus();
        emailBodyTextarea.selectionStart = emailBodyTextarea.selectionEnd = start + tag.length;
      }
    });
  });

  // Upload Form Submit
  const uploadForm = document.getElementById('upload-form');
  const activeJobBox = document.getElementById('active-job-container');
  const activeJobTitle = document.getElementById('active-job-title');
  const progressBar = document.getElementById('jobProgressBar');
  const jobStatsSummary = document.getElementById('jobStatsSummary');
  const jobsList = document.getElementById('jobsList');

  uploadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files.length) {
      alert('Please select a spreadsheet file first.');
      return;
    }

    const formData = new FormData(uploadForm);
    const isCustom = templatePresetSelect?.value === 'custom' || !!customBgDataUrl;

    formData.append('eventTitle', eventTitleInput?.value || '');
    formData.append('certificateSubtitle', subtitleInput?.value || '');
    formData.append('issuerName', issuerNameInput?.value || '');
    formData.append('issueDate', issueDateInput?.value || '');
    formData.append('themeColor', activeThemeColor);
    formData.append('templatePreset', isCustom ? 'custom' : (templatePresetSelect?.value || 'modern'));
    if (isCustom && customBgDataUrl) {
      formData.append('customBgDataUrl', customBgDataUrl);
    }
    formData.append('nameY', nameYInput?.value || '198');
    formData.append('nameSize', nameSizeInput?.value || '36');
    formData.append('eventY', eventYInput?.value || '285');
    formData.append('eventSize', eventSizeInput?.value || '24');
    formData.append('showQr', showQrCheckbox?.checked ? 'true' : 'false');
    formData.append('qrX', qrXInput?.value || '680');
    formData.append('qrY', qrYInput?.value || '430');

    try {
      activeJobBox?.classList.remove('hidden');
      if (activeJobTitle) activeJobTitle.textContent = 'Uploading and processing spreadsheet...';
      if (progressBar) progressBar.style.width = '10%';

      const res = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
      }

      uploadForm.reset();
      fileInfo?.classList.add('hidden');
      pollJobs();
    } catch (err) {
      alert('Upload error: ' + err.message);
      activeJobBox?.classList.add('hidden');
    }
  });

  // Poll Jobs List & ZIP Download
  async function pollJobs() {
    try {
      const res = await fetch('/jobs');
      if (!res.ok) return;

      const jobs = await res.json();
      renderJobsList(jobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  }

  function renderJobsList(jobs) {
    if (!jobsList) return;

    if (!jobs || jobs.length === 0) {
      jobsList.innerHTML = '<div class="empty-state">No active or historical uploads. Upload a file above to begin.</div>';
      return;
    }

    const activeJob = jobs.find((j) => j.status === 'processing' || j.status === 'queued');

    if (activeJob && activeJobBox) {
      activeJobBox.classList.remove('hidden');
      activeJobTitle.textContent = `Dispatching emails for ${activeJob.originalName}...`;
      const processed = activeJob.rowsProcessed || 0;
      const total = activeJob.totalRows || 1;
      const pct = Math.min(100, Math.round((processed / total) * 100));
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (jobStatsSummary) jobStatsSummary.textContent = `Status: ${activeJob.status.toUpperCase()} (${processed}/${total} processed)`;
    } else if (activeJobBox) {
      activeJobBox.classList.add('hidden');
    }

    jobsList.innerHTML = jobs
      .map((job) => {
        const summary = job.summary
          ? `Sent: ${job.summary.sent} | Failed: ${job.summary.failed} | Invalid Emails: ${job.summary.invalidEmail}`
          : 'Processing upload...';

        const downloadZipBtn = job.status === 'done'
          ? `<a href="/api/jobs/${job.id}/download-zip" class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem; margin-top:8px;">📦 Download All Certificates (.zip)</a>`
          : '';

        return `
          <div class="job-card-item">
            <div class="job-item-top">
              <div class="job-item-title">${escapeHtml(job.originalName)}</div>
              <span class="job-badge ${job.status}">${job.status}</span>
            </div>
            <div class="job-meta-row">${summary}</div>
            ${downloadZipBtn}
            ${job.error ? `<div style="color:var(--danger); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.error)}</div>` : ''}
          </div>
        `;
      })
      .join('');
  }

  // Load Credential Registry Table
  const registryTableBody = document.getElementById('registryTableBody');
  const registrySearchInput = document.getElementById('registrySearchInput');

  async function loadRegistryTable() {
    if (!registryTableBody) return;
    try {
      const q = registrySearchInput?.value || '';
      const res = await fetch(`/api/certificates?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;

      const certs = await res.json();
      if (!certs || certs.length === 0) {
        registryTableBody.innerHTML = `<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-tertiary);">No issued certificates found.</td></tr>`;
        return;
      }

      registryTableBody.innerHTML = certs
        .map((cert) => {
          const statusBadge = cert.status === 'VERIFIED'
            ? `<span style="color:var(--success); font-weight:600;">✓ VERIFIED</span>`
            : `<span style="color:var(--danger); font-weight:600;">✕ ${cert.status}</span>`;

          return `
            <tr style="border-bottom:1px solid var(--border-color);">
              <td style="padding:10px 12px; font-weight:600; font-family:monospace;">${escapeHtml(cert.certId)}</td>
              <td style="padding:10px 12px; font-weight:600;">${escapeHtml(cert.recipientName)}<br><small style="color:var(--text-secondary); font-weight:normal;">${escapeHtml(cert.recipientEmail)}</small></td>
              <td style="padding:10px 12px;">${escapeHtml(cert.eventTitle)}</td>
              <td style="padding:10px 12px;">${escapeHtml(cert.issueDate)}</td>
              <td style="padding:10px 12px;">${cert.viewCount || 0}</td>
              <td style="padding:10px 12px;">${statusBadge}</td>
              <td style="padding:10px 12px; text-align:right;">
                <a href="/verify/${cert.certId}" target="_blank" class="btn btn-secondary" style="padding:3px 8px; font-size:0.75rem;">View</a>
                <button type="button" class="btn btn-secondary btn-resend" data-id="${cert.certId}" style="padding:3px 8px; font-size:0.75rem;">Resend</button>
                ${cert.status === 'VERIFIED' ? `<button type="button" class="btn btn-secondary btn-revoke" data-id="${cert.certId}" style="padding:3px 8px; font-size:0.75rem; color:var(--danger);">Revoke</button>` : ''}
              </td>
            </tr>
          `;
        })
        .join('');

      // Attach action listeners
      document.querySelectorAll('.btn-resend').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const certId = btn.getAttribute('data-id');
          if (!confirm(`Resend certificate email to recipient for ${certId}?`)) return;
          try {
            const res = await fetch(`/api/certificates/${certId}/resend`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || data.error);
          } catch (err) {
            alert('Failed to resend: ' + err.message);
          }
        });
      });

      document.querySelectorAll('.btn-revoke').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const certId = btn.getAttribute('data-id');
          const reason = prompt('Enter revocation reason:', 'Issued in error or cancelled registration');
          if (!reason) return;
          try {
            const res = await fetch(`/api/certificates/${certId}/revoke`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            });
            const data = await res.json();
            if (res.ok) {
              alert(`Certificate ${certId} revoked successfully.`);
              loadRegistryTable();
            } else {
              alert(data.error || 'Revocation failed');
            }
          } catch (err) {
            alert('Revocation error: ' + err.message);
          }
        });
      });
    } catch (err) {
      console.error('Failed to load registry:', err);
    }
  }

  registrySearchInput?.addEventListener('input', () => {
    loadRegistryTable();
  });

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  setInterval(pollJobs, 3000);
  pollJobs();

  // Verification Form Search
  const verifyForm = document.getElementById('verify-form');
  const verifyInput = document.getElementById('verifyInput');
  const verifyResult = document.getElementById('verify-result');

  verifyForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const certId = verifyInput?.value.trim();
    if (!certId) return;

    try {
      verifyResult?.classList.remove('hidden');
      if (verifyResult) verifyResult.innerHTML = '<div style="color:var(--text-muted);">Searching credential registry...</div>';

      const res = await fetch(`/api/verify/${encodeURIComponent(certId)}`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        verifyResult.innerHTML = `
          <div class="verify-status-banner invalid">
            ❌ Credential Not Found or Invalid
          </div>
          <p style="color:var(--text-muted); font-size:0.9rem;">No official certificate found matching ID: <strong>${escapeHtml(certId)}</strong>. Please verify the ID code.</p>
        `;
        return;
      }

      const cert = data.certificate;
      const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert.eventTitle)}&organizationName=${encodeURIComponent(cert.issuerName)}&issueYear=${(cert.issueDate || '').split('-')[0] || '2026'}&issueMonth=${(cert.issueDate || '').split('-')[1] || '01'}&certUrl=${encodeURIComponent(window.location.origin + '/verify/' + cert.certId)}&certId=${encodeURIComponent(cert.certId)}`;

      verifyResult.innerHTML = `
        <div class="verify-status-banner valid">
          ✓ Official Authenticated Credential
        </div>
        <div class="verify-details-grid">
          <div class="detail-item"><label>Certificate ID</label><span>${escapeHtml(cert.certId)}</span></div>
          <div class="detail-item"><label>Recipient Name</label><span>${escapeHtml(cert.recipientName)}</span></div>
          <div class="detail-item"><label>Event / Workshop</label><span>${escapeHtml(cert.eventTitle)}</span></div>
          <div class="detail-item"><label>Issue Date</label><span>${escapeHtml(cert.issueDate)}</span></div>
          <div class="detail-item"><label>Issuer / Host</label><span>${escapeHtml(cert.issuerName)}</span></div>
          <div class="detail-item"><label>Status</label><span style="color:var(--success)">${escapeHtml(cert.status)}</span></div>
        </div>
        <div style="margin-top:16px;">
          <a href="${linkedinUrl}" target="_blank" class="btn btn-primary btn-large" style="background:#0a66c2;">Add to LinkedIn Profile</a>
        </div>
      `;
    } catch (err) {
      if (verifyResult) {
        verifyResult.innerHTML = `<div style="color:var(--danger)">Verification lookup failed: ${escapeHtml(err.message)}</div>`;
      }
    }
  });
});
