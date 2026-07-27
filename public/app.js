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
    });
  });

  // Certificate Studio Canvas & Controls
  const canvas = document.getElementById('certCanvas');
  const ctx = canvas.getContext('2d');

  const eventTitleInput = document.getElementById('eventTitle');
  const subtitleInput = document.getElementById('certificateSubtitle');
  const issuerNameInput = document.getElementById('issuerName');
  const issueDateInput = document.getElementById('issueDate');
  const swatches = document.querySelectorAll('.color-swatch');

  let activeThemeColor = '#0f766e';

  // Set default date to today
  if (issueDateInput && !issueDateInput.value) {
    issueDateInput.value = new Date().toISOString().split('T')[0];
  }

  swatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      swatches.forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      activeThemeColor = swatch.getAttribute('data-color');
      renderCanvasPreview();
    });
  });

  function renderCanvasPreview() {
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, w, h);

    // Outer Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = activeThemeColor;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(26, 26, w - 52, h - 52);

    ctx.lineWidth = 2;
    ctx.strokeStyle = activeThemeColor;
    ctx.strokeRect(32, 32, w - 64, h - 64);

    // Corners
    ctx.fillStyle = activeThemeColor;
    ctx.fillRect(20, 20, 36, 36);
    ctx.fillRect(w - 56, 20, 36, 36);
    ctx.fillRect(20, h - 56, 36, 36);
    ctx.fillRect(w - 56, h - 56, 36, 36);

    // Title / Badge
    ctx.textAlign = 'center';
    ctx.fillStyle = activeThemeColor;
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('OFFICIAL CREDENTIAL', w / 2, 70);

    // Subtitle
    ctx.fillStyle = '#334155';
    ctx.font = '28px "Outfit", sans-serif';
    ctx.fillText(subtitleInput?.value || 'Certificate of Completion', w / 2, 105);

    // Line
    ctx.beginPath();
    ctx.moveTo(w / 2 - 100, 130);
    ctx.lineTo(w / 2 + 100, 130);
    ctx.strokeStyle = activeThemeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Presented To
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('THIS IS PROUDLY PRESENTED TO', w / 2, 155);

    // Recipient Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px "Outfit", sans-serif';
    ctx.fillText('Jane Doe (Sample Recipient)', w / 2, 198);

    // Name Underline
    ctx.beginPath();
    ctx.moveTo(w / 2 - 180, 222);
    ctx.lineTo(w / 2 + 180, 222);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Event Accomplishment Text
    ctx.fillStyle = '#475569';
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('for successfully participating in and completing', w / 2, 248);

    // Event Title
    ctx.fillStyle = activeThemeColor;
    ctx.font = 'bold 24px "Outfit", sans-serif';
    ctx.fillText(eventTitleInput?.value || 'Workshop Title', w / 2, 285);

    // Footer Info
    const footerY = 440;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ISSUE DATE', 90, footerY);
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(issueDateInput?.value || new Date().toISOString().split('T')[0], 90, footerY + 18);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CERTIFICATE ID', 90, footerY + 42);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CERT-PREVIEW88', 90, footerY + 58);

    // Center Signature
    ctx.textAlign = 'center';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 80, footerY + 30);
    ctx.lineTo(w / 2 + 80, footerY + 30);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "Outfit", sans-serif';
    ctx.fillText(issuerNameInput?.value || 'Organizer Name', w / 2, footerY + 48);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Authorized Issuer', w / 2, footerY + 66);

    // Mock QR Code Box
    const qrX = w - 160;
    const qrY = footerY - 10;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(qrX, qrY, 70, 70);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(qrX, qrY, 70, 70);

    ctx.fillStyle = '#1e293b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[QR CODE]', qrX + 35, qrY + 40);

    ctx.fillStyle = '#64748b';
    ctx.font = '9px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Scan to Verify', qrX + 35, qrY + 84);
  }

  // Attach live listeners for canvas preview
  [eventTitleInput, subtitleInput, issuerNameInput, issueDateInput].forEach((input) => {
    input?.addEventListener('input', renderCanvasPreview);
  });
  renderCanvasPreview();

  // Preview PDF Button
  document.getElementById('btn-preview-pdf')?.addEventListener('click', async () => {
    try {
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

  // Proceed to Dispatch shortcut button
  document.getElementById('btn-proceed-dispatch')?.addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="dispatch"]')?.click();
  });

  // File Upload Drop Zone
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

  // SMTP Accordion Toggle
  const toggleSmtpBtn = document.getElementById('toggle-smtp');
  const smtpPanel = document.getElementById('smtp-panel');
  toggleSmtpBtn?.addEventListener('click', () => {
    smtpPanel?.classList.toggle('hidden');
  });

  // Tag Buttons Insertion into Email Body Textarea
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

  // Batch Upload Form Submission
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

    // Append certificate customizer fields
    formData.append('eventTitle', eventTitleInput?.value || '');
    formData.append('certificateSubtitle', subtitleInput?.value || '');
    formData.append('issuerName', issuerNameInput?.value || '');
    formData.append('issueDate', issueDateInput?.value || '');
    formData.append('themeColor', activeThemeColor);

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

  // Poll Jobs List
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
      if (jobStatsSummary) jobStatsSummary.textContent = `Status: ${activeJob.status.toUpperCase()} (${processed} rows completed)`;
    } else if (activeJobBox) {
      activeJobBox.classList.add('hidden');
    }

    jobsList.innerHTML = jobs
      .map((job) => {
        const summary = job.summary
          ? `Sent: ${job.summary.sent} | Failed: ${job.summary.failed} | Invalid Emails: ${job.summary.invalidEmail}`
          : 'Processing upload...';

        return `
          <div class="job-card-item">
            <div class="job-item-top">
              <div class="job-item-title">${escapeHtml(job.originalName)}</div>
              <span class="job-badge ${job.status}">${job.status}</span>
            </div>
            <div class="job-meta-row">${summary}</div>
            ${job.error ? `<div style="color:var(--danger); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.error)}</div>` : ''}
          </div>
        `;
      })
      .join('');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  setInterval(pollJobs, 3000);
  pollJobs();

  // Verification Search Form
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
      `;
    } catch (err) {
      if (verifyResult) {
        verifyResult.innerHTML = `<div style="color:var(--danger)">Verification lookup failed: ${escapeHtml(err.message)}</div>`;
      }
    }
  });
});
