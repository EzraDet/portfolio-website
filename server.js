require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// ============= ADMIN CREDENTIALS =============
// ⚠️ Change these before deploying!
const ADMIN_USER = 'doungdet';
const ADMIN_PASS_HASH = bcrypt.hashSync('doungdet123!', 10);

// ============= EMAIL TRANSPORTER =============
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Verify email config on startup
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  mailer.verify((err, ok) => {
    if (err) {
      console.warn('⚠️ Email not configured:', err.message);
    } else {
      console.log('✅ Email ready to send');
    }
  });
} else {
  console.warn('⚠️ GMAIL_USER or GMAIL_APP_PASSWORD not set in .env');
}

// ============= MIDDLEWARE =============
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Session for login state
app.use(session({
  secret: 'change-this-secret-key-to-something-random',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// No-cache for HTML
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || req.path === '/admin' || req.path === '/login') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  next();
});

// No-cache for API
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// ============= FOLDERS =============
const DATA_DIR    = path.join(__dirname, 'data');
const IMAGES_DIR  = path.join(__dirname, 'public', 'images');
const BANNER_DIR  = path.join(IMAGES_DIR, 'banners');
const SERVICE_DIR = path.join(IMAGES_DIR, 'services');
const PROJECT_DIR = path.join(IMAGES_DIR, 'projects');
const CV_DIR      = path.join(IMAGES_DIR, 'cv');

[DATA_DIR, IMAGES_DIR, BANNER_DIR, SERVICE_DIR, PROJECT_DIR, CV_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const DB_FILE = path.join(DATA_DIR, 'database.json');

// ============= INIT DB =============
if (!fs.existsSync(DB_FILE)) {
  const initialData = {
    about: { mainText: "Hi, I am Doung Det", subText: "I am a web developer, Graphic designer, and Administrator" },
    banner: { images: [], text: "Doung Det", description: "Web Developer | Graphic Designer | Administrator", textColor: "#ffffff", descriptionColor: "#ffffff", textAlign: "center" },
    services: [
      { id: 1, title: "Front End Web Developer", description: "Building modern, responsive web interfaces.", iconType: "icon", icon: "fa-code", image: "" },
      { id: 2, title: "Web Designer", description: "Designing beautiful and functional websites.", iconType: "icon", icon: "fa-paint-brush", image: "" },
      { id: 3, title: "UX/UI Executive", description: "Crafting user-centered experiences and interfaces.", iconType: "icon", icon: "fa-object-group", image: "" },
      { id: 4, title: "Graphic Designer", description: "Creating visual concepts and brand identities.", iconType: "icon", icon: "fa-palette", image: "" },
      { id: 5, title: "Administrative", description: "Managing operations and administrative tasks.", iconType: "icon", icon: "fa-briefcase", image: "" },
      { id: 6, title: "SEO and Google Platform", description: "Optimizing for search engines and Google tools.", iconType: "icon", icon: "fa-search", image: "" }
    ],
    projects: [],
    cv: { title: "My Curriculum Vitae", description: "", file: "", fileName: "" },
    messages: [],
    lastUpdated: new Date().toISOString()
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// ============= MULTER =============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = IMAGES_DIR;
    if (req.path.includes('banner'))       dir = BANNER_DIR;
    else if (req.path.includes('service')) dir = SERVICE_DIR;
    else if (req.path.includes('project')) dir = PROJECT_DIR;
    else if (req.path.includes('cv'))      dir = CV_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname).toLowerCase());
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ============= HELPERS =============
const readDB  = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const deleteFileIfExists = (relPath) => {
  if (!relPath) return;
  const full = path.join(__dirname, 'public', relPath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ============= AUTH MIDDLEWARE =============
const requireAuth = (req, res, next) => {
  if (req.session && req.session.loggedIn) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  return res.redirect('/login');
};

// ============= AUTH ROUTES =============
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  if (username !== ADMIN_USER || !bcrypt.compareSync(password, ADMIN_PASS_HASH)) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  req.session.loggedIn = true;
  req.session.username = username;
  console.log(`✅ User logged in: ${username}`);
  res.json({ success: true, message: 'Logged in', username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out' });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.loggedIn) {
    return res.json({ success: true, loggedIn: true, username: req.session.username });
  }
  res.json({ success: true, loggedIn: false });
});

// ============= CONTACT FORM =============
const contactAttempts = new Map(); // simple rate limit

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    // Validate
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    // Rate limit: 1 message per minute per IP
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const lastAttempt = contactAttempts.get(ip) || 0;
    if (now - lastAttempt < 60000) {
      return res.status(429).json({
        success: false,
        message: 'Please wait a minute before sending another message.'
      });
    }
    contactAttempts.set(ip, now);

    // Check credentials
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({
        success: false,
        message: 'Email service not configured. Please contact me directly.'
      });
    }

    // Save to database as backup
    try {
      const db = readDB();
      if (!db.messages) db.messages = [];
      db.messages.push({
        id: db.messages.length ? Math.max(...db.messages.map(m => m.id)) + 1 : 1,
        name, email, subject, message,
        receivedAt: new Date().toISOString(),
        read: false
      });
      writeDB(db);
    } catch (e) {
      console.warn('Could not save message to DB:', e.message);
    }

    // Build email
    const mailOptions = {
      from: `"Portfolio Contact" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: subject ? `📩 ${subject}` : `📩 New message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h2 style="margin: 0;">📬 New Contact Message</h2>
            <p style="margin: 5px 0 0; opacity: 0.9;">From your portfolio website</p>
          </div>

          <div style="background: white; padding: 25px; border-radius: 0 0 10px 10px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1e293b; width: 100px;">Name:</td>
                <td style="padding: 10px 0; color: #334155;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1e293b;">Email:</td>
                <td style="padding: 10px 0; color: #334155;">
                  <a href="mailto:${escapeHtml(email)}" style="color: #4f46e5;">${escapeHtml(email)}</a>
                </td>
              </tr>
              ${subject ? `
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #1e293b;">Subject:</td>
                <td style="padding: 10px 0; color: #334155;">${escapeHtml(subject)}</td>
              </tr>` : ''}
            </table>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #4f46e5;">
              <p style="margin: 0 0 10px; font-weight: bold; color: #1e293b;">Message:</p>
              <p style="margin: 0; color: #334155; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</p>
            </div>

            <p style="margin-top: 25px; font-size: 12px; color: #94a3b8; text-align: center;">
              Sent from your portfolio at ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `
    };

    await mailer.sendMail(mailOptions);
    console.log(`📧 Contact email sent from ${email}`);
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (err) {
    console.error('❌ Contact error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
});

// (Admin-only) Get messages list
app.get('/api/messages', requireAuth, (req, res) => {
  const db = readDB();
  res.json(db.messages || []);
});

// (Admin-only) Mark message as read
app.put('/api/messages/:id/read', requireAuth, (req, res) => {
  try {
    const db = readDB();
    const id = parseInt(req.params.id);
    const msg = (db.messages || []).find(m => m.id === id);
    if (!msg) return res.status(404).json({ success: false, message: 'Not found' });
    msg.read = true;
    writeDB(db);
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// (Admin-only) Delete message
app.delete('/api/messages/:id', requireAuth, (req, res) => {
  try {
    const db = readDB();
    const id = parseInt(req.params.id);
    db.messages = (db.messages || []).filter(m => m.id !== id);
    writeDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============= ABOUT =============
app.get('/api/about', (req, res) => res.json(readDB().about));

app.put('/api/about', requireAuth, (req, res) => {
  try {
    const db = readDB();
    db.about = { ...db.about, ...req.body };
    db.lastUpdated = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, about: db.about });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============= BANNER =============
app.get('/api/banner', (req, res) => {
  const db = readDB();
  if (Array.isArray(db.banner)) {
    res.json({ images: db.banner, text: 'Doung Det', description: '', textColor: '#fff', descriptionColor: '#fff', textAlign: 'center' });
  } else {
    res.json(db.banner);
  }
});

app.put('/api/banner', requireAuth, (req, res) => {
  try {
    const db = readDB();
    const current = Array.isArray(db.banner) ? { images: db.banner } : db.banner;
    db.banner = { ...current, ...req.body };
    db.lastUpdated = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, banner: db.banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/banner/upload', requireAuth, (req, res) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    try {
      const files = req.files.map(f => `/images/banners/${f.filename}`);
      const db = readDB();
      const current = Array.isArray(db.banner) ? { images: db.banner } : db.banner;
      current.images = [...(current.images || []), ...files];
      db.banner = current;
      db.lastUpdated = new Date().toISOString();
      writeDB(db);
      res.json({ success: true, images: files, banner: db.banner });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
});

app.delete('/api/banner/image', requireAuth, (req, res) => {
  try {
    const { imagePath } = req.body;
    const db = readDB();
    const current = Array.isArray(db.banner) ? { images: db.banner } : db.banner;
    current.images = (current.images || []).filter(i => i !== imagePath);
    db.banner = current;
    db.lastUpdated = new Date().toISOString();
    writeDB(db);
    deleteFileIfExists(imagePath);
    res.json({ success: true, banner: db.banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/banner/replace', requireAuth, upload.single('images'), (req, res) => {
  try {
    const index = parseInt(req.body.replaceIndex);
    if (!req.file) return res.status(400).json({ success: false, message: 'No file' });
    const db = readDB();
    const current = Array.isArray(db.banner) ? { images: db.banner } : db.banner;
    if (index < 0 || index >= current.images.length) return res.status(400).json({ success: false, message: 'Invalid index' });
    deleteFileIfExists(current.images[index]);
    current.images[index] = `/images/banners/${req.file.filename}`;
    db.banner = current;
    writeDB(db);
    res.json({ success: true, banner: db.banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/banner/reorder', requireAuth, (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images)) return res.status(400).json({ success: false, message: 'images must be array' });
    const db = readDB();
    const current = Array.isArray(db.banner) ? { images: db.banner } : db.banner;
    current.images = images;
    db.banner = current;
    writeDB(db);
    res.json({ success: true, banner: db.banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============= SERVICES =============
app.get('/api/services', (req, res) => res.json(readDB().services));

app.post('/api/services', requireAuth, upload.single('image'), (req, res) => {
  try {
    const db = readDB();
    const newService = {
      id: db.services.length ? Math.max(...db.services.map(s => s.id)) + 1 : 1,
      title: req.body.title,
      description: req.body.description || '',
      iconType: req.body.iconType || 'icon',
      icon: req.body.icon || 'fa-star',
      image: req.file ? `/images/services/${req.file.filename}` : ''
    };
    db.services.push(newService);
    db.lastUpdated = new Date().toISOString();
    writeDB(db);
    res.status(201).json({ success: true, service: newService });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/services/:id', requireAuth, upload.single('image'), (req, res) => {
  try {
    const db = readDB();
    const id = parseInt(req.params.id);
    const index = db.services.findIndex(s => s.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Not found' });
    const updated = { ...db.services[index], title: req.body.title, description: req.body.description || '', iconType: req.body.iconType || 'icon', icon: req.body.icon || 'fa-star' };
    if (req.file) {
      deleteFileIfExists(db.services[index].image);
      updated.image = `/images/services/${req.file.filename}`;
    }
    db.services[index] = updated;
    writeDB(db);
    res.json({ success: true, service: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/services/:id', requireAuth, (req, res) => {
  try {
    const db = readDB();
    const id = parseInt(req.params.id);
    const s = db.services.find(x => x.id === id);
    if (s) deleteFileIfExists(s.image);
    db.services = db.services.filter(x => x.id !== id);
    writeDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============= PROJECTS =============
app.get('/api/projects', (req, res) => res.json(readDB().projects));

app.post('/api/projects', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Image required' });
    const db = readDB();
    const p = {
      id: db.projects.length ? Math.max(...db.projects.map(x => x.id)) + 1 : 1,
      title: req.body.title,
      description: req.body.description || '',
      image: `/images/projects/${req.file.filename}`,
      createdAt: new Date().toISOString()
    };
    db.projects.push(p);
    writeDB(db);
    res.status(201).json({ success: true, project: p });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/projects/:id', requireAuth, upload.single('image'), (req, res) => {
  try {
    const db = readDB();
    const id = parseInt(req.params.id);
    const index = db.projects.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Not found' });
    const updated = { ...db.projects[index], title: req.body.title, description: req.body.description || '' };
    if (req.file) {
      deleteFileIfExists(db.projects[index].image);
      updated.image = `/images/projects/${req.file.filename}`;
    }
    db.projects[index] = updated;
    writeDB(db);
    res.json({ success: true, project: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  try {
    const db = readDB();
    const id = parseInt(req.params.id);
    const p = db.projects.find(x => x.id === id);
    if (p) deleteFileIfExists(p.image);
    db.projects = db.projects.filter(x => x.id !== id);
    writeDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============= CV =============
app.get('/api/cv', (req, res) => res.json(readDB().cv));

app.put('/api/cv', requireAuth, upload.single('file'), (req, res) => {
  try {
    const db = readDB();
    const updated = { title: req.body.title, description: req.body.description || '' };
    if (req.file) {
      deleteFileIfExists(db.cv.file);
      updated.file = `/images/cv/${req.file.filename}`;
      updated.fileName = req.file.originalname;
    } else {
      updated.file = db.cv.file;
      updated.fileName = db.cv.fileName;
    }
    db.cv = updated;
    writeDB(db);
    res.json({ success: true, cv: db.cv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/cv/file', requireAuth, (req, res) => {
  try {
    const db = readDB();
    deleteFileIfExists(db.cv.file);
    db.cv.file = '';
    db.cv.fileName = '';
    writeDB(db);
    res.json({ success: true, cv: db.cv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============= REFRESH =============
app.get('/api/refresh', (req, res) => {
  try {
    const db = readDB();
    const banner = Array.isArray(db.banner) ? { images: db.banner, text: 'Doung Det', description: '', textColor: '#fff', descriptionColor: '#fff', textAlign: 'center' } : db.banner;
    res.json({
      success: true,
      timestamp: Date.now(),
      data: { about: db.about, banner, services: db.services, projects: db.projects, cv: db.cv }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/refresh', (req, res) => {
  try {
    const db = readDB();
    db.lastUpdated = new Date().toISOString();
    writeDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============= PAGES =============
app.get('/login', (req, res) => {
  if (req.session && req.session.loggedIn) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404
app.use((req, res) => {
  console.log(`⚠️ 404: ${req.method} ${req.url}`);
  res.status(404).send('Not found');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ SERVER ERROR:', err);
  res.status(500).json({ success: false, message: err.message });
});

// ============= START =============
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 Admin panel at http://localhost:${PORT}/admin`);
  console.log(`🔐 Login page at http://localhost:${PORT}/login`);
  console.log(`📁 Images saved to: ${IMAGES_DIR}\n`);
});