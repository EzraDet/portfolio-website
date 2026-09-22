/* ============================================================
   ADMIN PANEL — Main Script
   ============================================================ */

// ============================================================
// AUTH — Check session, redirect to login if not authenticated
// ============================================================
async function checkAuth() {
  try {
    const res = await fetch('/api/me', { cache: 'no-store' });
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = '/login';
      return false;
    }
    // Update username in header
    const el = document.getElementById('currentUser');
    if (el) el.textContent = data.username || 'Admin';
    return true;
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = '/login';
    return false;
  }
}

async function logout() {
  if (!confirm('Log out of admin panel?')) return;
  try {
    await fetch('/api/logout', { method: 'POST', cache: 'no-store' });
  } catch (e) { /* ignore */ }
  window.location.href = '/login';
}

// Expose globally
window.logout = logout;

// ============================================================
// HELPERS
// ============================================================

async function api(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      ...options
    });
    clearTimeout(timeout);

    // ✅ If session expired (401), redirect to login
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timeout (8s)');
    throw err;
  }
}

function showAlert(msg, type = 'success') {
  const a = document.createElement('div');
  a.className = `alert alert-${type} show`;
  a.textContent = msg;
  const main = document.querySelector('.admin-main');
  if (!main) return;
  main.insertBefore(a, main.firstChild);
  setTimeout(() => a.remove(), 3500);
}

function notifyFrontend() {
  try { window.opener?.refreshPortfolio?.(); } catch {}
  try { localStorage.setItem('portfolio_updated', Date.now().toString()); } catch {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  fetch('/api/refresh', {
    method: 'POST',
    cache: 'no-store',
    signal: controller.signal
  })
    .catch(() => {})
    .finally(() => clearTimeout(timeout));
}

function showSection(id, el) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));

  const section = document.getElementById(id);
  if (section) section.classList.add('active');
  if (el) el.classList.add('active');

  if (id === 'aboutSection')    loadAbout();
  if (id === 'bannerSection')   loadBanner();
  if (id === 'servicesSection') loadServices();
  if (id === 'cvSection')       loadCV();
  if (id === 'projectsSection') loadProjects();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/* ============================================================
   ABOUT ME
   ============================================================ */
async function loadAbout() {
  try {
    const d = await api('/api/about');
    setVal('mainText', d.mainText || '');
    setVal('subText',  d.subText  || '');
  } catch (err) {
    showAlert('Failed to load About: ' + err.message, 'error');
  }
}

document.getElementById('publishAboutBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('publishAboutBtn');
  const mainText = document.getElementById('mainText')?.value || '';
  const subText  = document.getElementById('subText')?.value  || '';

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

  try {
    await api('/api/about', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainText, subText })
    });
    showAlert('✅ About published successfully!');
    notifyFrontend();
  } catch (err) {
    console.error(err);
    showAlert('❌ Publish failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-rocket"></i> Publish About';
  }
});

/* ============================================================
   BANNER
   ============================================================ */
let pendingBannerFiles = [];

async function loadBanner() {
  try {
    const d = await api('/api/banner');

    setVal('bannerText', d.text || '');
    setVal('bannerDescription', d.description || '');
    setVal('bannerTextColor', d.textColor || '#ffffff');
    setVal('bannerTextColorHex', d.textColor || '#ffffff');
    setVal('bannerDescriptionColor', d.descriptionColor || '#ffffff');
    setVal('bannerDescriptionColorHex', d.descriptionColor || '#ffffff');
    setVal('bannerTextAlign', d.textAlign || 'center');

    renderBannerList(d.images || []);
  } catch (err) {
    showAlert('Failed to load Banner: ' + err.message, 'error');
  }
}

function renderBannerList(images) {
  const list = document.getElementById('bannerList');
  if (!list) return;

  if (!images || !images.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-image"></i>
        <p>No banner images yet. Upload one above!</p>
      </div>`;
    return;
  }

  list.innerHTML = images.map((img, i) => `
    <div class="banner-card"
         draggable="true"
         data-index="${i}"
         data-path="${img}"
         ondragstart="handleBannerDragStart(event)"
         ondragover="handleBannerDragOver(event)"
         ondrop="handleBannerDrop(event)"
         ondragend="handleBannerDragEnd(event)">
      <span class="order-badge">#${i + 1}</span>
      <img src="${img}" alt="Banner ${i + 1}">
      <div class="banner-actions">
        <button type="button" class="btn-edit" onclick="openEditBannerModal(${i})" title="Edit">
          <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="btn-move" onclick="quickMoveBanner(${i}, -1)" title="Move left">
          <i class="fas fa-arrow-left"></i>
        </button>
        <button type="button" class="btn-move" onclick="quickMoveBanner(${i}, 1)" title="Move right">
          <i class="fas fa-arrow-right"></i>
        </button>
        <button type="button" class="btn-delete" onclick="deleteBannerImage('${img}')" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

/* ============================================================
   BANNER — Edit Modal / Move / Delete
   ============================================================ */
let editingBannerIndex = -1;

async function openEditBannerModal(index) {
  try {
    const data = await api('/api/banner');
    const img = data.images[index];
    if (!img) return;

    editingBannerIndex = index;

    const prev = document.getElementById('editBannerImgPreview');
    const path = document.getElementById('editBannerImgPath');
    const file = document.getElementById('editBannerNewFile');
    const modal = document.getElementById('editBannerModal');

    if (prev) prev.src = img;
    if (path) path.value = img;
    if (file) file.value = '';
    if (modal) modal.classList.add('active');
  } catch (err) {
    showAlert('❌ Failed to open editor: ' + err.message, 'error');
  }
}

function closeEditBannerModal() {
  const modal = document.getElementById('editBannerModal');
  if (modal) modal.classList.remove('active');
  editingBannerIndex = -1;
}

async function saveBannerImageEdit() {
  if (editingBannerIndex === -1) return;

  try {
    const fileInput = document.getElementById('editBannerNewFile');
    const newFile = fileInput?.files?.[0];

    if (newFile) {
      const fd = new FormData();
      fd.append('images', newFile);
      fd.append('replaceIndex', editingBannerIndex);
      await api('/api/banner/replace', { method: 'POST', body: fd });
      showAlert('✅ Banner image replaced!');
    } else {
      showAlert('ℹ️ No changes made');
    }

    closeEditBannerModal();
    await loadBanner();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Save failed: ' + err.message, 'error');
  }
}

async function deleteBannerFromModal() {
  if (editingBannerIndex === -1) return;
  try {
    const data = await api('/api/banner');
    const img = data.images[editingBannerIndex];
    closeEditBannerModal();
    await deleteBannerImage(img);
  } catch (err) {
    showAlert('❌ Delete failed: ' + err.message, 'error');
  }
}

async function quickMoveBanner(index, direction) {
  try {
    const data = await api('/api/banner');
    const images = [...data.images];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= images.length) return;

    [images[index], images[newIndex]] = [images[newIndex], images[index]];

    await api('/api/banner/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images })
    });

    await loadBanner();
    notifyFrontend();
    showAlert('✅ Banner order updated');
  } catch (err) {
    showAlert('❌ Move failed: ' + err.message, 'error');
  }
}

async function moveBannerImage(direction) {
  if (editingBannerIndex === -1) return;
  const idx = editingBannerIndex;
  closeEditBannerModal();
  await quickMoveBanner(idx, direction);
}

/* ============================================================
   BANNER — Drag & Drop Reorder
   ============================================================ */
let draggedBannerIndex = -1;

function handleBannerDragStart(e) {
  const card = e.currentTarget;
  draggedBannerIndex = parseInt(card.dataset.index);
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleBannerDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function handleBannerDragEnd() {
  document.querySelectorAll('.banner-card').forEach(c => {
    c.classList.remove('dragging', 'drag-over');
  });
}

async function handleBannerDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');

  const targetIndex = parseInt(target.dataset.index);
  if (draggedBannerIndex === -1 || draggedBannerIndex === targetIndex) return;

  try {
    const data = await api('/api/banner');
    const images = [...data.images];

    const [moved] = images.splice(draggedBannerIndex, 1);
    images.splice(targetIndex, 0, moved);

    await api('/api/banner/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images })
    });

    draggedBannerIndex = -1;
    await loadBanner();
    notifyFrontend();
    showAlert('✅ Banner order updated');
  } catch (err) {
    showAlert('❌ Reorder failed: ' + err.message, 'error');
  }
}

// ---------- Color sync ----------
document.getElementById('bannerTextColor')?.addEventListener('input', e => {
  const hex = document.getElementById('bannerTextColorHex');
  if (hex) hex.value = e.target.value;
});
document.getElementById('bannerTextColorHex')?.addEventListener('input', e => {
  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
    const picker = document.getElementById('bannerTextColor');
    if (picker) picker.value = e.target.value;
  }
});
document.getElementById('bannerDescriptionColor')?.addEventListener('input', e => {
  const hex = document.getElementById('bannerDescriptionColorHex');
  if (hex) hex.value = e.target.value;
});
document.getElementById('bannerDescriptionColorHex')?.addEventListener('input', e => {
  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
    const picker = document.getElementById('bannerDescriptionColor');
    if (picker) picker.value = e.target.value;
  }
});

// ---------- Drop zone ----------
const dropZone  = document.getElementById('bannerDropZone');
const fileInput = document.getElementById('bannerImages');

if (dropZone && fileInput) {
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    addPendingFiles([...e.dataTransfer.files]);
  });

  fileInput.addEventListener('change', e => {
    addPendingFiles([...e.target.files]);
    fileInput.value = '';
  });
}

function addPendingFiles(files) {
  const valid = files.filter(f => f.type.startsWith('image/'));
  if (!valid.length) {
    showAlert('⚠️ Please select image files only', 'error');
    return;
  }
  pendingBannerFiles.push(...valid);
  renderBannerPreview();
}

function renderBannerPreview() {
  const box = document.getElementById('bannerPreview');
  if (!box) return;

  if (!pendingBannerFiles.length) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = pendingBannerFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `
      <div class="image-preview">
        <img src="${url}" alt="preview">
        <button class="remove-preview" onclick="removePendingFile(${i})" title="Remove">
          <i class="fas fa-times"></i>
        </button>
        <span class="badge">NEW</span>
      </div>`;
  }).join('');
}

function removePendingFile(index) {
  pendingBannerFiles.splice(index, 1);
  renderBannerPreview();
}

// ---------- Publish Banner ----------
document.getElementById('publishBannerBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('publishBannerBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

  try {
    await api('/api/banner', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:             document.getElementById('bannerText')?.value || '',
        description:      document.getElementById('bannerDescription')?.value || '',
        textColor:        document.getElementById('bannerTextColor')?.value || '#ffffff',
        descriptionColor: document.getElementById('bannerDescriptionColor')?.value || '#ffffff',
        textAlign:        document.getElementById('bannerTextAlign')?.value || 'center'
      })
    });

    if (pendingBannerFiles.length) {
      const fd = new FormData();
      pendingBannerFiles.forEach(f => fd.append('images', f));
      await api('/api/banner/upload', { method: 'POST', body: fd });
      pendingBannerFiles = [];
      renderBannerPreview();
    }

    await loadBanner();
    notifyFrontend();
    showAlert('✅ Banner published successfully!');
  } catch (err) {
    console.error(err);
    showAlert('❌ Publish failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-rocket"></i> Publish Banner';
  }
});

async function deleteBannerImage(imagePath) {
  if (!confirm('Delete this banner image?')) return;
  try {
    await api('/api/banner/image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath })
    });
    showAlert('🗑️ Image deleted');
    loadBanner();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Delete failed: ' + err.message, 'error');
  }
}

/* ============================================================
   SERVICES
   ============================================================ */
function toggleIconInput() {
  const t = document.getElementById('serviceIconType')?.value;
  const iconGroup = document.getElementById('iconInputGroup');
  const imageGroup = document.getElementById('imageInputGroup');
  if (iconGroup)  iconGroup.style.display  = t === 'icon'  ? 'block' : 'none';
  if (imageGroup) imageGroup.style.display = t === 'image' ? 'block' : 'none';
}

function toggleEditIconInput() {
  const t = document.getElementById('editIconType')?.value;
  const iconGroup = document.getElementById('editIconInputGroup');
  const imageGroup = document.getElementById('editImageInputGroup');
  if (iconGroup)  iconGroup.style.display  = t === 'icon'  ? 'block' : 'none';
  if (imageGroup) imageGroup.style.display = t === 'image' ? 'block' : 'none';
}

async function loadServices() {
  try {
    const services = await api('/api/services');
    const list = document.getElementById('servicesList');
    if (!list) return;

    if (!services.length) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-briefcase"></i>
          <p>No services yet. Add one above!</p>
        </div>`;
      return;
    }

    list.innerHTML = services.map(s => {
      const iconHtml = s.iconType === 'image' && s.image
        ? `<img src="${s.image}" alt="${s.title}">`
        : `<i class="fas ${s.icon || 'fa-star'}"></i>`;

      return `
        <div class="service-item">
          <div class="service-icon-display">${iconHtml}</div>
          <div class="service-info">
            <h4>${s.title}</h4>
            <p>${s.description || 'No description'}</p>
          </div>
          <div class="service-actions">
            <button class="btn btn-primary btn-sm" onclick="openEditService(${s.id})">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteService(${s.id})">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    showAlert('Failed to load services: ' + err.message, 'error');
  }
}

document.getElementById('serviceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const fd = new FormData();
    fd.append('title', document.getElementById('serviceTitle')?.value || '');
    fd.append('description', document.getElementById('serviceDescription')?.value || '');
    fd.append('iconType', document.getElementById('serviceIconType')?.value || 'icon');
    fd.append('icon', document.getElementById('serviceIcon')?.value || 'fa-star');

    const img = document.getElementById('serviceImage')?.files?.[0];
    if (img) fd.append('image', img);

    await api('/api/services', { method: 'POST', body: fd });

    e.target.reset();
    setVal('serviceIcon', 'fa-star');
    toggleIconInput();

    showAlert('✅ Service added!');
    loadServices();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Add failed: ' + err.message, 'error');
  }
});

async function openEditService(id) {
  try {
    const services = await api('/api/services');
    const s = services.find(x => x.id === id);
    if (!s) return;

    setVal('editId', s.id);
    setVal('editTitle', s.title);
    setVal('editDescription', s.description || '');
    setVal('editIconType', s.iconType || 'icon');
    setVal('editIcon', s.icon || 'fa-star');

    const box = document.getElementById('editCurrentImage');
    if (box) {
      box.innerHTML = s.image
        ? `<img src="${s.image}" style="max-width:100px;border-radius:8px">`
        : '';
    }

    toggleEditIconInput();
    document.getElementById('editServiceModal')?.classList.add('active');
  } catch (err) {
    showAlert('❌ Failed to open editor: ' + err.message, 'error');
  }
}

function closeEditServiceModal() {
  document.getElementById('editServiceModal')?.classList.remove('active');
  document.getElementById('editServiceForm')?.reset();
}

document.getElementById('editServiceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById('editId')?.value;
    const fd = new FormData();
    fd.append('title', document.getElementById('editTitle')?.value || '');
    fd.append('description', document.getElementById('editDescription')?.value || '');
    fd.append('iconType', document.getElementById('editIconType')?.value || 'icon');
    fd.append('icon', document.getElementById('editIcon')?.value || 'fa-star');

    const img = document.getElementById('editImage')?.files?.[0];
    if (img) fd.append('image', img);

    await api(`/api/services/${id}`, { method: 'PUT', body: fd });
    closeEditServiceModal();
    showAlert('✅ Service updated!');
    loadServices();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Update failed: ' + err.message, 'error');
  }
});

async function deleteService(id) {
  if (!confirm('Delete this service?')) return;
  try {
    await api(`/api/services/${id}`, { method: 'DELETE' });
    showAlert('🗑️ Service deleted');
    loadServices();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Delete failed: ' + err.message, 'error');
  }
}

/* ============================================================
   CV
   ============================================================ */
let pendingCVFile = null;

async function loadCV() {
  try {
    const d = await api('/api/cv');
    setVal('cvTitle', d.title || '');
    setVal('cvDescription', d.description || '');

    const info = document.getElementById('cvFileInfo');
    if (!info) return;

    if (d.file) {
      info.innerHTML = `
        <div class="cv-file-box">
          <i class="fas fa-file-pdf pdf-icon"></i>
          <div class="file-details">
            <h4>${d.fileName || 'CV.pdf'}</h4>
            <p>${d.file}</p>
          </div>
          <a href="${d.file}" target="_blank" class="btn btn-secondary btn-sm">
            <i class="fas fa-eye"></i> View
          </a>
          <button class="btn btn-danger btn-sm" onclick="deleteCVFile()">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>`;
    } else {
      info.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-file-pdf"></i>
          <p>No CV file uploaded yet.</p>
        </div>`;
    }
  } catch (err) {
    showAlert('Failed to load CV: ' + err.message, 'error');
  }
}

const cvDropZone  = document.getElementById('cvDropZone');
const cvFileInput = document.getElementById('cvFile');

if (cvDropZone && cvFileInput) {
  cvDropZone.addEventListener('click', () => cvFileInput.click());

  cvDropZone.addEventListener('dragover', e => {
    e.preventDefault();
    cvDropZone.classList.add('dragover');
  });

  cvDropZone.addEventListener('dragleave', () => {
    cvDropZone.classList.remove('dragover');
  });

  cvDropZone.addEventListener('drop', e => {
    e.preventDefault();
    cvDropZone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') {
      pendingCVFile = f;
      renderCVPreview();
    } else {
      showAlert('⚠️ Only PDF files allowed', 'error');
    }
  });

  cvFileInput.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) {
      pendingCVFile = f;
      renderCVPreview();
    }
  });
}

function renderCVPreview() {
  const box = document.getElementById('cvPreview');
  if (!box) return;
  if (!pendingCVFile) { box.innerHTML = ''; return; }

  box.innerHTML = `
    <div class="cv-file-box">
      <i class="fas fa-file-pdf pdf-icon"></i>
      <div class="file-details">
        <h4>${pendingCVFile.name}</h4>
        <p>${(pendingCVFile.size / 1024).toFixed(1)} KB</p>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeCVFile()">
        <i class="fas fa-times"></i> Remove
      </button>
    </div>`;
}

function removeCVFile() {
  pendingCVFile = null;
  renderCVPreview();
  if (cvFileInput) cvFileInput.value = '';
}

document.getElementById('publishCVBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('publishCVBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

  try {
    const fd = new FormData();
    fd.append('title', document.getElementById('cvTitle')?.value || '');
    fd.append('description', document.getElementById('cvDescription')?.value || '');
    if (pendingCVFile) fd.append('file', pendingCVFile);

    await api('/api/cv', { method: 'PUT', body: fd });

    pendingCVFile = null;
    renderCVPreview();
    if (cvFileInput) cvFileInput.value = '';

    await loadCV();
    notifyFrontend();
    showAlert('✅ CV published successfully!');
  } catch (err) {
    console.error(err);
    showAlert('❌ Publish failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-rocket"></i> Publish CV';
  }
});

async function deleteCVFile() {
  if (!confirm('Delete the CV file?')) return;
  try {
    await api('/api/cv/file', { method: 'DELETE' });
    showAlert('🗑️ CV file deleted');
    loadCV();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Delete failed: ' + err.message, 'error');
  }
}

/* ============================================================
   PROJECTS
   ============================================================ */
async function loadProjects() {
  try {
    const projects = await api('/api/projects');
    const list = document.getElementById('projectsList');
    if (!list) return;

    if (!projects.length) {
      list.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fas fa-folder-open"></i>
          <p>No projects yet. Add one above!</p>
        </div>`;
      return;
    }

    list.innerHTML = projects.map(p => `
      <div class="image-item">
        <img src="${p.image}" alt="${p.title}">
        <button class="delete-btn" onclick="deleteProject(${p.id})" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
        <div class="image-item-info">
          <span>${p.title}</span>
          <button class="btn btn-primary btn-sm" onclick="openEditProject(${p.id})" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showAlert('Failed to load projects: ' + err.message, 'error');
  }
}

document.getElementById('projectForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const img = document.getElementById('projectImage')?.files?.[0];
    if (!img) return showAlert('⚠️ Please choose an image', 'error');

    const fd = new FormData();
    fd.append('title', document.getElementById('projectTitle')?.value || '');
    fd.append('description', document.getElementById('projectDescription')?.value || '');
    fd.append('image', img);

    await api('/api/projects', { method: 'POST', body: fd });
    e.target.reset();
    showAlert('✅ Project added!');
    loadProjects();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Add failed: ' + err.message, 'error');
  }
});

async function openEditProject(id) {
  try {
    const projects = await api('/api/projects');
    const p = projects.find(x => x.id === id);
    if (!p) return;

    setVal('editProjectId', p.id);
    setVal('editProjectTitle', p.title);
    setVal('editProjectDescription', p.description || '');

    const box = document.getElementById('editProjectCurrentImage');
    if (box) {
      box.innerHTML = `<img src="${p.image}" style="max-width:120px;border-radius:8px">`;
    }

    document.getElementById('editProjectModal')?.classList.add('active');
  } catch (err) {
    showAlert('❌ Failed to open editor: ' + err.message, 'error');
  }
}

function closeEditProjectModal() {
  document.getElementById('editProjectModal')?.classList.remove('active');
  document.getElementById('editProjectForm')?.reset();
}

document.getElementById('editProjectForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById('editProjectId')?.value;
    const fd = new FormData();
    fd.append('title', document.getElementById('editProjectTitle')?.value || '');
    fd.append('description', document.getElementById('editProjectDescription')?.value || '');

    const img = document.getElementById('editProjectImage')?.files?.[0];
    if (img) fd.append('image', img);

    await api(`/api/projects/${id}`, { method: 'PUT', body: fd });
    closeEditProjectModal();
    showAlert('✅ Project updated!');
    loadProjects();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Update failed: ' + err.message, 'error');
  }
});

async function deleteProject(id) {
  if (!confirm('Delete this project?')) return;
  try {
    await api(`/api/projects/${id}`, { method: 'DELETE' });
    showAlert('🗑️ Project deleted');
    loadProjects();
    notifyFrontend();
  } catch (err) {
    showAlert('❌ Delete failed: ' + err.message, 'error');
  }
}

/* ============================================================
   MODAL: Close on backdrop click / ESC
   ============================================================ */
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('active');
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  }
});

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAuth();
  if (!ok) return;
  loadAbout();
});