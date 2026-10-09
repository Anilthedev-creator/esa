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
const DATA_DIR = path.join(__dirname, 'data');
const JWT_SECRET = process.env.JWT_SECRET || 'esa-local-dev-secret-change-me-in-production-32chars';
const JWT_TTL = '12h';

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
  fs.writeFileSync(dbFile(name), JSON.stringify(data, null, 2));
}

// ---- really basic "email" helper ----
// there is no mail server hooked up yet (TODO: wire up SMTP one day) so every
// email the site sends just gets written into data/outbox as a .txt file.
// while testing, open the newest file in there to read the "email".
function sendMail(to, subject, body) {
  try {
    var dir = path.join(DATA_DIR, 'outbox');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    var fname = Date.now() + '-' + String(to).replace(/[^a-z0-9]/gi, '_') + '.txt';
    var txt = 'To: ' + to + '\nSubject: ' + subject + '\nDate: ' + new Date().toString() + '\n\n' + body + '\n';
    fs.writeFileSync(path.join(dir, fname), txt);
    console.log('[mail] to ' + to + ' -> ' + subject);
  } catch (e) {
    console.log('[mail] could not write the outbox file: ' + e.message);
  }
}

// ---- initial data ----
let users = load('users', []);
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

// ensure default admin
function ensureAdmin() {
  const hasAdmin = users.some(u => u.role === 'ADMIN');
  if (!hasAdmin) {
    const hashed = bcrypt.hashSync('Admin123', 10);
    const admin = {
      id: 1,
      fullName: 'ESA Administrator',
      firstName: 'ESA',
      lastName: 'Administrator',
      name: 'ESA Administrator',
      email: 'admin@esaengineering.com.au',
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
    console.log('    sign in : http://localhost:'+PORT+'/signin.html');
    console.log('    email   : admin@esaengineering.com.au');
    console.log('    password: Admin123');
    console.log('');
  }
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
  next();
}
function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); }

// ---- HEALTH ----
app.get('/api/health', (req, res) => res.json({ status: 'UP', backend: 'Node fallback', timestamp: new Date().toISOString() }));
app.get('/api/admin/health', (req, res) => res.json({ status: 'UP', backend: 'Node fallback', timestamp: new Date().toISOString() }));

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

app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, fullName, companyName, email, password, phone, phoneNumber } = req.body;
  let name = fullName || ((firstName||'') + ' ' + (lastName||'')).trim();
  if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required', success: false });
  const normEmail = email.trim().toLowerCase();
  if (users.some(u => u.email.toLowerCase() === normEmail)) return res.status(409).json({ message: 'That email already has an account. Try signing in instead.', success: false });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) return res.status(400).json({ message: 'Enter a valid email address', success: false });
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return res.status(400).json({ message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number', success: false });

  const id = users.length ? Math.max(...users.map(u=>u.id))+1 : 1;
  const hashed = bcrypt.hashSync(password, 10);
  const user = {
    id, fullName: name, name, firstName: firstName || name.split(' ')[0], lastName: lastName || name.split(' ').slice(1).join(' '),
    email: normEmail, password: hashed, phone: phone || phoneNumber || '', phoneNumber: phone || phoneNumber || '',
    company: companyName || '', companyName: companyName || '', role: 'CUSTOMER', active: true
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
  const ok = bcrypt.compareSync(password, user.password) || user.password === password; // allow plain for legacy
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
  if (user) {
    const token = crypto.randomBytes(20).toString('hex');
    resets = resets.filter(r => r.email !== email); // ditch any older link
    resets.push({ token: token, email: email, expires: Date.now() + 60 * 60 * 1000 });
    save('password-resets', resets);
    sendMail(email, 'Reset your ESA portal password',
      'Hi ' + (user.fullName || user.firstName || 'there') + ',\n\n' +
      'Someone (hopefully you) asked to reset the password on your ESA portal account.\n' +
      'Open the link below to pick a new one. It works for 1 hour:\n\n' +
      'reset-password.html?token=' + token + '\n\n' +
      'If it was not you, just ignore this email and nothing changes.\n\n- ESA Engineering');
  }
  res.json({ message: 'If that email is in our system a reset link is on its way. While mail is not hooked up yet it lands in the data/outbox folder on the server.', success: true });
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
  if (!password || password.length < 8) return res.status(400).json({ message: 'Password needs at least 8 characters.' });
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

app.post('/api/auth/create/admin', (req, res) => {
  const { fullName, email, password, phoneNumber, phone } = req.body;
  if (!fullName || !email || !password) return res.status(400).json({ message: 'Full name, email and password are required', success: false });
  const normEmail = email.trim().toLowerCase();
  if (users.some(u => u.email.toLowerCase() === normEmail)) return res.status(409).json({ message: 'That email already has an account', success: false });
  const id = users.length ? Math.max(...users.map(u=>u.id))+1 : 1;
  const hashed = bcrypt.hashSync(password, 10);
  const user = {
    id, fullName, name: fullName, firstName: fullName.split(' ')[0], lastName: fullName.split(' ').slice(1).join(' '),
    email: normEmail, password: hashed, phone: phone || phoneNumber || '', phoneNumber: phone || phoneNumber || '',
    company: 'ESA', companyName: 'ESA', role: 'ADMIN', active: true
  };
  users.push(user);
  save('users', users);
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
  const ok = bcrypt.compareSync(password||'', user.password) || user.password === (password||'');
  if (!ok) return res.send('Invalid Email or Password');
  return res.send(user.role === 'ADMIN' ? 'Admin Login Successful' : 'Customer Login Successful');
});

// ---- ADMIN DATA ----
function adminStats() {
  const now = new Date();
  const activeBookings = bookings.filter(b => {
    if (!b.bookingDate) return false;
    return new Date(b.bookingDate) >= new Date(now.toDateString());
  }).length;
  const revenue = payments.reduce((sum, p) => sum + (Number(p.amount)||0), 0);
  const recentRequests = bookings.slice(-5).reverse().map(b => ({
    id: b.id, customer: b.fullName, service: b.serviceName, date: b.bookingDate, status: b.status || 'pending'
  }));
  const recentEnquiries = contacts.slice(-5).reverse().map(c => ({
    id: c.id, name: c.fullName, preview: (c.description||'').slice(0,60), status: c.status||'new'
  }));
  // work queue: the things that need a human to look at them
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const alerts = {
    newEnquiries: contacts.filter(c => (c.status || 'new') === 'new').length,
    pendingPayments: payments.filter(p => (p.status || '') === 'pending').length,
    bookingsNext7Days: bookings.filter(b => {
      if (!b.bookingDate) return false;
      const d = new Date(b.bookingDate);
      return d >= new Date(now.toDateString()) && d <= nextWeek;
    }).length
  };
  return {
    stats: { totalUsers: users.length, activeBookings, pendingEnquiries: contacts.length, revenue },
    alerts,
    recentRequests, recentEnquiries
  };
}

app.get('/api/admin/stats', requireAdmin, (req, res) => res.json(adminStats()));
app.get('/admin/stats', requireAdmin, (req, res) => res.json(adminStats()));

app.get('/api/admin/customers', requireAdmin, (req, res) => {
  const rows = users.map(u => ({
    id: u.id, name: u.fullName, email: u.email, phone: u.phone||u.phoneNumber||'', company: u.company||u.companyName||'', status: u.active ? 'active':'inactive', lastUpdated: null, role: (u.role||'customer').toLowerCase()
  }));
  res.json({ customers: rows, total: rows.length });
});
app.get('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const u = users.find(x=>String(x.id)===req.params.id);
  if (!u) return res.status(404).json({ message: 'Customer not found' });
  res.json({ customer: { id: u.id, name: u.fullName, email: u.email, phone: u.phone||u.phoneNumber, company: u.company||u.companyName, status: u.active?'active':'inactive', role: u.role.toLowerCase() } });
});
app.patch('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const u = users.find(x=>String(x.id)===req.params.id);
  if (!u) return res.status(404).json({ message: 'Customer not found' });
  const { firstName, lastName, phone, companyName, company, status } = req.body;
  if (firstName || lastName) {
    const fn = firstName||'', ln = lastName||'';
    u.fullName = (fn+' '+ln).trim() || u.fullName;
    u.firstName = fn || u.firstName;
    u.lastName = ln || u.lastName;
    u.name = u.fullName;
  }
  if (phone) { u.phone = phone; u.phoneNumber = phone; }
  if (companyName) { u.companyName = companyName; u.company = companyName; }
  if (company) { u.company = company; u.companyName = company; }
  if (status) u.active = status !== 'inactive';
  save('users', users);
  logAudit(req, 'customer updated', u.email || u.fullName || String(u.id));
  res.json({ customer: u, message: 'Customer updated' });
});

app.get('/api/admin/enquiries', requireAdmin, (req, res) => {
  const rows = [...contacts].reverse().map(c => ({
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
  logAudit(req, 'enquiry updated', '#' + c.id + (req.body.status ? ' -> ' + req.body.status : '') + (req.body.reply !== undefined ? ' (reply sent)' : ''));
  res.json({ enquiry: c, message: 'Enquiry updated' });
});

app.get('/api/admin/payments', requireAdmin, (req, res) => {
  const rows = [...payments].reverse().map(p => ({
    id: p.id, invoiceId: p.transactionId, customerName: p.customerName||null, amount: p.amount, status: p.status||'completed', paidAt: p.paymentDate||null
  }));
  res.json({ payments: rows, total: rows.length });
});
app.get('/api/admin/payments/:id', requireAdmin, (req, res) => {
  const p = payments.find(x=>String(x.id)===req.params.id);
  if (!p) return res.status(404).json({ message: 'Payment not found' });
  res.json({ payment: { id: p.id, invoiceId: p.transactionId, customerName: p.customerName, amount: p.amount, status: p.status, paidAt: p.paymentDate } });
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
  logAudit(req, 'payment updated', '#' + p.id + ' -> ' + (p.status || '?'));
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
  logAudit(req, 'case study updated', p.title + ' (' + p.status + ')');
  res.json({ project: p, message: 'Case study updated', success: true });
});
app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const gone = caseStudies.find(x => String(x.id) === req.params.id);
  caseStudies = caseStudies.filter(x => String(x.id) !== req.params.id);
  save('case-studies', caseStudies);
  logAudit(req, 'case study deleted', gone ? gone.title : '#' + req.params.id);
  res.json({ message: 'Case study deleted', success: true });
});

// ---- AUDIT LOG (who did what in the admin) ----
// every admin mutation calls logAudit so there is a paper trail. kept in a
// json file like everything else, capped at 500 entries so it cant grow forever
let auditLog = load('audit-log', []);

function logAudit(req, action, detail) {
  const entry = {
    id: auditLog.length ? Math.max(...auditLog.map(a => a.id)) + 1 : 1,
    at: new Date().toISOString(),
    who: (req.userPayload && req.userPayload.email) || 'unknown',
    action: action,
    detail: detail || ''
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
function discoverBlocksFromFile(slug) {
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
  const filePath = path.join(STATIC_DIR, slug);
  if (!fs.existsSync(filePath)) return false;
  const html = fs.readFileSync(filePath, 'utf8');
  const pattern = new RegExp(`<[^>]*data-cms\\s*=\\s*["']${key}["'][^>]*>`, 'i');
  const match = html.match(pattern);
  if (!match) return false;
  return match[0].toLowerCase().includes('data-cms-html');
}

app.get('/api/admin/pages', requireAdmin, (req, res) => {
  res.json({ pages: pages.map(p=>({ id: p.id, title: p.title, slug: p.slug, status: p.status, updatedAt: p.updatedAt })), total: pages.length });
});
app.post('/api/admin/pages', requireAdmin, (req, res) => {
  const { title, slug } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  let finalSlug = slug && slug.trim() ? slug.trim() : title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '.html';
  if (pages.some(p=>p.slug===finalSlug)) return res.status(409).json({ message: 'A page with that slug already exists' });
  const id = pages.length ? Math.max(...pages.map(p=>p.id))+1 : 1;
  const page = { id, title: title.trim(), slug: finalSlug, status: 'published', updatedAt: new Date().toISOString() };
  pages.push(page);
  save('pages', pages);
  logAudit(req, 'page created', page.title || page.slug || String(page.id));
  res.json({ page, message: 'Page created' });
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
  res.json({ page: { id: page.id, title: page.title, slug: page.slug, status: page.status, updatedAt: page.updatedAt }, blocks: resultBlocks });
});
app.patch('/api/admin/pages/:id', requireAdmin, (req, res) => {
  const page = pages.find(p=>String(p.id)===req.params.id);
  if (!page) return res.status(404).json({ message: 'Page not found' });
  if (req.body.status) {
    const s = req.body.status.toLowerCase();
    if (!['published','draft'].includes(s)) return res.status(400).json({ message: 'Status must be published or draft' });
    page.status = s;
    page.updatedAt = new Date().toISOString();
    save('pages', pages);
  }
  logAudit(req, 'page content updated', page.title || page.slug || String(page.id));
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
  res.json({ message: 'Content saved', success: true });
});
app.delete('/api/admin/pages/:id/blocks/:key', requireAdmin, (req, res) => {
  const before = blocks.length;
  blocks = blocks.filter(b=> !(String(b.pageId)===req.params.id && b.key===req.params.key));
  if (blocks.length !== before) save('blocks', blocks);
  res.json({ message: 'Block reset to default', success: true });
});

// ---- PUBLIC CONTENT ----
app.get('/api/content', (req, res) => {
  const slug = req.query.slug || 'index.html';
  const page = pages.find(p=>p.slug===slug);
  const defaults = discoverBlocksFromFile(slug);
  const persisted = page ? blocks.filter(b=>String(b.pageId)===String(page.id)) : [];
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
const ownBookings = (email) => bookings.filter(b => b.email === email);
const ownEnquiries = (email) => contacts.filter(c => c.email === email);
const ownPayments = (email) => {
  const ids = new Set(ownBookings(email).map(b => b.id));
  return payments.filter(p => ids.has(p.bookingId));
};
const bookingSummary = (b) => {
  const p = payments.find(x => x.bookingId === b.id) || null;
  const payStatus = !p ? 'unpaid' : (p.status || 'incomplete');
  return {
    bookingId: b.id, name: b.fullName, service: b.serviceName, status: b.status,
    bookingDate: b.bookingDate, createdAt: b.createdAt, fee: p ? p.amount : CONSULTATION_FEE,
    preferredSlot: b.preferredSlot || null,
    paymentStatus: payStatus, paid: payStatus === 'completed',
    paymentReference: p ? p.transactionId : null,
    canCancel: (b.status === 'pending' || b.status === 'confirmed') && payStatus !== 'completed',
    canPay: (b.status === 'pending' || b.status === 'confirmed') && payStatus !== 'completed' && payStatus !== 'cancelled'
  };
};
const paymentSummary = (p) => ({
  id: p.id, reference: p.transactionId, amount: p.amount, status: p.status || 'incomplete',
  paid: (p.status || '') === 'completed', bookingId: p.bookingId, customerName: p.customerName, paymentDate: p.paymentDate
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
  if (body.fullName && String(body.fullName).trim()) u.fullName = String(body.fullName).trim();
  u.phoneNumber = body.phoneNumber ? String(body.phoneNumber).trim() : '';
  u.companyName = body.companyName ? String(body.companyName).trim() : '';
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
  const status = b.status || 'pending';
  if (status === 'completed' || status === 'cancelled') {
    return res.status(400).json({ message: 'This booking is ' + status + ' so it can not be moved, please call us.', success: false });
  }
  if (req.body.preferredDate) b.bookingDate = String(req.body.preferredDate).slice(0, 10);
  if (req.body.preferredSlot) b.preferredSlot = String(req.body.preferredSlot);
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
  res.json({ settings });
});

// ---- BOOKINGS & ENQUIRIES PUBLIC ----
app.post('/api/bookings', (req, res) => {
  const { name, fullName, email, phone, service, serviceName, notes, description, message } = req.body;
  const finalName = name || fullName;
  const finalEmail = email;
  if (!finalName || !finalEmail) return res.status(400).json({ message: 'Name and email are required', success: false });
  const id = bookings.length ? Math.max(...bookings.map(b=>b.id))+1 : 1;
  const booking = {
    id, fullName: finalName, name: finalName, email: finalEmail, phone: phone||'', service: service||serviceName||'General Inquiry', serviceName: service||serviceName||'General Inquiry',
    notes: notes||description||message||'', description: notes||description||message||'',
    // if they picked a preferred date on the form use that, otherwise today
    preferredSlot: req.body.preferredSlot || '',
    bookingDate: (req.body.preferredDate || new Date().toISOString().slice(0,10)),
    status: 'pending', createdAt: new Date().toISOString(), fee: 50
  };
  bookings.push(booking);
  save('bookings', bookings);
  if (booking.preferredSlot) {
    sendMail(settings.adminEmail, 'slot picked on booking #' + id, finalName + ' asked for ' + booking.bookingDate + ' at ' + booking.preferredSlot);
  }
  sendMail(finalEmail, 'We got your booking - ' + booking.serviceName,
    'Hi ' + finalName + ',\n\nThanks for booking ' + booking.serviceName + ' with ESA Engineering.\n' +
    'Your booking reference is #' + id + ' and the consultation fee is $' + booking.fee + '.\n' +
    'The next step is the payment page (payment.html?booking=' + id + ') where you can log your bank transfer.\n\n- ESA Engineering');
  sendMail(settings.adminEmail, 'New booking #' + id + ' - ' + booking.serviceName,
    finalName + ' (' + finalEmail + ', ' + (phone || 'no phone') + ') booked ' + booking.serviceName + '.\nNotes: ' + (notes || '-'));
  const payId = payments.length ? Math.max(...payments.map(p=>p.id))+1 : 1;
  const payment = { id: payId, transactionId: `ESA-${id}-${Math.random().toString(36).substring(2,8).toUpperCase()}`, customerName: finalName, amount: CONSULTATION_FEE, status: 'incomplete', paymentDate: null, bookingId: id };
  payments.push(payment);
  save('payments', payments);
  res.json({ message: "Thanks - we've received your request and will be in touch shortly.", success: true, booking: { id: booking.id, name: booking.fullName, service: booking.serviceName, status: booking.status, fee: booking.fee }, payment: { id: payment.id, reference: payment.transactionId, status: payment.status } });
});
app.get('/api/bookings/:id', (req, res) => {
  const b = bookings.find(x=>String(x.id)===req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found' });
  const p = payments.find(x=>x.bookingId===b.id);
  res.json({ booking: { id: b.id, name: b.fullName, email: b.email, phone: b.phone, service: b.serviceName, notes: b.description, status: b.status, fee: b.fee||CONSULTATION_FEE, createdAt: b.createdAt, bookingDate: b.bookingDate }, payment: p ? { id: p.id, reference: p.transactionId, status: p.status, amount: p.amount } : null });
});
app.get('/api/bookings', (req, res) => res.json({ bookings }));

app.post('/api/enquiries', (req, res) => {
  const { name, fullName, email, type, serviceName, subject, message, description } = req.body;
  const finalName = name || fullName;
  const finalEmail = email;
  if (!finalName || !finalEmail) return res.status(400).json({ message: 'Name and email are required', success: false });
  const id = contacts.length ? Math.max(...contacts.map(c=>c.id))+1 : 1;
  // attachment comes in as base64 from the contact form (no multipart needed)
  let attachNote = '';
  if (req.body.attachmentName && req.body.attachmentData) {
    try {
      const upDir = path.join(DATA_DIR, 'uploads');
      if (!fs.existsSync(upDir)) fs.mkdirSync(upDir, { recursive: true });
      const safe = String(req.body.attachmentName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const fname = Date.now() + '-' + safe;
      fs.writeFileSync(path.join(upDir, fname), Buffer.from(String(req.body.attachmentData), 'base64'));
      attachNote = '\n[attachment saved as ' + fname + ']';
    } catch (e) {
      console.log('[upload] could not save attachment: ' + e.message);
    }
  }
  const contact = { id, fullName: finalName, name: finalName, email: finalEmail, serviceName: type||serviceName||subject||'General Inquiry', description: (message||description||'') + attachNote, status: 'new', reply: null, createdAt: new Date().toISOString() };
  contacts.push(contact);
  save('contacts', contacts);
  sendMail(finalEmail, 'We got your enquiry - ' + contact.serviceName,
    'Hi ' + finalName + ',\n\nThanks for getting in touch about ' + contact.serviceName + '.\nOne of our engineers will reply within 1 business day.\n\n- ESA Engineering');
  sendMail(settings.adminEmail, 'New enquiry #' + id + ' - ' + contact.serviceName,
    finalName + ' (' + finalEmail + ') wrote: ' + (contact.description || '-'));
  res.json({ message: "Thanks - we've received your request and will be in touch shortly.", success: true, enquiry: { id } });
});

// ---- PAYMENTS ----
// we dont take cards on the website (no payment gateway yet, TODO: stripe?)
// the customer banks the consultation fee and types in the transfer reference
// from their bank receipt. The office then ticks it off once it hits the bank.
app.post('/api/payments/:id/confirm', (req, res) => {
  const p = payments.find(x=>String(x.id)===req.params.id);
  if (!p) return res.status(404).json({ message: 'Payment not found' });
  if (p.status === 'completed') return res.json({ message: 'This fee is already paid, thanks!', reference: p.transactionId, status: 'completed', success: true });
  const ref = String(req.body.transferReference || '').trim();
  if (!ref) return res.status(400).json({ message: 'Please put in the transfer reference from your bank receipt.' });
  p.status = 'pending'; // waiting on the office to see it in the bank feed
  p.transferReference = ref;
  p.paidDate = String(req.body.paidDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  p.paymentDate = new Date().toISOString();
  save('payments', payments);
  sendMail(settings.adminEmail, 'Bank transfer logged: ' + p.transactionId,
    (p.customerName || 'A customer') + ' logged a transfer of $' + p.amount + ' with reference "' + ref + '" on ' + p.paidDate + '.\nPlease check the bank feed and mark it paid in the admin payments page.');
  res.json({ message: 'Thanks! We logged your transfer and will confirm once it clears, usually within 1 business day.', reference: p.transactionId, status: 'pending', success: true });
});
app.get('/api/payments/:id', (req, res) => {
  const p = payments.find(x=>String(x.id)===req.params.id);
  if (!p) return res.status(404).json({ message: 'Payment not found' });
  res.json({ payment: p });
});

// ---- ABOUT (legacy) ----
app.get('/about', (req, res) => res.json(aboutContent));
app.put('/about', (req, res) => {
  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [k,v] of Object.entries(body)) if (v!=null) aboutContent[k]=v;
  }
  save('aboutContent', aboutContent);
  res.json({ message: 'Updated' });
});
app.get('/about/:field', (req, res) => {
  const val = aboutContent[req.params.field];
  res.send(val!=null ? String(val) : '');
});
app.put('/about/:field', (req, res) => {
  let val = req.body;
  if (typeof val === 'object') val = JSON.stringify(val);
  if (typeof val === 'string') {
    val = val.trim();
    if ((val.startsWith('"')&&val.endsWith('"'))||(val.startsWith("'")&&val.endsWith("'"))) val = val.slice(1,-1);
  }
  aboutContent[req.params.field]=val;
  save('aboutContent', aboutContent);
  res.json({ message: 'Updated' });
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
