/**
 * ESA Engineering - Node.js fallback server
 * Serves the same static frontend as Spring Boot (src/main/resources/static)
 * and implements all /api/* endpoints expected by admin-data.js, auth.js,
 * content.js, tracking.js, main.js, payment.js
 *
 * Run: npm start  -> http://localhost:8080
 * Spring Boot also runs on 8080 (mvn spring-boot:run). This server is a drop-in
 * replacement when Java is not available, and ensures "Backend offline" never appears.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // for the password reset tokens

const PORT = process.env.PORT || 8080;
// Consultation fee, mirrors app.booking.consultation-fee in the Spring app.
const CONSULTATION_FEE = Number(process.env.CONSULTATION_FEE || 50);
const STATIC_DIR = path.join(__dirname, 'src/main/resources/static');
const DATA_DIR = process.env.ESA_DATA_DIR || path.join(__dirname, 'data');
const DEMO_JWT_SECRET = 'esa-local-dev-secret-change-me-in-production-32chars';
const JWT_SECRET = process.env.JWT_SECRET || DEMO_JWT_SECRET;
const JWT_TTL = '12h';
const DEMO_EMAIL_PREVIEW_ENABLED = process.env.ESA_DEMO_EMAIL_PREVIEW === 'true';
const DEMO_CARD_PAYMENTS_ENABLED = String(process.env.ESA_DEMO_CARD_PAYMENTS || 'true').toLowerCase() !== 'false';
const IS_PRODUCTION = ['production', 'prod'].includes(String(process.env.NODE_ENV || '').toLowerCase());
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASSWORD = String(process.env.SMTP_PASSWORD || '');
const MAIL_FROM = String(process.env.MAIL_FROM || SMTP_USER).trim();
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
  || (!process.env.SMTP_SECURE && SMTP_PORT === 465);
const nodemailer = require('nodemailer');
const mailTransporter = SMTP_HOST && MAIL_FROM ? nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number.isFinite(SMTP_PORT) ? SMTP_PORT : 587,
  secure: SMTP_SECURE,
  auth: SMTP_USER && SMTP_PASSWORD ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000
}) : null;

function cleanPublicSiteOrigin(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password
        || url.search || url.hash || (url.pathname && url.pathname !== '/')) return '';
    if (IS_PRODUCTION && url.protocol !== 'https:') return '';
    return url.origin;
  } catch (_) {
    return '';
  }
}
const PUBLIC_SITE_ORIGIN = cleanPublicSiteOrigin(process.env.PUBLIC_SITE_URL);
const PUBLIC_SITEMAP_PAGES = [
  'index.html', 'about.html', 'services.html', 'commissioning.html', 'appraisals.html',
  'optimisation.html', 'waste-management.html', 'dangerous-goods.html', 'projects.html',
  'contact.html', 'team.html', 'resources.html', 'safety-standards.html', 'privacy-policy.html'
];
const PRIVATE_SITE_PAGES = [
  'dashboard.html', 'customers.html', 'enquiries.html', 'bookings.html', 'payments.html',
  'settings.html', 'content.html', 'auditLog.html', 'caseStudies.html', 'aboutPageAdmin.html',
  'accountAdmin.html', 'portal.html', 'signin.html', 'signup.html', 'forgot-password.html',
  'reset-password.html', 'booking.html', 'payment.html', 'receipt.html'
];

// the known local key is handy for the project demo, but must never be used on a real deployment
if (IS_PRODUCTION && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEMO_JWT_SECRET)) {
  throw new Error('Set a unique JWT_SECRET before running ESA in production.');
}
if (IS_PRODUCTION && DEMO_EMAIL_PREVIEW_ENABLED) {
  throw new Error('Demo email previews must not be enabled in production.');
}
if (IS_PRODUCTION && DEMO_CARD_PAYMENTS_ENABLED) {
  throw new Error('Demo card payments must not be enabled in production. Set ESA_DEMO_CARD_PAYMENTS=false.');
}

function makeDemoEmailPreview(email, subject, body, actionUrl, role) {
  // Only customer accounts using reserved example.com emails get a demo preview.
  if (!DEMO_EMAIL_PREVIEW_ENABLED || String(role || '').toUpperCase() !== 'CUSTOMER'
      || !/@example\.com$/i.test(String(email || '').trim())) return null;
  const preview = { subject: subject, body: body };
  if (actionUrl) preview.actionUrl = actionUrl;
  return preview;
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: ['text/plain','application/octet-stream'], limit: '5mb' }));

// ---- tiny JSON DB helpers ----
function dbFile(name) { return path.join(DATA_DIR, name + '.json'); }
function load(name, def) {
  try {
    if (!fs.existsSync(dbFile(name))) return def;
    return JSON.parse(fs.readFileSync(dbFile(name), 'utf8'));
  } catch { return def; }
}
function save(name, data) {
  const file = dbFile(name);
  const temp = file + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch (_) { /* temp file may not exist */ }
    throw error;
  }
}
function auditFields(body) {
  const hidden = ['password', 'currentPassword', 'newPassword', 'cardNumber', 'cardExpiry', 'cardCvv', 'token'];
  const fields = Object.keys(body || {}).filter(key => !hidden.includes(key));
  return fields.length ? fields.join(', ') : 'no fields';
}

// Send mail when SMTP is configured. Otherwise keep a private local outbox copy.
function saveMailToOutbox(to, subject, body) {
  const dir = path.join(DATA_DIR, 'outbox');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const safeSubject = String(subject || '').replace(/[\r\n]+/g, ' ').slice(0, 180);
  const name = Date.now() + '-' + crypto.randomUUID() + '.txt';
  const text = 'To: ' + to + '\nSubject: ' + safeSubject + '\nDate: ' + new Date().toISOString() + '\n\n' + String(body || '') + '\n';
  fs.writeFileSync(path.join(dir, name), text, { mode: 0o600, flag: 'wx' });
}

async function sendMail(to, subject, body) {
  const recipient = String(to || '').trim();
  if (!recipient) return { status: 'not-configured' };
  const safeSubject = String(subject || '').replace(/[\r\n]+/g, ' ').slice(0, 180);
  if (mailTransporter) {
    try {
      await mailTransporter.sendMail({ from: MAIL_FROM, to: recipient, subject: safeSubject, text: String(body || '') });
      return { status: 'sent' };
    } catch (_) {
      console.warn('[mail] SMTP delivery failed; saving a local outbox copy.');
    }
  }
  try {
    saveMailToOutbox(recipient, safeSubject, body);
    return { status: 'outbox' };
  } catch (_) {
    console.error('[mail] Could not send the message or save it to the local outbox.');
    return { status: 'failed' };
  }
}

async function sendEnquiryNotifications(contact) {
  const customerBody = 'Hi ' + contact.fullName + ',\n\n' +
    'Thanks for contacting ESA Engineering. Your enquiry reference is #' + contact.id + '.\n' +
    'This is an automatic acknowledgement, not an appointment confirmation or engineering advice.\n' +
    'Our team will review your message. For urgent matters, please call 0402 464 823.\n\n- ESA Engineering';
  const teamAddress = String(process.env.ENQUIRY_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || settings.adminEmail || '').trim();
  const teamBody = 'New website enquiry #' + contact.id + '\n' +
    'Name: ' + contact.fullName + '\nEmail: ' + contact.email + '\nService: ' + contact.serviceName +
    '\n\nMessage:\n' + (contact.description || '-');
  const results = await Promise.all([
    sendMail(contact.email, 'Enquiry received - ESA Engineering', customerBody),
    sendMail(teamAddress, 'New ESA website enquiry #' + contact.id, teamBody)
  ]);
  const acknowledgement = results[0];
  const teamNotification = results[1];
  const allSent = acknowledgement.status === 'sent' && teamNotification.status === 'sent';
  let message;
  if (allSent) {
    message = 'Thanks — your enquiry is recorded. A confirmation email has been sent and the ESA team has been notified.';
  } else if (acknowledgement.status === 'sent') {
    message = 'Thanks — your enquiry is recorded and a confirmation email was sent. ESA team email delivery is not available right now; call us for urgent requests.';
  } else if (teamNotification.status === 'sent') {
    message = 'Thanks — your enquiry is recorded and the ESA team has been notified. A confirmation email could not be sent, so please save this page for your reference.';
  } else if (!mailTransporter) {
    message = 'Thanks — your enquiry is recorded. Automatic email delivery is not configured, so no email was sent. Call ESA for urgent requests.';
  } else if (teamNotification.status === 'outbox') {
    message = 'Thanks — your enquiry is recorded. Email delivery failed, but a copy was saved for the ESA team. Call us for urgent requests.';
  } else if (acknowledgement.status === 'outbox') {
    message = 'Thanks — your enquiry is recorded. A confirmation email could not be delivered, but a copy was saved locally. Call ESA for urgent requests.';
  } else {
    message = 'Thanks — your enquiry is recorded, but no email could be sent. Call ESA for urgent requests.';
  }
  return {
    customerAcknowledgement: acknowledgement.status,
    teamNotification: teamNotification.status,
    smtpConfigured: Boolean(mailTransporter),
    message
  };
}

// ---- initial data ----
let users = load('users', []);
// Upgrade any old plain-text password rows as soon as the server starts.
let migratedPasswords = false;
if (Array.isArray(users)) {
  users.forEach(user => {
    if (user && user.password && !/^\$2[aby]\$/.test(String(user.password))) {
      user.password = bcrypt.hashSync(String(user.password), 10);
      migratedPasswords = true;
    }
  });
  if (migratedPasswords) save('users', users);
}
let contacts = load('contacts', []);
let bookings = load('bookings', []);
let payments = load('payments', []);
let pages = load('pages', null);
let blocks = load('blocks', []); // {pageId, key, value, defaultValue, label, html}
let resets = load('password-resets', []); // {token, email, expires}
let settings = load('settings', {
  siteName: 'ESA Engineering',
  adminEmail: 'admin@esaengineering.com.au',
  timezone: 'Australia/Melbourne',
  language: 'en-AU'
});
let aboutContent = load('aboutContent', {
  story: 'ESA Engineering Services Australia delivers technical excellence across regional and remote Australia.',
  heading1: 'Engineering Excellence Since 2004',
  paragraph1: 'We provide plant commissioning, utility appraisals, production optimisation, waste management and dangerous goods consulting.',
  heading2: 'Our Specialists',
  paragraph2: 'Our team combines decades of field experience with a focus on safety and compliance.',
  paragraph3: '',
  specialist1Name: 'John Smith',
  specialist1Position: 'Lead Engineer',
  specialist1Biography: '20+ years in plant commissioning.',
  specialist2Name: 'Jane Doe',
  specialist2Position: 'Operations Manager',
  specialist2Biography: 'Expert in waste management and safety standards.'
});

if (!pages) {
  pages = [
    { id: 1, title: 'Home', slug: 'index.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 2, title: 'About Us', slug: 'about.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 3, title: 'Services', slug: 'services.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 4, title: 'Projects', slug: 'projects.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 5, title: 'Contact Us', slug: 'contact.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 6, title: 'Commissioning', slug: 'commissioning.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 7, title: 'Appraisals', slug: 'appraisals.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 8, title: 'Optimisation', slug: 'optimisation.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 9, title: 'Waste Management', slug: 'waste-management.html', status: 'published', updatedAt: new Date().toISOString() },
    { id: 10, title: 'Dangerous Goods', slug: 'dangerous-goods.html', status: 'published', updatedAt: new Date().toISOString() }
  ];
  save('pages', pages);
}

// seed an easy account for local work; production has to supply its own first admin
function ensureAdmin() {
  const production = process.env.NODE_ENV === 'production';
  if (production && users.some(u => String(u.email).toLowerCase() === 'admin@esaengineering.com.au' &&
      (u.password === 'Admin123' || bcrypt.compareSync('Admin123', String(u.password || ''))))) {
    throw new Error('The sample admin account is in the production data directory. Replace it before starting.');
  }
  const hasAdmin = users.some(u => u.role === 'ADMIN');
  if (hasAdmin) return;


  const email = (process.env.ADMIN_EMAIL || (production ? '' : 'admin@esaengineering.com.au')).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (production ? '' : 'Admin123');
  const fullName = process.env.ADMIN_NAME || 'ESA Administrator';
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first production admin.');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Set a valid ADMIN_EMAIL before creating the first admin.');
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters and include uppercase, lowercase and a number.');
  }
  if (production && email === 'admin@esaengineering.com.au' && password === 'Admin123') {
    throw new Error('The sample admin credentials are not allowed in production.');
  }

  const hashed = bcrypt.hashSync(password, 10);
  const parts = fullName.trim().split(/\s+/);
  const admin = {
    id: users.length ? Math.max(...users.map(u => Number(u.id) || 0)) + 1 : 1,
    fullName: fullName,
    firstName: parts[0] || 'ESA',
    lastName: parts.slice(1).join(' '),
    name: fullName,
    email: email,
    password: hashed,
    phone: '',
    phoneNumber: '',
    company: 'ESA',
    companyName: 'ESA',
    role: 'ADMIN',
    active: true
  };
  users.push(admin);
  save('users', users);
  console.log('');
  console.log('=== ESA admin portal ready (Node fallback) ===');
  console.log('    sign in : http://localhost:' + PORT + '/signin.html');
  console.log('    email   : ' + admin.email);
  if (!production) console.log('    password: ' + password + ' (local demo only)');
  console.log('');
}
ensureAdmin();

// ---- helpers ----
function issueToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_TTL });
}
function verifyToken(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}
function authUserFromReq(req) {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) return null;
  return users.find(u => u.email === payload.email) || null;
}
function requireAdmin(req, res, next) {
  // No token = no access. There is deliberately no "dev open" path: an omitted
  // Authorization header used to let anyone through the entire admin API.
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'Sign in to continue', success: false });
  const payload = verifyToken(auth);
  if (!payload) return res.status(401).json({ message: 'Your session has expired, please sign in again', success: false });
  if (payload.role !== 'ADMIN') return res.status(403).json({ message: 'Admin access required', success: false });
  req.userPayload = payload;
  next();
}
function requireCustomer(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'Sign in to view your portal', success: false });
  const payload = verifyToken(auth);
  if (!payload || !payload.email) return res.status(401).json({ message: 'Your session has expired - please sign in again', success: false });
  req.customerEmail = payload.email;
  req.customerRole = payload.role;
  next();
}
function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); }

// ---- HEALTH ----
app.get('/api/health', (req, res) => res.json({ status: 'UP', backend: 'Node fallback', timestamp: new Date().toISOString(), demoCardPaymentsEnabled: DEMO_CARD_PAYMENTS_ENABLED }));
app.get('/api/admin/health', (req, res) => res.json({ status: 'UP', backend: 'Node fallback', timestamp: new Date().toISOString(), demoCardPaymentsEnabled: DEMO_CARD_PAYMENTS_ENABLED }));

app.get('/robots.txt', (req, res) => {
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /data/'];
  PRIVATE_SITE_PAGES.forEach(page => lines.push('Disallow: /' + page));
  if (PUBLIC_SITE_ORIGIN) lines.push('', 'Sitemap: ' + PUBLIC_SITE_ORIGIN + '/sitemap.xml');
  res.type('text/plain').send(lines.join('\n') + '\n');
});
app.get('/sitemap.xml', (req, res) => {
  if (!PUBLIC_SITE_ORIGIN) {
    return res.status(404).type('text/plain').send('Set PUBLIC_SITE_URL to the official site origin to enable the sitemap.');
  }
  const urls = PUBLIC_SITEMAP_PAGES.map(page => '  <url><loc>' + PUBLIC_SITE_ORIGIN + '/' + page + '</loc></url>').join('\n');
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n');
});

// ---- AUTH API (/api/auth) ----
// ---- simple rate limiter for the auth endpoints ----
// stops anyone brute-forcing passwords or spamming the reset emails. its an
// in-memory counter so it forgets on restart, which is fine at our traffic.
// TODO: move this to redis or similar if we ever run more than one instance.
const authHits = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_MAX_HITS = 30; // normal humans never get near this
app.use('/api/auth', (req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  let hit = authHits.get(ip);
  if (!hit || now - hit.start > AUTH_WINDOW_MS) hit = { start: now, count: 0 };
  hit.count++;
  authHits.set(ip, hit);
  if (hit.count > AUTH_MAX_HITS) {
    return res.status(429).json({ message: 'Too many attempts from here. Wait 15 minutes and try again.', success: false });
  }
  next();
});

function makeRateLimit(maxHits, windowMs, message) {
  const windows = new Map();
  return (req, res, next) => {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    let window = windows.get(ip);
    if (!window || now - window.start >= windowMs) window = { start: now, count: 0 };
    window.count++;
    windows.set(ip, window);
    if (windows.size > 2000) {
      for (const [key, value] of windows) {
        if (now - value.start >= windowMs) windows.delete(key);
      }
    }
    if (window.count > maxHits) {
      return res.status(429).json({ message: message, success: false });
    }
    next();
  };
}
const limitEnquiries = makeRateLimit(10, 15 * 60 * 1000, 'Too many enquiries from here. Please wait a little before trying again.');
const limitBookings = makeRateLimit(15, 15 * 60 * 1000, 'Too many booking requests from here. Please wait a little before trying again.');

app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, fullName, companyName, email, password, phone, phoneNumber } = req.body || {};
  const name = String(fullName || ((firstName || '') + ' ' + (lastName || '')).trim()).trim();
  const company = String(companyName || '').trim();
  const contactPhone = String(phone || phoneNumber || '').trim();
  if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required', success: false });
  if (name.length > 100) return res.status(400).json({ message: 'Name must be 100 characters or fewer', success: false });
  if (company.length > 200) return res.status(400).json({ message: 'Company name must be 200 characters or fewer', success: false });
  if (contactPhone.length > 40) return res.status(400).json({ message: 'Phone must be 40 characters or fewer', success: false });
  const normEmail = String(email).trim().toLowerCase();
  if (normEmail.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) return res.status(400).json({ message: 'Enter a valid email address', success: false });
  if (users.some(u => String(u.email || '').toLowerCase() === normEmail)) return res.status(409).json({ message: 'That email already has an account. Try signing in instead.', success: false });
  if (typeof password !== 'string' || password.length > 200 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return res.status(400).json({ message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number', success: false });

  const id = users.length ? Math.max(...users.map(u=>u.id))+1 : 1;
  const hashed = bcrypt.hashSync(password, 10);
  const user = {
    id, fullName: name, name, firstName: firstName || name.split(' ')[0], lastName: lastName || name.split(' ').slice(1).join(' '),
    email: normEmail, password: hashed, phone: contactPhone, phoneNumber: contactPhone,
    company: company, companyName: company, role: 'CUSTOMER', active: true
  };
  users.push(user);
  save('users', users);
  const token = issueToken(user);
  res.status(201).json({ message: 'Account created successfully', success: true, token, user: { id: user.id, name: user.fullName, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, company: user.company, companyName: user.companyName, role: user.role.toLowerCase() } });
});

app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required', success: false });
  const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return res.status(401).json({ message: 'Invalid email or password', success: false });
  if (user.active === false) return res.status(403).json({ message: 'This account is inactive. Contact ESA for help.', success: false });
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid email or password', success: false });
  const token = issueToken(user);
  const msg = user.role === 'ADMIN' ? 'Admin Login Successful' : 'Customer Login Successful';
  res.json({ message: msg, success: true, token, user: { id: user.id, name: user.fullName, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, company: user.company, companyName: user.companyName, role: user.role.toLowerCase() } });
});

app.get('/api/auth/me', (req, res) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) return res.status(401).json({ message: 'Your session has expired, please sign in again', success: false });
  const user = users.find(u => u.email === payload.email);
  if (!user) return res.status(401).json({ message: 'Your session has expired, please sign in again', success: false });
  res.json({ user: { id: user.id, name: user.fullName, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, company: user.company, companyName: user.companyName, role: user.role.toLowerCase() } });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Signed out', success: true });
});

// ---- password reset (the forgot password page) ----
// step 1: they type their email, we make a token that lasts 1 hour
app.post('/api/auth/forgot-password', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Please put in your email address.' });
  const user = users.find(u => String(u.email).toLowerCase() === email);
  // say ok even when we dont know the email so people cant use it to probe accounts
  let demoEmail = null;
  if (user) {
    const token = crypto.randomBytes(20).toString('hex');
    resets = resets.filter(r => r.email !== email); // ditch any older link
    resets.push({ token: token, email: email, expires: Date.now() + 60 * 60 * 1000 });
    save('password-resets', resets);
    const subject = 'Reset your ESA portal password';
    const actionUrl = 'reset-password.html?token=' + encodeURIComponent(token);
    const body = 'Hi ' + (user.fullName || user.firstName || 'there') + ',\n\n' +
      'Someone asked to reset the password on your ESA portal account.\n' +
      'Open the link below to pick a new one. It works for 1 hour:\n\n' +
      actionUrl + '\n\n' +
      'If it was not you, just ignore this email and nothing changes.\n\n- ESA Engineering';
    sendMail(email, subject, body);
    demoEmail = makeDemoEmailPreview(email, subject, body, actionUrl, user.role);
  }
  const response = { message: 'If that email is registered, reset instructions have been prepared.', success: true };
  if (demoEmail) response.demoEmailPreview = demoEmail;
  res.json(response);
});

// step 2: the reset page posts the token back with the new password
app.post('/api/auth/reset-password', (req, res) => {
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  const rec = resets.find(r => r.token === token);
  if (!rec) return res.status(400).json({ message: 'That reset link is not valid, please request a new one.' });
  if (Date.now() > rec.expires) {
    resets = resets.filter(r => r.token !== token);
    save('password-resets', resets);
    return res.status(400).json({ message: 'That reset link has expired, please request a new one.' });
  }
  if (password.length > 200 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return res.status(400).json({ message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number.' });
  const user = users.find(u => String(u.email).toLowerCase() === rec.email);
  if (!user) return res.status(400).json({ message: 'That account does not exist any more, please contact us.' });
  user.password = bcrypt.hashSync(password, 10);
  save('users', users);
  resets = resets.filter(r => r.token !== token);
  save('password-resets', resets);
  sendMail(user.email, 'Your ESA portal password was changed',
    'Hi ' + (user.fullName || user.firstName || 'there') + ',\n\nYour portal password was just changed.\nIf that was not you call us straight away on 0402 464 823.\n\n- ESA Engineering');
  res.json({ message: 'Password updated, you can sign in with it now.', success: true });
});

app.post('/api/auth/create/admin', requireAdmin, (req, res) => {
  const body = req.body || {};
  const fullName = String(body.fullName || '').trim();
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  const phone = String(body.phone || body.phoneNumber || '').trim();
  if (!fullName || !email || !password) return res.status(400).json({ message: 'Full name, email and password are required', success: false });
  const normEmail = email.toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) return res.status(400).json({ message: 'Enter a valid email address', success: false });
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return res.status(400).json({ message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number', success: false });
  if (users.some(u => u.email.toLowerCase() === normEmail)) return res.status(409).json({ message: 'That email already has an account', success: false });
  const id = users.length ? Math.max(...users.map(u=>u.id))+1 : 1;
  const hashed = bcrypt.hashSync(password, 10);
  const user = {
    id, fullName, name: fullName, firstName: fullName.split(' ')[0], lastName: fullName.split(' ').slice(1).join(' '),
    email: normEmail, password: hashed, phone: phone, phoneNumber: phone,
    company: 'ESA', companyName: 'ESA', role: 'ADMIN', active: true
  };
  users.push(user);
  save('users', users);
  logAudit(req, 'administrator created', fullName + ' (' + normEmail + ')');
  res.json({ message: 'Administrator account created', success: true });
});

// legacy /auth endpoints (old controller)
app.post('/auth/register', (req, res) => {
  req.url = '/api/auth/signup'; app.handle(req, res);
});
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email.toLowerCase() === (email||'').toLowerCase());
  if (!user) return res.send('Invalid Email or Password');
  if (user.active === false) return res.send('This account is inactive. Contact ESA for help.');
  const ok = bcrypt.compareSync(password || '', user.password);
  if (!ok) return res.send('Invalid Email or Password');
  return res.send(user.role === 'ADMIN' ? 'Admin Login Successful' : 'Customer Login Successful');
});

// ---- ADMIN DATA ----
function melbourneDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = {};
  parts.forEach(part => { values[part.type] = part.value; });
  return values.year + '-' + values.month + '-' + values.day;
}
function shiftDateKey(value, days) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function isOpenBooking(booking) {
  const status = String(booking.status || 'pending').toLowerCase();
  return status !== 'cancelled' && status !== 'completed';
}
function isUpcomingBooking(booking, nowMs) {
  if (!booking || !isOpenBooking(booking)) return false;
  const date = String(booking.bookingDate || '').slice(0, 10);
  const savedSlot = String(booking.preferredSlot || '');
  const time = allowedSlots.has(savedSlot) ? savedSlot : '17:00';
  const start = melbourneSlotTimestamp(date, time);
  return Number.isFinite(start) && start > (nowMs === undefined ? Date.now() : nowMs);
}
function isOpenEnquiry(contact) {
  const status = String(contact.status || 'new').toLowerCase();
  return status !== 'resolved' && status !== 'closed';
}
function adminStats() {
  const today = melbourneDateKey(new Date());
  const now = Date.now();
  const activeBookings = bookings.filter(b => isUpcomingBooking(b, now)).length;
  const allPayments = payments;
  const revenueCents = allPayments.reduce((sum, p) => {
    return String(p.status || '').toLowerCase() === 'completed' ? sum + Math.round((Number(p.amount) || 0) * 100) : sum;
  }, 0);
  const revenue = revenueCents / 100;
  const totalCustomers = users.filter(user => String(user.role || '').toUpperCase() === 'CUSTOMER').length;
  const openEnquiries = contacts.filter(isOpenEnquiry);
  const recentRequests = bookings.slice().sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5).map(b => ({
    id: b.id, customer: b.fullName, service: b.serviceName, date: b.bookingDate,
    time: b.preferredSlot || '', status: b.status || 'pending'
  }));
  const recentEnquiries = contacts.slice().sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5).map(c => ({
    id: c.id, name: c.fullName, preview: c.description || '', status: c.status || 'new'
  }));

  // The chart and trend count requests by the day they were made, not the
  // preferred appointment date selected by the customer.
  const start = shiftDateKey(today, -13);
  const countsByDay = {};
  bookings.forEach(b => {
    const created = melbourneDateKey(b.createdAt);
    if (created && created >= start && created <= today) countsByDay[created] = (countsByDay[created] || 0) + 1;
  });
  const bookingsByDay = [];
  for (let i = 13; i >= 0; i--) {
    const date = shiftDateKey(today, -i);
    bookingsByDay.push({ date, bookings: countsByDay[date] || 0 });
  }
  const thisWeekStart = shiftDateKey(today, -6);
  const lastWeekStart = shiftDateKey(today, -13);
  const requestsCreatedOn = date => {
    const created = melbourneDateKey(date.createdAt);
    return created;
  };
  const bookingsThisWeek = bookings.filter(b => {
    const created = requestsCreatedOn(b);
    return created && created >= thisWeekStart && created <= today;
  }).length;
  const bookingsLastWeek = bookings.filter(b => {
    const created = requestsCreatedOn(b);
    return created && created >= lastWeekStart && created < thisWeekStart;
  }).length;
  const nextWeek = shiftDateKey(today, 7);
  const alerts = {
    openEnquiries: openEnquiries.length,
    pendingPayments: allPayments.filter(p => String(p.status || '').toLowerCase() === 'pending').length,
    bookingsNext7Days: bookings.filter(b => {
      const date = melbourneDateKey(b.bookingDate);
      return date && date <= nextWeek && isUpcomingBooking(b, now);
    }).length
  };
  return {
    stats: { totalCustomers, upcomingBookings: activeBookings, openEnquiries: openEnquiries.length, paidRevenue: revenue },
    alerts,
    recentRequests,
    recentEnquiries,
    bookingsByDay,
    bookingsThisWeek,
    bookingsLastWeek
  };
}
app.get('/api/admin/stats', requireAdmin, (req, res) => res.json(adminStats()));
app.get('/admin/stats', requireAdmin, (req, res) => res.json(adminStats()));
app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  const rows = bookings.slice().sort((a, b) => Number(b.id) - Number(a.id)).map(b => ({
    bookingId: b.id,
    customer: b.fullName,
    service: b.serviceName,
    date: b.bookingDate,
    time: b.preferredSlot || '',
    email: b.email,
    phone: b.phone || '',
    abn: b.abnNumber || b.abn || '',
    notes: b.description || b.notes || '',
    status: b.status || 'pending',
    createdAt: b.createdAt || null
  }));
  res.json({ bookings: rows, total: rows.length });
});

app.get('/api/admin/customers', requireAdmin, (req, res) => {
  const rows = users.filter(u => String(u.role || '').toUpperCase() === 'CUSTOMER').map(u => ({
    id: u.id, name: u.fullName, email: u.email, phone: u.phone||u.phoneNumber||'', company: u.company||u.companyName||'', status: u.active ? 'active':'inactive', lastUpdated: null, role: (u.role||'customer').toLowerCase()
  }));
  res.json({ customers: rows, total: rows.length });
});
app.get('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const u = users.find(x=>String(x.id)===req.params.id && String(x.role || '').toUpperCase() === 'CUSTOMER');
  if (!u) return res.status(404).json({ message: 'Customer not found' });
  res.json({ customer: { id: u.id, name: u.fullName, email: u.email, phone: u.phone||u.phoneNumber, company: u.company||u.companyName, status: u.active?'active':'inactive', role: u.role.toLowerCase() } });
});
app.patch('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const u = users.find(x=>String(x.id)===req.params.id && String(x.role || '').toUpperCase() === 'CUSTOMER');
  if (!u) return res.status(404).json({ message: 'Customer not found' });
  const { firstName, lastName, phone, companyName, company, status } = req.body || {};
  if (firstName !== undefined || lastName !== undefined) {
    const fn = firstName == null ? '' : String(firstName).trim();
    const ln = lastName == null ? '' : String(lastName).trim();
    const fullName = (fn + ' ' + ln).trim();
    if (fullName) u.fullName = fullName;
    u.firstName = fn;
    u.lastName = ln;
    u.name = u.fullName;
  }
  if (phone !== undefined && phone !== null) { u.phone = String(phone); u.phoneNumber = String(phone); }
  if (companyName !== undefined && companyName !== null) { u.companyName = String(companyName); u.company = String(companyName); }
  if (company !== undefined && company !== null) { u.company = String(company); u.companyName = String(company); }
  if (status !== undefined && status !== null) u.active = String(status).toLowerCase() !== 'inactive';
  save('users', users);
  logAudit(req, 'customer updated', '#' + u.id + ' fields: ' + auditFields(req.body));
  res.json({ customer: {
    id: u.id, name: u.fullName, email: u.email,
    phone: u.phone || u.phoneNumber || '',
    company: u.company || u.companyName || '',
    status: u.active ? 'active' : 'inactive',
    role: String(u.role || 'customer').toLowerCase()
  }, message: 'Customer updated' });
});

app.get('/api/admin/enquiries', requireAdmin, (req, res) => {
  const rows = contacts.slice().sort((a, b) => Number(b.id) - Number(a.id)).map(c => ({
    id: c.id, name: c.fullName, email: c.email, subject: c.serviceName, message: c.description, status: c.status||'new', reply: c.reply||null, date: c.createdAt||null
  }));
  res.json({ enquiries: rows, total: rows.length });
});
app.get('/api/admin/enquiries/:id', requireAdmin, (req, res) => {
  const c = contacts.find(x=>String(x.id)===req.params.id);
  if (!c) return res.status(404).json({ message: 'Enquiry not found' });
  res.json({ enquiry: { id: c.id, name: c.fullName, email: c.email, subject: c.serviceName, message: c.description, status: c.status, reply: c.reply, date: c.createdAt } });
});
app.patch('/api/admin/enquiries/:id', requireAdmin, (req, res) => {
  const c = contacts.find(x=>String(x.id)===req.params.id);
  if (!c) return res.status(404).json({ message: 'Enquiry not found' });
  if (req.body.status) c.status = req.body.status;
  if (req.body.reply !== undefined) c.reply = req.body.reply;
  save('contacts', contacts);
  logAudit(req, 'enquiry updated', '#' + c.id + ' fields: ' + auditFields(req.body));
  res.json({ enquiry: c, message: 'Enquiry updated' });
});

app.get('/api/admin/payments', requireAdmin, (req, res) => {
  const rows = [...payments].reverse().map(p => ({
    id: p.id, invoiceId: p.transactionId, customerName: p.customerName||null, amount: p.amount, status: p.status||'completed', paidAt: p.paymentDate||null, method: p.method || (p.transferReference ? 'transfer' : null), cardLast4: p.cardLast4||null, transferReference: p.transferReference||null, paidDate: p.paidDate||null
  }));
  res.json({ payments: rows, total: rows.length });
});
app.get('/api/admin/payments/:id', requireAdmin, (req, res) => {
  const p = payments.find(x=>String(x.id)===req.params.id);
  if (!p) return res.status(404).json({ message: 'Payment not found' });
  res.json({ payment: { id: p.id, invoiceId: p.transactionId, customerName: p.customerName, amount: p.amount, status: p.status, paidAt: p.paymentDate, method: p.method || (p.transferReference ? 'transfer' : null), cardLast4: p.cardLast4||null, transferReference: p.transferReference||null, paidDate: p.paidDate||null } });
});
app.patch('/api/admin/payments/:id', requireAdmin, (req, res) => {
  const p = payments.find(x=>String(x.id)===req.params.id);
  if (!p) return res.status(404).json({ message: 'Payment not found' });
  if (req.body.status) p.status = req.body.status;
  if (req.body.amount !== undefined) p.amount = Number(req.body.amount);
  save('payments', payments);
  // if the office marks the fee paid the booking is confirmed too
  if (p.status === 'completed' && p.bookingId) {
    const b = bookings.find(x=>x.id===p.bookingId);
    if (b) { b.status = 'confirmed'; save('bookings', bookings); }
  }
  logAudit(req, 'payment updated', '#' + p.id + ' fields: ' + auditFields(req.body));
  res.json({ payment: p, message: 'Payment updated' });
});

// ---- CASE STUDIES (projects the office adds from the admin page) ----
// the projects page keeps its built-in cards and these get added on top,
// so the site still has content before anyone touches the admin
let caseStudies = load('case-studies', []);

function studyFields(body, old) {
  return {
    title: body.title !== undefined ? String(body.title) : (old ? old.title : ''),
    category: body.category !== undefined ? String(body.category) : (old ? old.category : 'infra'),
    location: body.location !== undefined ? String(body.location) : (old ? old.location : ''),
    valueLabel: body.valueLabel !== undefined ? String(body.valueLabel) : (old ? old.valueLabel : ''),
    summary: body.summary !== undefined ? String(body.summary) : (old ? old.summary : ''),
    image: body.image !== undefined ? String(body.image) : (old ? old.image : 'images/project-remote-site.jpg'),
    status: body.status !== undefined ? String(body.status) : (old ? old.status : 'draft')
  };
}

app.get('/api/projects', (req, res) => {
  res.json({ projects: caseStudies.filter(p => p.status === 'published') });
});
// admin list, drafts included (the public one only shows published)
app.get('/api/admin/projects', requireAdmin, (req, res) => {
  res.json({ projects: caseStudies });
});
app.post('/api/admin/projects', requireAdmin, (req, res) => {
  if (!req.body.title) return res.status(400).json({ message: 'Title is required', success: false });
  const id = caseStudies.length ? Math.max(...caseStudies.map(p => p.id)) + 1 : 1;
  const study = Object.assign({ id: id, createdAt: new Date().toISOString() }, studyFields(req.body, null));
  caseStudies.push(study);
  save('case-studies', caseStudies);
  logAudit(req, 'case study created', study.title + ' (' + study.status + ')');
  res.json({ project: study, message: 'Case study saved', success: true });
});
app.patch('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const p = caseStudies.find(x => String(x.id) === req.params.id);
  if (!p) return res.status(404).json({ message: 'Case study not found', success: false });
  Object.assign(p, studyFields(req.body, p));
  save('case-studies', caseStudies);
  logAudit(req, 'case study updated', p.title + ' fields: ' + auditFields(req.body));
  res.json({ project: p, message: 'Case study updated', success: true });
});
app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const gone = caseStudies.find(x => String(x.id) === req.params.id);
  if (!gone) return res.status(404).json({ message: 'Case study not found', success: false });
  caseStudies = caseStudies.filter(x => String(x.id) !== req.params.id);
  save('case-studies', caseStudies);
  logAudit(req, 'case study deleted', gone.title);
  res.json({ message: 'Case study deleted', success: true });
});

// ---- AUDIT LOG (who did what in the admin) ----
// successful admin changes are saved beside the rest of the json data, capped at 500
let auditLog = load('audit-log', []);

function logAudit(req, action, detail) {
  const entry = {
    id: auditLog.length ? Math.max(...auditLog.map(a => Number(a.id) || 0)) + 1 : 1,
    at: new Date().toISOString(),
    who: (req.userPayload && req.userPayload.email) || 'unknown',
    action: action,
    detail: String(detail || '').slice(0, 500)
  };
  auditLog.push(entry);
  if (auditLog.length > 500) auditLog = auditLog.slice(-500);
  save('audit-log', auditLog);
}

app.get('/api/admin/audit', requireAdmin, (req, res) => {
  // newest first
  res.json({ entries: auditLog.slice().reverse() });
});

// ---- PAGES CMS ----
function isSafePageSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(slug);
}
function discoverBlocksFromFile(slug) {
  if (!isSafePageSlug(slug)) return {};
  const filePath = path.join(STATIC_DIR, slug);
  if (!fs.existsSync(filePath)) return {};
  const html = fs.readFileSync(filePath, 'utf8');
  const regex = /data-cms\s*=\s*"([^"]+)"[^>]*>(.*?)<\//gs;
  const out = {};
  let m;
  while ((m = regex.exec(html)) !== null) {
    const key = m[1].trim();
    const inner = m[2].trim().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!out[key]) out[key] = inner;
  }
  const regex2 = /data-cms\s*=\s*'([^']+)'[^>]*>(.*?)<\//gs;
  while ((m = regex2.exec(html)) !== null) {
    const key = m[1].trim();
    const inner = m[2].trim().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!out[key]) out[key] = inner;
  }
  return out;
}
function isHtmlBlock(slug, key) {
  if (!isSafePageSlug(slug)) return false;
  const filePath = path.join(STATIC_DIR, slug);
  if (!fs.existsSync(filePath)) return false;
  const html = fs.readFileSync(filePath, 'utf8');
  const pattern = new RegExp(`<[^>]*data-cms\\s*=\\s*["']${key}["'][^>]*>`, 'i');
  const match = html.match(pattern);
  if (!match) return false;
  return match[0].toLowerCase().includes('data-cms-html');
}

app.get('/api/admin/pages', requireAdmin, (req, res) => {
  res.json({ pages: pages.map(p=>({
    id: p.id, title: p.title, slug: p.slug, status: p.status, updatedAt: p.updatedAt,
    hasStaticFile: isSafePageSlug(p.slug) && fs.existsSync(path.join(STATIC_DIR, p.slug))
  })), total: pages.length });
});
app.post('/api/admin/pages', requireAdmin, (req, res) => {
  const { title, slug } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ message: 'Title is required' });
  if (title.trim().length > 100) return res.status(400).json({ message: 'Title must be 100 characters or fewer' });
  let finalSlug = slug && String(slug).trim() ? String(slug).trim().toLowerCase() : title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '.html';
  if (!finalSlug.endsWith('.html')) finalSlug += '.html';
  if (!isSafePageSlug(finalSlug)) return res.status(400).json({ message: 'Use a simple page name such as case-studies.html' });
  if (pages.some(p=>p.slug===finalSlug)) return res.status(409).json({ message: 'A page with that slug already exists' });
  const id = pages.length ? Math.max(...pages.map(p=>p.id))+1 : 1;
  const page = {
    id, title: title.trim(), slug: finalSlug, status: 'draft', updatedAt: new Date().toISOString(),
    hasStaticFile: fs.existsSync(path.join(STATIC_DIR, finalSlug))
  };
  pages.push(page);
  save('pages', pages);
  logAudit(req, 'page created', page.title || page.slug || String(page.id));
  res.json({ page, message: 'Page record created as a draft' });
});
app.get('/api/admin/pages/:id', requireAdmin, (req, res) => {
  const page = pages.find(p=>String(p.id)===req.params.id);
  if (!page) return res.status(404).json({ message: 'Page not found' });
  const defaults = discoverBlocksFromFile(page.slug);
  const persisted = blocks.filter(b=>String(b.pageId)===String(page.id));
  const persistedMap = {}; persisted.forEach(b=>persistedMap[b.key]=b);
  const resultBlocks = [];
  for (const [key, defVal] of Object.entries(defaults)) {
    const over = persistedMap[key];
    resultBlocks.push({
      key, label: key.replace(/[-_]/g,' ').replace(/^\w/, c=>c.toUpperCase()),
      value: over ? over.value : defVal,
      defaultValue: defVal,
      html: isHtmlBlock(page.slug, key),
      overridden: !!over
    });
  }
  // orphaned
  for (const b of persisted) {
    if (!defaults[b.key]) {
      resultBlocks.push({ key: b.key, label: b.label||b.key, value: b.value, defaultValue: b.defaultValue||'', html: !!b.html, overridden: true });
    }
  }
  res.json({ page: {
    id: page.id, title: page.title, slug: page.slug, status: page.status, updatedAt: page.updatedAt,
    hasStaticFile: isSafePageSlug(page.slug) && fs.existsSync(path.join(STATIC_DIR, page.slug))
  }, blocks: resultBlocks });
});
app.patch('/api/admin/pages/:id', requireAdmin, (req, res) => {
  const page = pages.find(p=>String(p.id)===req.params.id);
  if (!page) return res.status(404).json({ message: 'Page not found' });
  if (req.body.status) {
    const s = req.body.status.toLowerCase();
    if (!['published','draft'].includes(s)) return res.status(400).json({ message: 'Status must be published or draft' });
    if (s === 'published' && (!isSafePageSlug(page.slug) || !fs.existsSync(path.join(STATIC_DIR, page.slug)))) {
      return res.status(400).json({ message: 'Add a matching page file in the static folder before publishing this page record.' });
    }
    page.status = s;
    page.updatedAt = new Date().toISOString();
    save('pages', pages);
  }
  logAudit(req, 'page updated', (page.title || page.slug || String(page.id)) + ' fields: ' + auditFields(req.body));
  res.json({ page, message: 'Page updated' });
});
app.put('/api/admin/pages/:id/blocks', requireAdmin, (req, res) => {
  const page = pages.find(p=>String(p.id)===req.params.id);
  if (!page) return res.status(404).json({ message: 'Page not found' });
  const incoming = req.body.blocks;
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ message: 'blocks must be an object' });
  const defaults = discoverBlocksFromFile(page.slug);
  for (const [k, v] of Object.entries(incoming)) {
    let existing = blocks.find(b=>String(b.pageId)===String(page.id) && b.key===k);
    if (existing) {
      existing.value = String(v);
    } else {
      blocks.push({
        pageId: page.id, key: k, value: String(v), defaultValue: defaults[k]||'', label: k.replace(/[-_]/g,' ').replace(/^\w/, c=>c.toUpperCase()), html: isHtmlBlock(page.slug, k)
      });
    }
  }
  page.updatedAt = new Date().toISOString();
  save('blocks', blocks);
  save('pages', pages);
  logAudit(req, 'page content updated', page.title + ' blocks: ' + Object.keys(incoming).join(', '));
  res.json({ message: 'Content saved', success: true });
});
app.delete('/api/admin/pages/:id/blocks/:key', requireAdmin, (req, res) => {
  const page = pages.find(p => String(p.id) === req.params.id);
  if (!page) return res.status(404).json({ message: 'Page not found' });
  blocks = blocks.filter(b=> !(String(b.pageId)===req.params.id && b.key===req.params.key));
  page.updatedAt = new Date().toISOString();
  save('blocks', blocks);
  save('pages', pages);
  logAudit(req, 'page content reset', page.title + ' block: ' + req.params.key);
  res.json({ message: 'Block reset to default', success: true });
});

// ---- PUBLIC CONTENT ----
app.get('/api/content', (req, res) => {
  const slug = req.query.slug || 'index.html';
  if (!isSafePageSlug(String(slug))) return res.status(400).json({ message: 'Page name is not valid' });
  const page = pages.find(p=>p.slug===slug);
  const defaults = discoverBlocksFromFile(slug);
  const persisted = page && page.status === 'published' ? blocks.filter(b=>String(b.pageId)===String(page.id)) : [];
  const map = {};
  for (const [k, v] of Object.entries(defaults)) map[k]=v;
  for (const b of persisted) map[b.key]=b.value;
  res.json({ slug, blocks: map, page: page ? { title: page.title, slug: page.slug, status: page.status } : null });
});

// ---- CUSTOMER PORTAL (/api/portal) ----
// Every lookup is scoped to the email inside the verified token. Nothing here
// accepts a customer identity from the request body or the query string, so a
// signed-in customer can only reach their own rows. A row belonging to someone
// else answers 404, not 403, so guessing ids reveals nothing.
const ownBookings = (email) => bookings.filter(b => String(b.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());
const ownEnquiries = (email) => contacts.filter(c => String(c.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());
const ownPayments = (email) => {
  const ids = new Set(ownBookings(email).map(b => String(b.id)));
  return payments.filter(p => ids.has(String(p.bookingId)));
};
function paymentBooking(p) {
  return p ? bookings.find(b => String(b.id) === String(p.bookingId)) || null : null;
}
function paymentBelongsTo(email, p) {
  const b = paymentBooking(p);
  return !!b && String(b.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase();
}
function isDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const d = new Date(String(value) + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
const BUSINESS_TIME_ZONE = 'Australia/Melbourne';
const RESCHEDULE_CUTOFF_MINUTES = 90;
const allowedSlots = new Set(Array.from({ length: 16 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}));
function melbourneSlotTimestamp(dateValue, timeValue) {
  const date = String(dateValue || '').slice(0, 10);
  const time = String(timeValue || '');
  if (!isDateOnly(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const dateParts = date.split('-').map(Number);
  const timeParts = time.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);
  const localParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(wallClockAsUtc));
  const values = {};
  localParts.forEach(part => { values[part.type] = Number(part.value); });
  const localAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  const offset = localAsUtc - wallClockAsUtc;
  return wallClockAsUtc - offset;
}
function rescheduleCutoffTimestamp(booking) {
  if (!booking || !isDateOnly(String(booking.bookingDate || '').slice(0, 10))) return NaN;
  // Older bookings without a selected time use the 5pm close as their reference.
  const time = allowedSlots.has(String(booking.preferredSlot || '')) ? String(booking.preferredSlot) : '17:00';
  return melbourneSlotTimestamp(booking.bookingDate, time) - RESCHEDULE_CUTOFF_MINUTES * 60 * 1000;
}
function isRescheduleCutoffReached(booking, nowMs) {
  const cutoff = rescheduleCutoffTimestamp(booking);
  return !Number.isFinite(cutoff) || (nowMs === undefined ? Date.now() : nowMs) >= cutoff;
}
function canRescheduleBooking(booking) {
  const status = String((booking && booking.status) || 'pending').toLowerCase();
  return (status === 'pending' || status === 'confirmed') && !isRescheduleCutoffReached(booking);
}
const bookingSummary = (b) => {
  const p = payments.find(x => String(x.bookingId) === String(b.id)) || null;
  const payStatus = !p ? 'unpaid' : (p.status || 'incomplete');
  return {
    bookingId: b.id, name: b.fullName, service: b.serviceName, status: b.status,
    bookingDate: b.bookingDate, createdAt: b.createdAt, fee: p ? p.amount : CONSULTATION_FEE,
    preferredSlot: b.preferredSlot || null,
    paymentStatus: payStatus, paid: payStatus === 'completed',
    paymentReference: p ? p.transactionId : null,
    // once a transfer is logged, customers must contact the office before changing the payment
    canCancel: (b.status === 'pending' || b.status === 'confirmed') && payStatus !== 'completed' && payStatus !== 'pending',
    canPay: (b.status === 'pending' || b.status === 'confirmed') && payStatus !== 'completed' && payStatus !== 'cancelled' && payStatus !== 'pending',
    canReschedule: canRescheduleBooking(b),
    rescheduleCutoff: Number.isFinite(rescheduleCutoffTimestamp(b))
      ? new Date(rescheduleCutoffTimestamp(b)).toISOString()
      : null
  };
};
const paymentSummary = (p) => ({
  id: p.id, reference: p.transactionId, amount: p.amount, status: p.status || 'incomplete',
  paid: (p.status || '') === 'completed', bookingId: p.bookingId, customerName: p.customerName, paymentDate: p.paymentDate,
  paidDate: p.paidDate || null, method: p.method || (p.transferReference ? 'transfer' : null), cardLast4: p.cardLast4 || null
});

app.get('/api/portal/me', requireCustomer, (req, res) => {
  const u = users.find(x => x.email === req.customerEmail);
  if (!u) return res.status(401).json({ message: 'Your session has expired - please sign in again', success: false });
  res.json({ success: true, profile: { fullName: u.fullName, email: u.email, role: u.role, phoneNumber: u.phoneNumber || u.phone || '', companyName: u.companyName || u.company || '' } });
});
app.put('/api/portal/profile', requireCustomer, (req, res) => {
  const u = users.find(x => x.email === req.customerEmail);
  if (!u) return res.status(401).json({ message: 'Your session has expired - please sign in again', success: false });
  // Email and role are not editable: the whole portal is scoped by the email.
  const body = req.body || {};
  if (body.fullName && String(body.fullName).trim()) {
    u.fullName = String(body.fullName).trim();
    u.name = u.fullName;
    const nameParts = u.fullName.split(/\s+/);
    u.firstName = nameParts[0] || '';
    u.lastName = nameParts.slice(1).join(' ');
  }
  u.phoneNumber = body.phoneNumber ? String(body.phoneNumber).trim() : '';
  u.phone = u.phoneNumber;
  u.companyName = body.companyName ? String(body.companyName).trim() : '';
  u.company = u.companyName;
  save('users', users);
  res.json({ success: true, profile: { fullName: u.fullName, email: u.email, role: u.role, phoneNumber: u.phoneNumber, companyName: u.companyName } });
});
app.post('/api/portal/password', requireCustomer, (req, res) => {
  const u = users.find(x => x.email === req.customerEmail);
  if (!u) return res.status(401).json({ message: 'Your session has expired - please sign in again', success: false });
  const { currentPassword, newPassword } = req.body || {};
  // bcrypt first, then the legacy plain-text fallback that /signin still honours,
  // so an old account can still be migrated rather than locked out.
  if (!currentPassword || !(bcrypt.compareSync(String(currentPassword), u.password) || u.password === String(currentPassword))) {
    return res.status(400).json({ message: 'Your current password is incorrect', success: false });
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(newPassword || ''))) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number.', success: false });
  }
  u.password = bcrypt.hashSync(String(newPassword), 10);
  save('users', users);
  res.json({ success: true, message: 'Your password has been changed' });
});
app.get('/api/portal/bookings', requireCustomer, (req, res) => {
  res.json({ success: true, bookings: ownBookings(req.customerEmail).map(bookingSummary) });
});
app.get('/api/portal/bookings/:id', requireCustomer, (req, res) => {
  const b = ownBookings(req.customerEmail).find(x => String(x.id) === req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found', success: false });
  const p = payments.find(x => x.bookingId === b.id) || null;
  const out = Object.assign(bookingSummary(b), { email: b.email, phone: b.phone, notes: b.description, payment: p ? paymentSummary(p) : null });
  res.json({ success: true, booking: out });
});
// customer moves their own booking to a new date/slot while its still open
app.post('/api/portal/bookings/:id/reschedule', requireCustomer, (req, res) => {
  const b = ownBookings(req.customerEmail).find(x => String(x.id) === req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found', success: false });
  const status = String(b.status || 'pending').toLowerCase();
  if (status === 'completed' || status === 'cancelled') {
    return res.status(400).json({ message: 'This booking is ' + status + ' and cannot be moved.', success: false });
  }
  if (isRescheduleCutoffReached(b)) {
    return res.status(400).json({ message: 'This booking is within 90 minutes of its requested time and can no longer be rescheduled. Please call ESA for help.', success: false });
  }
  const date = String((req.body || {}).preferredDate || '').slice(0, 10);
  const slot = String((req.body || {}).preferredSlot || '');
  const today = melbourneDateKey(new Date());
  if (!date || !isDateOnly(date) || date < today) {
    return res.status(400).json({ message: 'Please choose today or a future date.' });
  }
  if (!allowedSlots.has(slot)) return res.status(400).json({ message: 'Choose a time between 9:00 am and 4:30 pm.' });
  if (melbourneSlotTimestamp(date, slot) <= Date.now() + RESCHEDULE_CUTOFF_MINUTES * 60 * 1000) {
    return res.status(400).json({ message: 'Choose a new time more than 90 minutes from now.' });
  }
  b.bookingDate = date;
  b.preferredSlot = slot;
  save('bookings', bookings);
  sendMail(req.customerEmail, 'Your booking #' + b.id + ' was moved',
    'Hi ' + b.fullName + ',\n\nYour ' + b.serviceName + ' booking is now set for ' + b.bookingDate +
    (b.preferredSlot ? ' at ' + b.preferredSlot : '') + '.\nNeed to move it again? It is in your portal.\n\n- ESA Engineering');
  res.json({ success: true, message: 'Booking moved, we will see you then.', booking: bookingSummary(b) });
});

app.post('/api/portal/bookings/:id/cancel', requireCustomer, (req, res) => {
  const b = ownBookings(req.customerEmail).find(x => String(x.id) === req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found', success: false });
  const status = b.status || 'pending';
  if (status === 'cancelled') return res.status(400).json({ message: 'This booking is already cancelled', success: false });
  if (status === 'completed') return res.status(400).json({ message: 'This booking is already completed and can no longer be cancelled', success: false });
  const p = payments.find(x => x.bookingId === b.id) || null;
  if (p && p.status === 'completed') return res.status(400).json({ message: 'This booking is already paid - contact us on 0402 464 823 to arrange a refund', success: false });
  if (p && p.status === 'pending') return res.status(400).json({ message: 'A transfer has already been logged. Please contact us on 0402 464 823 before cancelling.', success: false });
  b.status = 'cancelled';
  if (p) { p.status = 'cancelled'; }
  save('bookings', bookings); save('payments', payments);
  res.json({ success: true, message: 'Booking cancelled', booking: bookingSummary(b) });
});
app.get('/api/portal/enquiries', requireCustomer, (req, res) => {
  res.json({ success: true, enquiries: ownEnquiries(req.customerEmail).map(c => ({ id: c.id, name: c.fullName, service: c.serviceName, message: c.description, status: c.status, createdAt: c.createdAt, reply: c.reply })) });
});
app.post('/api/portal/enquiries/:id/reopen', requireCustomer, (req, res) => {
  const c = ownEnquiries(req.customerEmail).find(x => String(x.id) === req.params.id);
  if (!c) return res.status(404).json({ message: 'Enquiry not found', success: false });
  if (c.status !== 'resolved') return res.status(400).json({ message: 'Only a resolved enquiry can be reopened', success: false });
  c.status = 'in-progress';
  save('contacts', contacts);
  res.json({ success: true, message: 'Enquiry reopened - our team will follow up', enquiry: { id: c.id, name: c.fullName, service: c.serviceName, message: c.description, status: c.status, createdAt: c.createdAt, reply: c.reply } });
});
app.get('/api/portal/payments', requireCustomer, (req, res) => {
  res.json({ success: true, payments: ownPayments(req.customerEmail).map(paymentSummary) });
});
app.get('/api/portal/summary', requireCustomer, (req, res) => {
  const u = users.find(x => x.email === req.customerEmail);
  if (!u) return res.status(401).json({ message: 'Your session has expired - please sign in again', success: false });
  res.json({
    success: true,
    bookings: ownBookings(req.customerEmail).map(bookingSummary),
    enquiries: ownEnquiries(req.customerEmail).map(c => ({ id: c.id, name: c.fullName, service: c.serviceName, message: c.description, status: c.status, createdAt: c.createdAt, reply: c.reply })),
    payments: ownPayments(req.customerEmail).map(paymentSummary),
    profile: { fullName: u.fullName, email: u.email, role: u.role, phoneNumber: u.phoneNumber || u.phone || '', companyName: u.companyName || u.company || '' }
  });
});
app.get('/api/portal/ping', (req, res) => res.json({ success: true, message: 'ok' }));

// ---- SETTINGS ----
app.get('/api/admin/settings', requireAdmin, (req, res) => res.json({ settings }));
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  for (const [k,v] of Object.entries(req.body)) {
    if (v!=null) settings[k]=String(v);
  }
  save('settings', settings);
  logAudit(req, 'site settings updated', 'fields: ' + auditFields(req.body));
  res.json({ settings });
});

// ---- BOOKINGS & ENQUIRIES ----
app.post('/api/bookings', limitBookings, requireCustomer, (req, res) => {
  const { name, fullName, phone, service, serviceName, notes, description, message } = req.body || {};
  const finalName = String(name || fullName || '').trim();
  const finalPhone = String(phone || '').trim();
  const finalService = String(service || serviceName || 'General Inquiry').trim();
  const finalNotes = String(notes || description || message || '').trim();
  const finalEmail = req.customerEmail;
  if (!finalName) return res.status(400).json({ message: 'Name is required', success: false });
  if (finalName.length > 100) return res.status(400).json({ message: 'Name must be 100 characters or fewer', success: false });
  if (finalPhone.length > 40) return res.status(400).json({ message: 'Phone must be 40 characters or fewer', success: false });
  if (finalService.length > 100) return res.status(400).json({ message: 'Service must be 100 characters or fewer', success: false });
  if (finalNotes.length > 1000) return res.status(400).json({ message: 'Please keep your notes to 1,000 characters or fewer', success: false });
  const preferredDate = String(req.body.preferredDate || '').slice(0, 10);
  const today = melbourneDateKey(new Date());
  if (!preferredDate || !isDateOnly(preferredDate) || preferredDate < today) {
    return res.status(400).json({ message: 'Please choose today or a future booking date.' });
  }
  const preferredSlot = String(req.body.preferredSlot || '');
  if (!allowedSlots.has(preferredSlot)) return res.status(400).json({ message: 'Choose a time between 9:00 am and 4:30 pm.' });
  if (melbourneSlotTimestamp(preferredDate, preferredSlot) <= Date.now()) {
    return res.status(400).json({ message: 'Choose a time that has not passed.' });
  }
  const id = bookings.length ? Math.max(...bookings.map(b=>b.id))+1 : 1;
  const booking = {
    id, fullName: finalName, name: finalName, email: finalEmail, phone: finalPhone, service: finalService, serviceName: finalService,
    notes: finalNotes, description: finalNotes,
    // if they picked a preferred date on the form use that, otherwise today
    preferredSlot: preferredSlot,
    bookingDate: preferredDate || today,
    status: 'pending', createdAt: new Date().toISOString(), fee: CONSULTATION_FEE
  };
  bookings.push(booking);
  save('bookings', bookings);
  if (booking.preferredSlot) {
    sendMail(settings.adminEmail, 'slot picked on booking #' + id, finalName + ' asked for ' + booking.bookingDate + ' at ' + booking.preferredSlot);
  }
  const bookingEmailSubject = 'We got your booking - ' + booking.serviceName;
  const bookingEmailBody = 'Hi ' + finalName + ',\n\nThanks for booking ' + booking.serviceName + ' with ESA Engineering.\n' +
    'Your booking reference is #' + id + ' and the consultation fee is $' + booking.fee + '.\n' +
    'The next step is the payment page (payment.html?booking=' + id + ') where you can pay by card or log a bank transfer.\n\n- ESA Engineering';
  sendMail(finalEmail, bookingEmailSubject, bookingEmailBody);
  sendMail(settings.adminEmail, 'New booking #' + id + ' - ' + booking.serviceName,
    finalName + ' (' + finalEmail + ', ' + (finalPhone || 'no phone') + ') booked ' + booking.serviceName + '.\nNotes: ' + (finalNotes || '-'));
  const payId = payments.length ? Math.max(...payments.map(p=>p.id))+1 : 1;
  const payment = { id: payId, transactionId: `ESA-${id}-${Math.random().toString(36).substring(2,8).toUpperCase()}`, customerName: finalName, amount: CONSULTATION_FEE, status: 'incomplete', paymentDate: null, bookingId: id };
  payments.push(payment);
  save('payments', payments);
  const response = {
    message: "Thanks - we've received your request and will be in touch shortly.",
    success: true,
    booking: { id: booking.id, name: booking.fullName, service: booking.serviceName, status: booking.status, fee: booking.fee },
    payment: { id: payment.id, reference: payment.transactionId, status: payment.status }
  };
  const demoEmail = makeDemoEmailPreview(finalEmail, bookingEmailSubject, bookingEmailBody, null, req.customerRole);
  if (demoEmail) {
    demoEmail.bookingId = booking.id;
    response.demoEmailPreview = demoEmail;
  }
  res.json(response);
});
app.get('/api/bookings/:id', requireCustomer, (req, res) => {
  const b = ownBookings(req.customerEmail).find(x => String(x.id) === req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found', success: false });
  const p = payments.find(x => String(x.bookingId) === String(b.id));
  res.json({ booking: { id: b.id, name: b.fullName, email: b.email, phone: b.phone, service: b.serviceName, notes: b.description, status: b.status, fee: b.fee || CONSULTATION_FEE, createdAt: b.createdAt, bookingDate: b.bookingDate }, payment: p ? paymentSummary(p) : null });
});
app.get('/api/bookings', requireAdmin, (req, res) => res.json({ bookings }));

app.get('/api/enquiries/:id', requireCustomer, (req, res) => {
  const c = ownEnquiries(req.customerEmail).find(x => String(x.id) === req.params.id);
  if (!c) return res.status(404).json({ message: 'Enquiry not found', success: false });
  res.json({ enquiry: { id: c.id, name: c.fullName, email: c.email, service: c.serviceName, message: c.description, status: c.status, createdAt: c.createdAt, reply: c.reply } });
});

app.post('/api/enquiries', limitEnquiries, async (req, res) => {
  const body = req.body || {};
  const finalName = String(body.name || body.fullName || '').trim();
  const finalEmail = String(body.email || '').trim().toLowerCase();
  const service = String(body.type || body.serviceName || body.subject || 'General Inquiry').trim();
  const message = String(body.message || body.description || '').trim();
  if (!finalName || !finalEmail) return res.status(400).json({ message: 'Name and email are required', success: false });
  if (!message) return res.status(400).json({ message: 'Please add a short message so we know how to help.', success: false });
  if (finalName.length > 100) return res.status(400).json({ message: 'Name must be 100 characters or fewer', success: false });
  if (finalEmail.length > 100 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(finalEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address', success: false });
  }
  if (service.length > 100) return res.status(400).json({ message: 'Inquiry type must be 100 characters or fewer', success: false });
  if (message.length > 2000) return res.status(400).json({ message: 'Please keep your message to 2,000 characters or fewer', success: false });

  const hasAttachmentName = Boolean(body.attachmentName);
  const hasAttachmentData = Boolean(body.attachmentData);
  let attachNote = '';
  let attachment = null;
  if (hasAttachmentName !== hasAttachmentData) {
    return res.status(400).json({ message: 'Please choose the attachment again and try once more.', success: false });
  }
  if (hasAttachmentName) {
    const type = String(body.attachmentType || '').toLowerCase();
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const data = String(body.attachmentData || '');
    const name = String(body.attachmentName || 'attachment');
    if (name.length > 120 || allowedTypes.indexOf(type) === -1) {
      return res.status(400).json({ message: 'Attachments must be a PDF, JPG or PNG file under 3MB.', success: false });
    }
    if (data.length > 4 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
      return res.status(400).json({ message: 'That attachment could not be read. Please choose it again.', success: false });
    }
    const bytes = Buffer.from(data, 'base64');
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) {
      return res.status(400).json({ message: 'Attachments must be under 3MB.', success: false });
    }
    const looksLikeFile = type === 'application/pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : type === 'image/jpeg'
        ? bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!looksLikeFile) return res.status(400).json({ message: 'The attachment does not match its file type.', success: false });

    const safeName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'attachment';
    attachNote = '\n[attachment saved as ' + safeName + ']';
    if (message.length + attachNote.length > 2000) {
      return res.status(400).json({ message: 'Please shorten the message a little to include the attachment name.', success: false });
    }
    attachment = { bytes, safeName };
  }

  if (attachment) {
    try {
      const upDir = path.join(DATA_DIR, 'uploads');
      if (!fs.existsSync(upDir)) fs.mkdirSync(upDir, { recursive: true, mode: 0o700 });
      const fileName = Date.now() + '-' + crypto.randomUUID() + '-' + attachment.safeName;
      fs.writeFileSync(path.join(upDir, fileName), attachment.bytes, { mode: 0o600, flag: 'wx' });
    } catch (e) {
      console.log('[upload] could not save attachment: ' + e.message);
      return res.status(500).json({ message: 'We could not save that attachment. Please try again or send it by email.', success: false });
    }
  }

  const id = contacts.length ? Math.max(...contacts.map(c => Number(c.id) || 0)) + 1 : 1;
  const contact = {
    id,
    fullName: finalName,
    name: finalName,
    email: finalEmail,
    serviceName: service || 'General Inquiry',
    description: message + attachNote,
    status: 'new',
    reply: null,
    createdAt: new Date().toISOString()
  };
  contacts.push(contact);
  save('contacts', contacts);
  const emailDelivery = await sendEnquiryNotifications(contact);
  res.json({
    message: emailDelivery.message,
    success: true,
    enquiry: { id },
    emailDelivery
  });
});

// ---- BANK TRANSFER PAYMENTS ----
// This records a transfer for the office to verify; it does not mark the fee paid.
app.post('/api/payments/:id/confirm', requireCustomer, (req, res) => {
  const p = payments.find(x => String(x.id) === req.params.id);
  if (!p || !paymentBelongsTo(req.customerEmail, p)) return res.status(404).json({ message: 'Payment not found', success: false });
  const booking = paymentBooking(p);
  if (booking.status === 'cancelled' || p.status === 'cancelled') return res.status(400).json({ message: 'This booking was cancelled and can no longer be paid.' });
  if (p.status === 'completed') return res.json({ message: 'This fee is already paid, thanks!', reference: p.transactionId, status: 'completed', success: true });
  if (p.status === 'pending') return res.json({ message: 'This transfer is already logged and is waiting to clear.', reference: p.transactionId, status: 'pending', success: true });
  const ref = String((req.body || {}).transferReference || '').trim();
  if (!ref || ref.length > 120) return res.status(400).json({ message: 'Please put in a valid transfer reference from your bank receipt.' });
  const paidDate = String((req.body || {}).paidDate || '').slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (!isDateOnly(paidDate) || paidDate > today) return res.status(400).json({ message: 'Please choose a valid date on or before today.' });
  p.status = 'pending'; // waiting on the office to see it in the bank feed
  p.method = 'transfer';
  p.transferReference = ref;
  p.paidDate = paidDate;
  p.paymentDate = new Date().toISOString();
  save('payments', payments);
  sendMail(settings.adminEmail, 'Bank transfer logged: ' + p.transactionId,
    (p.customerName || 'A customer') + ' logged a transfer of $' + p.amount + ' with reference "' + ref + '" on ' + p.paidDate + '.\nPlease check the bank feed and mark it paid in the admin payments page.');
  res.json({ message: 'Thanks! We logged your transfer and will confirm once it clears, usually within 1 business day.', reference: p.transactionId, status: 'pending', success: true });
});

// ---- CARD PAYMENTS ----
// demo/sandbox card flow for the project: we validate the number properly
// (luhn check, expiry in the future, cvv shape) and then approve it ourselves.
// there is no real gateway behind this, so NO real money moves and we only
// ever keep the last 4 digits - the full number is never saved anywhere.
// TODO: swap the approve step for stripe/adyen when this goes live for real.
function luhnOk(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

app.post('/api/payments/:id/card', requireCustomer, (req, res) => {
  if (!DEMO_CARD_PAYMENTS_ENABLED) {
    return res.status(503).json({ message: 'Demo card payments are turned off. Please use the bank transfer option or contact ESA.', success: false });
  }
  const p = payments.find(x => String(x.id) === req.params.id);
  if (!p || !paymentBelongsTo(req.customerEmail, p)) return res.status(404).json({ message: 'Payment not found', success: false });
  const booking = paymentBooking(p);
  if (booking.status === 'cancelled' || p.status === 'cancelled') return res.status(400).json({ message: 'This booking was cancelled and can no longer be paid.' });
  if (p.status === 'completed') {
    return res.json({ message: 'This fee is already paid, thanks!', reference: p.transactionId, status: 'completed', cardLast4: p.cardLast4, success: true });
  }
  if (p.status === 'pending') return res.status(409).json({ message: 'A bank transfer is already logged. Please contact us before paying by card.' });
  const name = String((req.body || {}).cardName || '').trim();
  const numberText = String((req.body || {}).cardNumber || '').trim();
  if (!/^[0-9 ]+$/.test(numberText)) return res.status(400).json({ message: 'That card number does not look right, please check it.' });
  const number = numberText.replace(/\s+/g, '');
  const expiry = String(req.body.cardExpiry || '').trim();
  const cvv = String(req.body.cardCvv || '').trim();

  if (!name) return res.status(400).json({ message: 'Please put the name as it appears on the card.' });
  if (!luhnOk(number)) return res.status(400).json({ message: 'That card number does not look right, please check it.' });
  const m = expiry.match(/^(0[1-9]|1[0-2])\s*\/\s*([0-9]{2})$/);
  if (!m) return res.status(400).json({ message: 'Expiry should look like MM/YY, e.g. 08/28.' });
  // a card is valid to the END of its expiry month
  const endOfMonth = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59, 59);
  if (endOfMonth < new Date()) return res.status(400).json({ message: 'That card has expired, please use a different one.' });
  if (!/^[0-9]{3,4}$/.test(cvv)) return res.status(400).json({ message: 'The CVV is the 3 or 4 digit number on the back of the card.' });

  // "approved" - cards settle straight away, no waiting on the bank feed
  p.status = 'completed';
  p.method = 'card';
  p.cardLast4 = number.slice(-4);
  p.paidDate = new Date().toISOString().slice(0, 10);
  p.paymentDate = new Date().toISOString();
  save('payments', payments);
  // paid now = booking is confirmed now
  if (p.bookingId) {
    const b = paymentBooking(p);
    if (b) { b.status = 'confirmed'; save('bookings', bookings); }
  }
  sendMail(p.customerEmail || (bookings.find(x => x.id === p.bookingId) || {}).email,
    'Card payment approved - ' + p.transactionId,
    'Hi ' + (p.customerName || 'there') + ',\n\nYour card payment of $' + p.amount + ' (card ending ' + p.cardLast4 + ') was approved.\nYour booking is confirmed. Reference: ' + p.transactionId + '\nYou can print a receipt from your portal.\n\n- ESA Engineering');
  sendMail(settings.adminEmail, 'Card payment received: ' + p.transactionId,
    (p.customerName || 'A customer') + ' paid $' + p.amount + ' by card (ending ' + p.cardLast4 + '). Booking marked confirmed.');
  res.json({ message: 'Payment approved - your booking is confirmed.', reference: p.transactionId, status: 'completed', cardLast4: p.cardLast4, success: true });
});
app.get('/api/payments/:id', requireCustomer, (req, res) => {
  const p = payments.find(x => String(x.id) === req.params.id);
  if (!p || !paymentBelongsTo(req.customerEmail, p)) return res.status(404).json({ message: 'Payment not found', success: false });
  res.json({ payment: paymentSummary(p) });
});

// ---- ABOUT (legacy) ----
app.get('/about', (req, res) => res.json(aboutContent));
app.put('/about', requireAdmin, (req, res) => {
  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [k,v] of Object.entries(body)) if (v!=null) aboutContent[k]=v;
  }
  save('aboutContent', aboutContent);
  logAudit(req, 'about content updated', 'fields: ' + auditFields(body));
  res.json({ message: 'Updated', success: true });
});
app.get('/about/:field', (req, res) => {
  const val = aboutContent[req.params.field];
  res.send(val!=null ? String(val) : '');
});
app.put('/about/:field', requireAdmin, (req, res) => {
  const allowed = ['story', 'heading1', 'paragraph1', 'heading2', 'paragraph2', 'paragraph3', 'specialist1Name', 'specialist1Position', 'specialist1Biography', 'specialist2Name', 'specialist2Position', 'specialist2Biography'];
  if (!allowed.includes(req.params.field)) return res.status(404).json({ message: 'About field not found' });
  let val = req.body;
  if (typeof val === 'object') val = JSON.stringify(val);
  if (typeof val === 'string') {
    val = val.trim();
    if ((val.startsWith('"')&&val.endsWith('"'))||(val.startsWith("'")&&val.endsWith("'"))) val = val.slice(1,-1);
  }
  aboutContent[req.params.field]=val;
  save('aboutContent', aboutContent);
  logAudit(req, 'about content updated', req.params.field);
  res.json({ message: 'Updated', success: true });
});

// Return clear JSON for large or malformed API bodies without exposing a stack trace.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request is too large. Please reduce the file or message size.', success: false });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must be valid JSON.', success: false });
  }
  console.error('[request] ' + (err && err.message ? err.message : 'Unknown error'));
  return res.status(500).json({ message: 'The request could not be completed.', success: false });
});

// ---- STATIC FILES (must be after API) ----
app.use(express.static(STATIC_DIR, { extensions: ['html'] }));
// SPA fallback for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'Not found' });
  const filePath = path.join(STATIC_DIR, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return res.sendFile(filePath);
  // unknown page -> show the branded 404 instead of pretending its the home page.
  // (spring boot does the same thing with static/error/404.html)
  const notFound = path.join(STATIC_DIR, '404.html');
  if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
  res.status(404).send('Not found');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ESA Engineering server running at http://localhost:${PORT}`);
  console.log(`Serving static from ${STATIC_DIR}`);
});
