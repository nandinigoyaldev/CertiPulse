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
      } else if (tabId === 'studio') {
        renderCanvasPreview();
      }
      fetchAnalytics();
    });
  });

  // Analytics Fetching
  async function fetchAnalytics() {
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) return;
      const data = await res.json();
      document.getElementById('stat-total').textContent = data.totalIssued || 0;
      document.getElementById('stat-verified').textContent = data.verifiedCount || 0;
      document.getElementById('stat-views').textContent = data.totalViews || 0;
      document.getElementById('stat-shares').textContent = data.totalShares || 0;
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '⚡';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // 3D Canvas Tilt Interactivity
  const canvasContainer = document.getElementById('3d-canvas-container');
  const canvas = document.getElementById('certCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  if (canvasContainer && canvas) {
    canvasContainer.addEventListener('mousemove', (e) => {
      const rect = canvasContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      canvas.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    });

    canvasContainer.addEventListener('mouseleave', () => {
      canvas.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    });
  }

  const templatePresetSelect = document.getElementById('templatePreset');
  const customBgFileInput = document.getElementById('customBgFile');
  const pngFileStatus = document.getElementById('png-file-status');
  const pngDropZone = document.getElementById('pngDropZone');

  const eventTitleInput = document.getElementById('eventTitle');
  const subtitleInput = document.getElementById('certificateSubtitle');
  const issuerNameInput = document.getElementById('issuerName');
  const themeColorInput = document.getElementById('themeColor');

  const nameYInput = document.getElementById('nameY');
  const nameSizeInput = document.getElementById('nameSize');
  const eventYInput = document.getElementById('eventY');
  const eventSizeInput = document.getElementById('eventSize');
  const qrXInput = document.getElementById('qrX');
  const qrYInput = document.getElementById('qrY');

  let loadedCustomBgImage = null;
  let customBgDataUrl = null;

  // Handle Custom PNG Background File Upload
  function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please upload a valid PNG or JPG image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      customBgDataUrl = evt.target.result;
      const img = new Image();
      img.onload = () => {
        loadedCustomBgImage = img;
        if (pngFileStatus) {
          pngFileStatus.textContent = `✓ Loaded Custom PNG Artwork: ${file.name} (${img.width}x${img.height}px)`;
          pngFileStatus.classList.remove('hidden');
        }
        showToast('Custom PNG certificate template uploaded successfully!', 'success');
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

  // Live Canvas Rendering Engine
  function renderCanvasPreview() {
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    const preset = templatePresetSelect ? templatePresetSelect.value : 'modern';
    const themeColor = themeColorInput ? themeColorInput.value : '#e05638';

    const eventTitle = eventTitleInput ? eventTitleInput.value : 'Full-Stack Web Development Workshop';
    const subtitle = subtitleInput ? subtitleInput.value : 'Certificate of Completion';
    const issuerName = issuerNameInput ? issuerNameInput.value : 'Nandini Goyal';

    const nameY = Number.parseInt(nameYInput?.value || '200', 10);
    const nameSize = Number.parseInt(nameSizeInput?.value || '34', 10);
    const eventY = Number.parseInt(eventYInput?.value || '280', 10);
    const eventSize = Number.parseInt(eventSizeInput?.value || '22', 10);

    const qrX = Number.parseInt(qrXInput?.value || '660', 10);
    const qrY = Number.parseInt(qrYInput?.value || '400', 10);

    ctx.clearRect(0, 0, width, height);

    if (loadedCustomBgImage) {
      ctx.drawImage(loadedCustomBgImage, 0, 0, width, height);
    } else {
      // Render Selected Preset Frame
      if (preset === 'gold') {
        ctx.fillStyle = '#fdfbf7';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, width - 40, height - 40);

        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(28, 28, width - 56, height - 56);
      } else if (preset === 'tech') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, width - 40, height - 40);
      } else if (preset === 'classic') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#1a1d20';
        ctx.lineWidth = 6;
        ctx.strokeRect(24, 24, width - 48, height - 48);
      } else {
        // Modern Nordic Terracotta / Custom Accent (default)
        ctx.fillStyle = '#faf8f5';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, width - 40, height - 40);

        ctx.strokeStyle = '#1a1d20';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(28, 28, width - 56, height - 56);

        // Accent Corners
        ctx.fillStyle = themeColor;
        ctx.fillRect(20, 20, 36, 36);
        ctx.fillRect(width - 56, 20, 36, 36);
        ctx.fillRect(20, height - 56, 36, 36);
        ctx.fillRect(width - 56, height - 56, 36, 36);
      }

      // Header Badge & Subtitle Text
      ctx.textAlign = 'center';
      ctx.fillStyle = themeColor;
      ctx.font = 'bold 14px "Space Grotesk", sans-serif';
      ctx.fillText('OFFICIAL CREDENTIAL', width / 2, 70);

      ctx.fillStyle = preset === 'tech' ? '#f8fafc' : '#1a1d20';
      ctx.font = '700 26px "Space Grotesk", sans-serif';
      ctx.fillText(subtitle, width / 2, 105);

      // Line
      ctx.beginPath();
      ctx.moveTo(width / 2 - 100, 130);
      ctx.lineTo(width / 2 + 100, 130);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = preset === 'tech' ? '#94a3b8' : '#5a6065';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('THIS IS PROUDLY PRESENTED TO', width / 2, 160);
    }

    // Recipient Name
    const fontColor = preset === 'tech' && !loadedCustomBgImage ? '#ffffff' : '#1a1d20';
    ctx.textAlign = 'center';
    ctx.fillStyle = fontColor;
    ctx.font = `700 ${nameSize}px "Space Grotesk", sans-serif`;
    ctx.fillText('Jane Doe (Sample)', width / 2, nameY);

    if (!loadedCustomBgImage) {
      ctx.fillStyle = preset === 'tech' ? '#cbd5e1' : '#5a6065';
      ctx.font = '13px Inter, sans-serif';
      ctx.fillText('for successfully participating in and completing', width / 2, eventY - 26);
    }

    // Event Title
    ctx.fillStyle = themeColor;
    ctx.font = `700 ${eventSize}px "Space Grotesk", sans-serif`;
    ctx.fillText(eventTitle, width / 2, eventY);

    // Footer Info
    if (!loadedCustomBgImage) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5a6065';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText('ISSUE DATE', 90, 420);
      ctx.fillStyle = fontColor;
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(new Date().toISOString().split('T')[0], 90, 436);

      ctx.fillStyle = '#5a6065';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText('CERTIFICATE ID', 90, 458);
      ctx.fillStyle = themeColor;
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('CERT-DEMO1234', 90, 474);

      ctx.textAlign = 'center';
      ctx.fillStyle = fontColor;
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.fillText(issuerName, width / 2, 460);
      ctx.fillStyle = '#5a6065';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Authorized Issuer', width / 2, 476);
    }

    // QR Code Placeholder
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX, qrY, 80, 80);
    ctx.strokeStyle = '#1a1d20';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX, qrY, 80, 80);

    ctx.fillStyle = '#1a1d20';
    ctx.fillRect(qrX + 10, qrY + 10, 20, 20);
    ctx.fillRect(qrX + 50, qrY + 10, 20, 20);
    ctx.fillRect(qrX + 10, qrY + 50, 20, 20);

    ctx.fillStyle = '#5a6065';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scan to Verify', qrX + 40, qrY + 94);
  }

  // Attach Input Listeners for Live Updates
  [
    templatePresetSelect,
    eventTitleInput,
    subtitleInput,
    issuerNameInput,
    themeColorInput,
    nameYInput,
    nameSizeInput,
    eventYInput,
    eventSizeInput,
    qrXInput,
    qrYInput,
  ].forEach((input) => {
    input?.addEventListener('input', renderCanvasPreview);
    input?.addEventListener('change', renderCanvasPreview);
  });

  // Download Sample PDF Action
  document.getElementById('btn-download-sample-pdf')?.addEventListener('click', async () => {
    showToast('Generating sample PDF certificate...', 'info');
    try {
      const payload = {
        recipientName: 'Jane Doe',
        eventTitle: eventTitleInput ? eventTitleInput.value : 'Workshop',
        certificateSubtitle: subtitleInput ? subtitleInput.value : 'Certificate of Completion',
        issuerName: issuerNameInput ? issuerNameInput.value : 'Nandini Goyal',
        themeColor: themeColorInput ? themeColorInput.value : '#e05638',
        customBgDataUrl,
        templatePreset: templatePresetSelect ? templatePresetSelect.value : 'modern',
        nameY: nameYInput ? nameYInput.value : '200',
        nameSize: nameSizeInput ? nameSizeInput.value : '34',
        eventY: eventYInput ? eventYInput.value : '280',
        eventSize: eventSizeInput ? eventSizeInput.value : '22',
        qrX: qrXInput ? qrXInput.value : '660',
        qrY: qrYInput ? qrYInput.value : '400',
      };

      const res = await fetch('/api/preview-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('PDF generation failed.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Sample_Certificate_Preview.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Sample PDF downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to download PDF preview: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-generate-preview')?.addEventListener('click', () => {
    renderCanvasPreview();
    showToast('Canvas preview updated!', 'success');
  });

  // Batch Upload Form Handler
  const uploadForm = document.getElementById('upload-form');
  uploadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('workbookFile');
    if (!fileInput || !fileInput.files.length) {
      showToast('Please select a spreadsheet file (.csv or .xlsx) to dispatch.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('workbook', fileInput.files[0]);
    formData.append('eventTitle', eventTitleInput ? eventTitleInput.value : '');
    formData.append('certificateSubtitle', subtitleInput ? subtitleInput.value : '');
    formData.append('issuerName', issuerNameInput ? issuerNameInput.value : '');
    formData.append('themeColor', themeColorInput ? themeColorInput.value : '');
    if (customBgDataUrl) formData.append('customBgDataUrl', customBgDataUrl);

    formData.append('smtpHost', document.getElementById('smtpHost')?.value || '');
    formData.append('smtpPort', document.getElementById('smtpPort')?.value || '');
    formData.append('smtpUser', document.getElementById('smtpUser')?.value || '');
    formData.append('smtpPass', document.getElementById('smtpPass')?.value || '');
    formData.append('emailSubject', document.getElementById('emailSubject')?.value || '');

    showToast('Uploading roster spreadsheet & queuing dispatch...', 'info');

    try {
      const res = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      showToast(`Batch queued! Job ID: ${data.jobId}`, 'success');
      fetchAnalytics();
    } catch (err) {
      showToast('Dispatch error: ' + err.message, 'error');
    }
  });

  // Load Registry Table
  const searchInput = document.getElementById('search-input');
  searchInput?.addEventListener('input', () => loadRegistryTable());

  async function loadRegistryTable() {
    const tbody = document.getElementById('registry-table-body');
    if (!tbody) return;

    const query = searchInput ? searchInput.value.trim() : '';

    try {
      const res = await fetch(`/api/certificates?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to load certificates');
      const list = await res.json();

      if (!list.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 24px;">
              No credentials found matching query.
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = list
        .map((cert) => {
          let badgeClass = 'verified';
          if (cert.status === 'REVOKED') badgeClass = 'revoked';
          if (cert.status === 'EXPIRED') badgeClass = 'expired';

          return `
            <tr>
              <td><strong style="color:var(--accent-terracotta); font-family:'JetBrains Mono',monospace;">${cert.certId}</strong></td>
              <td><strong>${cert.recipientName}</strong></td>
              <td style="color:var(--text-secondary);">${cert.recipientEmail}</td>
              <td>${cert.eventTitle}</td>
              <td><span class="badge-status ${badgeClass}">${cert.status}</span></td>
              <td>${cert.viewCount || 0} views</td>
              <td>
                <div style="display:flex; gap:6px;">
                  <a href="/api/certificates/${cert.certId}/pdf" target="_blank" class="btn btn-secondary btn-sm" title="Download PDF">
                    📄 PDF
                  </a>
                  <button class="btn btn-secondary btn-sm btn-resend" data-id="${cert.certId}">
                    ✉️ Resend
                  </button>
                  ${cert.status === 'VERIFIED' ? `<button class="btn btn-danger btn-sm btn-revoke" data-id="${cert.certId}">Revoke</button>` : ''}
                </div>
              </td>
            </tr>`;
        })
        .join('');

      // Attach Actions
      document.querySelectorAll('.btn-resend').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const certId = btn.getAttribute('data-id');
          showToast(`Resending email for ${certId}...`, 'info');
          try {
            const r = await fetch(`/api/certificates/${certId}/resend`, { method: 'POST' });
            if (!r.ok) throw new Error('Failed to resend email');
            showToast(`Email resent for ${certId}!`, 'success');
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });

      document.querySelectorAll('.btn-revoke').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const certId = btn.getAttribute('data-id');
          const reason = prompt('Reason for certificate revocation:', 'Revoked by organizer');
          if (reason === null) return;

          try {
            const r = await fetch(`/api/certificates/${certId}/revoke`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            });
            if (!r.ok) throw new Error('Failed to revoke certificate');
            showToast(`Certificate ${certId} revoked.`, 'success');
            loadRegistryTable();
            fetchAnalytics();
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });
    } catch (err) {
      console.error(err);
    }
  }

  // Verification Simulator
  document.getElementById('btn-run-sim')?.addEventListener('click', () => {
    const certId = document.getElementById('sim-cert-id')?.value.trim() || 'CERT-DEMO1234';
    const iframe = document.getElementById('sim-iframe');
    if (iframe) {
      iframe.src = `/verify/${encodeURIComponent(certId)}`;
      showToast(`Simulating verification portal for ${certId}...`, 'info');
    }
  });

  // Initial Load
  renderCanvasPreview();
  fetchAnalytics();
});
