/* ============================================================
   PORTFOLIO FRONTEND — Main Script
   ============================================================ */

// ============ Helpers ============
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

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json().catch(() => ({}));
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timeout');
    throw err;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============ BANNER ============
let slides = [];
let currentSlide = 0;
let slideInterval = null;

async function loadBanner() {
  try {
    const data = await api('/api/banner');

    const bannerData = Array.isArray(data)
      ? { images: data, text: 'DET DOUNG', description: '', textColor: '#ffffff', descriptionColor: '#ffffff', textAlign: 'center' }
      : data;

    const title   = document.getElementById('bannerTitle');
    const desc    = document.getElementById('bannerDescription');
    const overlay = document.getElementById('bannerOverlay');

    if (title) {
      title.textContent = bannerData.text || 'DET DOUNG';
      title.style.color = bannerData.textColor || '#ffffff';
    }

    if (desc) {
      desc.textContent = bannerData.description || '';
      desc.style.color = bannerData.descriptionColor || '#ffffff';
    }

    if (overlay) {
      const align = bannerData.textAlign || 'center';
      overlay.style.textAlign = align;
      overlay.style.alignItems =
        align === 'left'  ? 'flex-start' :
        align === 'right' ? 'flex-end'   : 'center';
    }

    slides = bannerData.images || [];

    const slider = document.getElementById('slider');
    if (!slider) return;

    if (!slides.length) {
      slider.style.backgroundImage = 'linear-gradient(135deg, #4f46e5, #06b6d4)';
      const dots = document.getElementById('dots');
      if (dots) dots.innerHTML = '';
      return;
    }

    slider.style.backgroundImage = `url('${slides[0]}')`;

    const dots = document.getElementById('dots');
    if (dots) {
      dots.innerHTML = '';
      slides.forEach((_, i) => {
        const d = document.createElement('div');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        d.onclick = () => goToSlide(i);
        dots.appendChild(d);
      });
    }

    startAutoSlide();
  } catch (err) {
    console.error('Banner:', err.message);
  }
}

function changeSlide(dir) {
  if (!slides.length) return;
  currentSlide = (currentSlide + dir + slides.length) % slides.length;
  updateSlide();
}

function goToSlide(i) {
  currentSlide = i;
  updateSlide();
}

function updateSlide() {
  const slider = document.getElementById('slider');
  if (slider) slider.style.backgroundImage = `url('${slides[currentSlide]}')`;

  document.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('active', i === currentSlide);
  });

  resetAutoSlide();
}

function startAutoSlide() {
  clearInterval(slideInterval);
  slideInterval = setInterval(() => changeSlide(1), 5000);
}

function resetAutoSlide() {
  clearInterval(slideInterval);
  startAutoSlide();
}

// ============ ABOUT ============
async function loadAbout() {
  try {
    const data = await api('/api/about');
    const main = document.getElementById('aboutMainText');
    const sub  = document.getElementById('aboutSubText');

    if (main) main.textContent = data.mainText || '';
    if (sub)  sub.textContent  = data.subText  || '';
  } catch (err) {
    console.error('About:', err.message);
  }
}

// ============ SERVICES ============
async function loadServices() {
  try {
    const services = await api('/api/services');
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;

    if (!services.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fas fa-briefcase"></i>
          <p>No services yet.</p>
        </div>`;
      return;
    }

    grid.innerHTML = services.map(s => {
      const iconHtml = s.iconType === 'image' && s.image
        ? `<img src="${s.image}" alt="${escapeHtml(s.title)}" class="service-icon-img">`
        : `<i class="fas ${s.icon || 'fa-star'}"></i>`;

      return `
        <div class="service-card">
          ${iconHtml}
          <h3>${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.description || '')}</p>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Services:', err.message);
  }
}

// ============ CV ============
async function loadCV() {
  try {
    const data = await api('/api/cv');

    const title = document.getElementById('cvSectionTitle');
    const desc  = document.getElementById('cvDescription');
    const btn   = document.getElementById('cvDownloadBtn');

    if (title) title.textContent = data.title || 'My CV';
    if (desc)  desc.textContent  = data.description || '';

    if (btn) {
      if (data.file) {
        btn.href = data.file;
        btn.download = data.fileName || 'CV.pdf';
        btn.style.display = 'inline-flex';
      } else {
        btn.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('CV:', err.message);
  }
}

// ============ PROJECTS ============
let currentProjects = [];

async function loadProjects() {
  try {
    const projects = await api('/api/projects');
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    currentProjects = projects;

    if (!projects.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>No projects yet. Check back soon!</p>
        </div>`;
      return;
    }

    grid.innerHTML = projects.map(p => `
      <div class="project-card" onclick="openProjectModal(${p.id})">
        <div class="project-card-image">
          <img src="${p.image}" alt="${escapeHtml(p.title)}"
               onerror="this.src='https://via.placeholder.com/600x400/4f46e5/ffffff?text=Project'">
          <div class="project-card-view">
            <i class="fas fa-expand"></i>
          </div>
        </div>

        <div class="project-card-content">
          <h3 class="project-card-title">${escapeHtml(p.title)}</h3>
          ${p.description
            ? `<p class="project-card-description">${escapeHtml(p.description)}</p>`
            : `<p class="project-card-description" style="color:#cbd5e1;font-style:italic;">No description</p>`}
        </div>

        <div class="project-card-footer">
          <span class="project-card-readmore">
            Read more <i class="fas fa-arrow-right"></i>
          </span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Projects:', err.message);
  }
}

function openProjectModal(id) {
  const p = currentProjects.find(x => x.id === id);
  if (!p) return;

  const img  = document.getElementById('modalImage');
  const cap  = document.getElementById('modalCaption');
  const desc = document.getElementById('modalDescription');

  if (img)  { img.src = p.image; img.alt = p.title; }
  if (cap)  cap.textContent  = p.title;
  if (desc) desc.textContent = p.description || 'No description';

  const modal = document.getElementById('projectModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal() {
  const modal = document.getElementById('projectModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ============ CONTACT ============
async function submitContact(e) {
  e.preventDefault();

  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;

  const data = {
    name:    form.querySelector('[name="name"]')?.value.trim()    || '',
    email:   form.querySelector('[name="email"]')?.value.trim()   || '',
    subject: form.querySelector('[name="subject"]')?.value.trim() || '',
    message: form.querySelector('[name="message"]')?.value.trim() || ''
  };

  if (!data.name || !data.email || !data.message) {
    alert('Please fill in your name, email, and message.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    alert('Please enter a valid email address.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeout);

    const result = await res.json().catch(() => ({}));

    if (res.ok && result.success) {
      btn.innerHTML = '<i class="fas fa-check"></i> Sent!';
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      form.reset();

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 2500);

      alert('✅ Thank you! Your message has been sent.');
    } else {
      throw new Error(result.message || 'Failed to send');
    }
  } catch (err) {
    console.error('Contact error:', err);
    let msg = '❌ Sorry, could not send the message.';
    if (err.name === 'AbortError') msg = '❌ Request timed out. Please try again.';
    else if (err.message) msg = '❌ ' + err.message;
    alert(msg);
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

window.submitContact = submitContact;

// ============ NAVBAR / SMOOTH SCROLL ============
document.querySelector('.hamburger')?.addEventListener('click', () => {
  document.querySelector('.nav-menu')?.classList.toggle('active');
});

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
      document.querySelector('.nav-menu')?.classList.remove('active');
    }
  });
});

// ============ AUTO REFRESH ============
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshAll();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'portfolio_updated') {
    console.log('🔄 Content updated, refreshing...');
    refreshAll();
  }
});

// ============ REFRESH ALL ============
async function refreshAll() {
  loadBanner().catch(() => {});
  loadAbout().catch(() => {});
  loadServices().catch(() => {});
  loadCV().catch(() => {});
  loadProjects().catch(() => {});
}

window.refreshPortfolio = refreshAll;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', refreshAll);