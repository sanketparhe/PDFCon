/* converter.js – Fixed: file stays after download + animations */

// ─── Config ─────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api';
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const TOOL_ACCEPT = {
  'jpg-to-pdf':    { accept: '.jpg,.jpeg', label: 'JPG / JPEG', icon: 'bi-image-fill', multiple: false },
  'png-to-pdf':    { accept: '.png',       label: 'PNG',        icon: 'bi-filetype-png', multiple: false },
  'word-to-pdf':   { accept: '.doc,.docx', label: 'DOC / DOCX', icon: 'bi-filetype-docx', multiple: false },
  'ppt-to-pdf':    { accept: '.ppt,.pptx', label: 'PPT / PPTX', icon: 'bi-filetype-pptx', multiple: false },
  'images-to-pdf': { accept: '.jpg,.jpeg,.png,.webp', label: 'Images (JPG/PNG)', icon: 'bi-images', multiple: true },
  'merge-pdf':     { accept: '.pdf',       label: 'PDF files',  icon: 'bi-files', multiple: true },
  'compress-pdf':  { accept: '.pdf',       label: 'PDF',        icon: 'bi-file-zip-fill', multiple: false },
};

// ─── State ──────────────────────────────────────────────────────────
let currentTool = 'jpg-to-pdf';
let selectedFiles = [];
let lastConvertedBlob = null;   // FIX: store the blob so download always works
let lastConvertedName = '';
let conversionHistory = JSON.parse(localStorage.getItem('pdfforge-history') || '[]');
let downloadCount = parseInt(localStorage.getItem('pdfforge-downloads') || '0');

// ─── DOM References ──────────────────────────────────────────────────
const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const fileList     = document.getElementById('fileList');
const progressWrap = document.getElementById('progressWrap');
const progressBar  = document.getElementById('progressBar');
const progressPct  = document.getElementById('progressPct');
const resultCard   = document.getElementById('resultCard');
const convertBtn   = document.getElementById('convertBtn');
const previewBody  = document.getElementById('previewBody');
const historyList  = document.getElementById('historyList');
const dlCountEl    = document.getElementById('downloadCount');

// ─── Init ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const toolParam = params.get('tool');
  if (toolParam && TOOL_ACCEPT[toolParam]) currentTool = toolParam;

  setupTabs();
  setupDropZone();
  renderHistory();
  updateDownloadCounter();
  animateEntrance();
});

// ─── Entrance Animations ─────────────────────────────────────────────
function animateEntrance() {
  const els = document.querySelectorAll('.animate-in');
  els.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 80 * i);
  });
}

// ─── Tool Tabs ───────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tool-tab').forEach(tab => {
    if (tab.dataset.tool === currentTool) tab.classList.add('active');
    tab.addEventListener('click', () => {
      currentTool = tab.dataset.tool;
      document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      resetConverter();
      updateFileInputAccept();
      updateToolHeading();
      // Animate tab change
      const heading = document.getElementById('toolHeading');
      if (heading) {
        heading.style.transition = 'opacity 0.2s';
        heading.style.opacity = '0';
        setTimeout(() => { heading.style.opacity = '1'; }, 200);
      }
    });
  });
  updateFileInputAccept();
  updateToolHeading();
}

function updateFileInputAccept() {
  const cfg = TOOL_ACCEPT[currentTool];
  if (fileInput) {
    fileInput.accept = cfg.accept;
    fileInput.multiple = cfg.multiple;
  }
  const hint = document.getElementById('dropHint');
  if (hint) hint.textContent = `Accepts: ${cfg.label} · Max ${MAX_SIZE_MB}MB`;
}

function updateToolHeading() {
  const heading = document.getElementById('toolHeading');
  const subheading = document.getElementById('toolSubheading');
  const labels = {
    'jpg-to-pdf':    ['JPG to PDF', 'Convert your JPEG images to PDF documents instantly.'],
    'png-to-pdf':    ['PNG to PDF', 'Convert PNG images to PDF with transparency support.'],
    'word-to-pdf':   ['Word to PDF', 'Convert DOC and DOCX files to PDF.'],
    'ppt-to-pdf':    ['PowerPoint to PDF', 'Export PPT/PPTX slides as a PDF.'],
    'images-to-pdf': ['Multiple Images to PDF', 'Combine images into a single multi-page PDF.'],
    'merge-pdf':     ['Merge PDFs', 'Combine multiple PDFs into one document.'],
    'compress-pdf':  ['Compress PDF', 'Reduce PDF file size while keeping quality.'],
  };
  if (heading) heading.textContent = labels[currentTool][0];
  if (subheading) subheading.textContent = labels[currentTool][1];
}

// ─── Drop Zone ───────────────────────────────────────────────────────
function setupDropZone() {
  if (!dropZone) return;
  ['dragenter','dragover'].forEach(e => {
    dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('drag-over'); });
  });
  ['dragleave','drop'].forEach(e => {
    dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('drag-over'); });
  });
  dropZone.addEventListener('drop', ev => handleFiles(Array.from(ev.dataTransfer.files)));
  fileInput?.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));
}

// ─── File Handling ───────────────────────────────────────────────────
function handleFiles(files) {
  const cfg = TOOL_ACCEPT[currentTool];
  const valid = [];
  for (const file of files) {
    if (file.size > MAX_SIZE_BYTES) {
      showToast(`${file.name} exceeds ${MAX_SIZE_MB}MB limit.`, 'error'); continue;
    }
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!cfg.accept.split(',').includes(ext)) {
      showToast(`${file.name} is not a valid file type for this tool.`, 'error'); continue;
    }
    valid.push(file);
  }
  if (!cfg.multiple) selectedFiles = valid.slice(0, 1);
  else selectedFiles = [...selectedFiles, ...valid];

  renderFileList();
  renderPreview();
  resetResult();
  if (selectedFiles.length > 0 && convertBtn) {
    convertBtn.disabled = false;
    convertBtn.classList.add('btn-pulse');
  }
}

function renderFileList() {
  if (!fileList) return;
  fileList.innerHTML = '';
  selectedFiles.forEach((file, idx) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const iconMap = { pdf:'bi-file-earmark-pdf-fill', jpg:'bi-image-fill', jpeg:'bi-image-fill', png:'bi-filetype-png', doc:'bi-filetype-docx', docx:'bi-filetype-docx', ppt:'bi-filetype-pptx', pptx:'bi-filetype-pptx' };
    const icon = iconMap[ext] || 'bi-file-earmark-fill';
    const div = document.createElement('div');
    div.className = 'file-item animate-slide-in';
    div.style.animationDelay = (idx * 60) + 'ms';
    div.innerHTML = `
      <i class="bi ${icon} file-item-icon"></i>
      <span class="file-item-name" title="${file.name}">${file.name}</span>
      <span class="file-item-size">${formatSize(file.size)}</span>
      <button class="file-item-remove" onclick="removeFile(${idx})" title="Remove">
        <i class="bi bi-x-lg"></i>
      </button>`;
    fileList.appendChild(div);
  });
}

function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  renderFileList();
  renderPreview();
  if (selectedFiles.length === 0 && convertBtn) {
    convertBtn.disabled = true;
    convertBtn.classList.remove('btn-pulse');
  }
}

// ─── Preview ─────────────────────────────────────────────────────────
function renderPreview() {
  if (!previewBody) return;
  const file = selectedFiles[0];
  if (!file) {
    previewBody.innerHTML = '<p class="preview-empty"><i class="bi bi-image" style="font-size:2rem;display:block;margin-bottom:8px"></i>File preview appears here</p>';
    return;
  }
  const isImage = file.type.startsWith('image/');
  if (isImage) {
    const url = URL.createObjectURL(file);
    previewBody.innerHTML = `<img src="${url}" class="preview-img animate-zoom-in" alt="Preview" />`;
  } else {
    const ext = file.name.split('.').pop().toUpperCase();
    previewBody.innerHTML = `<div class="text-center animate-zoom-in"><i class="bi bi-file-earmark-text" style="font-size:3rem;color:var(--brand-primary)"></i><p class="mt-2 mb-0 fw-600">${file.name}</p><p class="text-muted small">${formatSize(file.size)} · ${ext} file</p></div>`;
  }
}

// ─── Convert ─────────────────────────────────────────────────────────
async function startConversion() {
  if (selectedFiles.length === 0) return;

  progressWrap.style.display = 'block';
  resultCard.style.display = 'none';
  convertBtn.disabled = true;
  convertBtn.classList.remove('btn-pulse');
  convertBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Converting…';

  setProgress(10, 'Uploading…');

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append('files', f));
  formData.append('tool', currentTool);

  try {
    const uploadInterval = simulateProgress(10, 60, 1500, 'Uploading…');

    const response = await fetch(`${API_BASE}/convert`, {
      method: 'POST',
      body: formData,
    });

    clearInterval(uploadInterval);
    setProgress(70, 'Converting…');

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Conversion failed');
    }

    setProgress(90, 'Finalising…');
    await sleep(400);

    // FIX: Read the response as a blob so we can re-download without going back to server
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const contentDisposition = response.headers.get('content-disposition') || '';
    let filename = 'converted.pdf';
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/i);
    if (match) filename = match[1];

    // Try to get JSON data; if content-type is octet-stream treat as blob download
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
      setProgress(100, 'Done!');
      await sleep(300);
      showResult(data);
      addToHistory(data.filename, currentTool);
    } else {
      // Direct blob download path
      lastConvertedBlob = await response.blob();
      lastConvertedName = filename;
      data = { filename, originalName: selectedFiles[0]?.name };
      setProgress(100, 'Done!');
      await sleep(300);
      showResultBlob(data);
      addToHistory(filename, currentTool);
    }

  } catch (err) {
    showToast(err.message || 'Conversion failed. Please try again.', 'error');
    resetProgress();
  } finally {
    convertBtn.disabled = false;
    convertBtn.innerHTML = '<i class="bi bi-lightning-charge-fill me-2"></i>Convert to PDF';
  }
}

// ─── FIX: Triggered download from stored blob (file never disappears) ──
function triggerBlobDownload() {
  if (!lastConvertedBlob) {
    showToast('File no longer available. Please convert again.', 'error');
    return;
  }
  const url = URL.createObjectURL(lastConvertedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastConvertedName || 'converted.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after delay – but keep lastConvertedBlob so user can re-download
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  incrementDownload();
  launchConfetti();
}

// FIX: Result card that uses blob download (no server needed after convert)
function showResultBlob(data) {
  progressWrap.style.display = 'none';
  resultCard.style.display = 'block';
  resultCard.classList.add('animate-in-result');

  resultCard.innerHTML = `
    <div class="result-success-icon"><i class="bi bi-check-lg"></i></div>
    <div class="result-title">Conversion Successful! 🎉</div>
    <div class="result-subtitle mb-4">${data.originalName || 'Your file'} → ${data.filename}</div>
    <button class="btn btn-primary-brand btn-lg me-2" onclick="triggerBlobDownload()">
      <i class="bi bi-download me-2"></i>Download PDF
    </button>
    <button class="btn btn-outline-brand btn-lg" onclick="resetConverter()">
      <i class="bi bi-arrow-repeat me-2"></i>Convert Another
    </button>`;
}

// Original result for JSON-based API response (with re-download from server)
function showResult(data) {
  progressWrap.style.display = 'none';
  resultCard.style.display = 'block';
  resultCard.classList.add('animate-in-result');

  const downloadUrl = `${API_BASE}/download/${data.filename}`;
  resultCard.innerHTML = `
    <div class="result-success-icon"><i class="bi bi-check-lg"></i></div>
    <div class="result-title">Conversion Successful! 🎉</div>
    <div class="result-subtitle mb-4">${data.originalName || 'Your file'} → ${data.filename}</div>
    <a href="${downloadUrl}" class="btn btn-primary-brand btn-lg me-2" download onclick="incrementDownload(); launchConfetti();">
      <i class="bi bi-download me-2"></i>Download PDF
    </a>
    <button class="btn btn-outline-brand btn-lg" onclick="resetConverter()">
      <i class="bi bi-arrow-repeat me-2"></i>Convert Another
    </button>`;
}

// ─── Confetti 🎉 ─────────────────────────────────────────────────────
function launchConfetti() {
  const colors = ['#2563EB','#F97316','#7C3AED','#10B981','#F43F5E'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      position:fixed;
      left:${Math.random() * 100}vw;
      top:-10px;
      width:${6 + Math.random() * 8}px;
      height:${6 + Math.random() * 8}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      pointer-events:none;
      z-index:9999;
      animation: confettiFall ${1.5 + Math.random() * 2}s ease-out forwards;
      animation-delay:${Math.random() * 0.5}s;
      transform:rotate(${Math.random()*360}deg);
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ─── Progress ────────────────────────────────────────────────────────
function simulateProgress(from, to, duration, label) {
  const steps = 20;
  const interval = duration / steps;
  const increment = (to - from) / steps;
  let current = from;
  return setInterval(() => {
    current = Math.min(current + increment, to);
    setProgress(Math.round(current), label);
  }, interval);
}

function setProgress(pct, label) {
  if (progressBar) progressBar.style.width = pct + '%';
  if (progressPct) progressPct.textContent = label + ' ' + pct + '%';
}

function resetProgress() {
  if (progressWrap) progressWrap.style.display = 'none';
  setProgress(0, '');
}

function resetResult() {
  if (resultCard) { resultCard.style.display = 'none'; resultCard.classList.remove('animate-in-result'); }
}

function resetConverter() {
  selectedFiles = [];
  lastConvertedBlob = null;
  lastConvertedName = '';
  renderFileList();
  renderPreview();
  resetResult();
  resetProgress();
  if (convertBtn) {
    convertBtn.disabled = true;
    convertBtn.classList.remove('btn-pulse');
    convertBtn.innerHTML = '<i class="bi bi-lightning-charge-fill me-2"></i>Convert to PDF';
  }
  if (fileInput) fileInput.value = '';
}

// ─── History ─────────────────────────────────────────────────────────
function addToHistory(filename, tool) {
  conversionHistory.unshift({ filename, tool, time: new Date().toISOString() });
  if (conversionHistory.length > 20) conversionHistory = conversionHistory.slice(0, 20);
  localStorage.setItem('pdfforge-history', JSON.stringify(conversionHistory));
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  if (conversionHistory.length === 0) {
    historyList.innerHTML = '<div class="history-empty"><i class="bi bi-clock-history" style="font-size:1.5rem;display:block;margin-bottom:8px"></i>No conversions yet</div>';
    return;
  }
  const toolLabels = { 'jpg-to-pdf':'JPG→PDF','png-to-pdf':'PNG→PDF','word-to-pdf':'Word→PDF','ppt-to-pdf':'PPT→PDF','images-to-pdf':'Images→PDF','merge-pdf':'Merge PDF','compress-pdf':'Compress PDF' };
  historyList.innerHTML = conversionHistory.slice(0, 8).map(h => `
    <div class="history-item">
      <i class="bi bi-file-earmark-pdf-fill history-icon"></i>
      <div class="history-name">${h.filename}</div>
      <div class="d-flex flex-column align-items-end">
        <span class="badge bg-light text-secondary small mb-1">${toolLabels[h.tool] || h.tool}</span>
        <span class="history-time">${timeAgo(h.time)}</span>
      </div>
    </div>`).join('');
}

function clearHistory() {
  conversionHistory = [];
  localStorage.removeItem('pdfforge-history');
  renderHistory();
  showToast('History cleared.', 'info');
}

// ─── Download Counter ────────────────────────────────────────────────
function incrementDownload() {
  downloadCount++;
  localStorage.setItem('pdfforge-downloads', downloadCount);
  updateDownloadCounter();
}

function updateDownloadCounter() {
  if (dlCountEl) dlCountEl.textContent = downloadCount.toLocaleString();
}

// ─── Toasts ──────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container-custom';
    document.body.appendChild(container);
  }
  const icons = { success: 'bi-check-circle-fill', error: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
  const toast = document.createElement('div');
  toast.className = `toast-custom toast-${type} toast-enter`;
  toast.innerHTML = `<i class="bi ${icons[type]}"></i>${msg}`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// ─── Utilities ───────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.round(diff / 60) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  return Math.round(diff / 86400) + 'd ago';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
