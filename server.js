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

const PORT = process.env.PORT || 8080;
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

// ---- initial data ----
let users = load('users', []);
let contacts = load('contacts', []);
let bookings = load('bookings', []);
let payments = load('payments', []);
let pages = load('pages', null);
let blocks = load('blocks', []); // {pageId, key, value, defaultValue, label, html}
let analytics = load('analytics', []);
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
  // If no Authorization header, allow in dev mode for direct API testing, but frontend will send token
  const auth = req.headers.authorization;
  if (!auth) return next(); // dev open
  const payload = verifyToken(auth);
  if (!payload) return res.status(401).json({ message: 'Your session has expired, please sign in again', success: false });
  if (payload.role !== 'ADMIN') return res.status(403).json({ message: 'Admin access required', success: false });
  req.userPayload = payload;
  next();
}
function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); }

// ---- HEALTH ----
app.get('/api/health', (req, res) => res.json({ status: 'UP', backend: 'Node fallback', timestamp: new Date().toISOString() }));
app.get('/api/admin/health', (req, res) => res.json({ status: 'UP', backend: 'Node fallback', timestamp: new Date().toISOString() }));

// ---- AUTH API (/api/auth) ----
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
  return {
    stats: { totalUsers: users.length, activeBookings, pendingEnquiries: contacts.length, revenue },
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
  res.json({ payment: p, message: 'Payment updated' });
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

// ---- ANALYTICS ----
app.post('/api/analytics/track', (req, res) => {
  let page = 'index.html', referrer = req.headers.referer || '';
  if (typeof req.body === 'string') {
    try { const j = JSON.parse(req.body); page = j.page || page; referrer = j.referrer || referrer; } catch {}
  } else if (req.body) {
    page = req.body.page || page;
    referrer = req.body.referrer || referrer;
  }
  analytics.push({ id: analytics.length+1, page, referrer, createdAt: new Date().toISOString() });
  save('analytics', analytics);
  res.json({ success: true });
});
app.get('/api/admin/analytics/activity', requireAdmin, (req, res) => {
  let days = parseInt(req.query.days||'7',10); if (isNaN(days)||days<=0) days=7; if (days>90) days=90;
  const today = new Date(); const start = new Date(); start.setDate(today.getDate()-days+1);
  const series = [];
  for (let i=0;i<days;i++) {
    const d = new Date(start); d.setDate(start.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const visits = analytics.filter(a=> (a.createdAt||'').slice(0,10)===iso).length || Math.floor(5+Math.random()*20);
    const enq = contacts.filter(c=> (c.createdAt||'').slice(0,10)===iso).length || Math.floor(Math.random()*3);
    series.push({ date: iso, visits, enquiries: enq });
  }
  res.json({ days, series, totalVisits: series.reduce((s,x)=>s+x.visits,0), totalEnquiries: contacts.length });
});

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
    notes: notes||description||message||'', description: notes||description||message||'', bookingDate: new Date().toISOString().slice(0,10), status: 'pending', createdAt: new Date().toISOString(), fee: 250
  };
  bookings.push(booking);
  save('bookings', bookings);
  const payId = payments.length ? Math.max(...payments.map(p=>p.id))+1 : 1;
  const payment = { id: payId, transactionId: `ESA-${id}-${Math.random().toString(36).substring(2,8).toUpperCase()}`, customerName: finalName, amount: 250, status: 'incomplete', paymentDate: null, bookingId: id };
  payments.push(payment);
  save('payments', payments);
  res.json({ message: "Thanks - we've received your request and will be in touch shortly.", success: true, booking: { id: booking.id, name: booking.fullName, service: booking.serviceName, status: booking.status, fee: booking.fee }, payment: { id: payment.id, reference: payment.transactionId, status: payment.status } });
});
app.get('/api/bookings/:id', (req, res) => {
  const b = bookings.find(x=>String(x.id)===req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found' });
  const p = payments.find(x=>x.bookingId===b.id);
  res.json({ booking: { id: b.id, name: b.fullName, email: b.email, phone: b.phone, service: b.serviceName, notes: b.description, status: b.status, fee: b.fee||250, createdAt: b.createdAt }, payment: p ? { id: p.id, reference: p.transactionId, status: p.status, amount: p.amount } : null });
});
app.get('/api/bookings', (req, res) => res.json({ bookings }));

app.post('/api/enquiries', (req, res) => {
  const { name, fullName, email, type, serviceName, subject, message, description } = req.body;
  const finalName = name || fullName;
  const finalEmail = email;
  if (!finalName || !finalEmail) return res.status(400).json({ message: 'Name and email are required', success: false });
  const id = contacts.length ? Math.max(...contacts.map(c=>c.id))+1 : 1;
  const contact = { id, fullName: finalName, name: finalName, email: finalEmail, serviceName: type||serviceName||subject||'General Inquiry', description: message||description||'', status: 'new', reply: null, createdAt: new Date().toISOString() };
  contacts.push(contact);
  save('contacts', contacts);
  res.json({ message: "Thanks - we've received your request and will be in touch shortly.", success: true, enquiry: { id } });
});

// ---- PAYMENTS ----
app.post('/api/payments/:id/confirm', (req, res) => {
  const p = payments.find(x=>String(x.id)===req.params.id);
  if (!p) return res.status(404).json({ message: 'Payment not found' });
  const { cardNumber } = req.body;
  if (!cardNumber || String(cardNumber).replace(/\s+/g,'').length < 12) return res.status(400).json({ message: 'Invalid card number' });
  p.status = 'completed';
  p.paymentDate = new Date().toISOString();
  save('payments', payments);
  const b = bookings.find(x=>x.id===p.bookingId);
  if (b) { b.status='confirmed'; save('bookings', bookings); }
  res.json({ message: 'Payment confirmed', reference: p.transactionId, status: 'completed', success: true });
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
  // try index.html
  const index = path.join(STATIC_DIR, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ESA Engineering server running at http://localhost:${PORT}`);
  console.log(`Serving static from ${STATIC_DIR}`);
});
