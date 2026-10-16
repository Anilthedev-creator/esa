const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { test } = require('node:test');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function startServer(port, dataDir) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, {
      PORT: String(port),
      ESA_DATA_DIR: dataDir,
      NODE_ENV: 'test'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Node server did not start: ' + logs)), 10000);
    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error('Node server exited (' + code + '): ' + logs));
    });
    const check = () => {
      if (logs.includes('server running at')) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on('data', check);
    child.stderr.on('data', check);
  });

  return { child, ready };
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function api(base, route, options) {
  options = options || {};
  const headers = Object.assign({}, options.token ? { Authorization: 'Bearer ' + options.token } : {});
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = { text }; }
  }
  return { status: response.status, data, text };
}

test('Node API scopes booking and payment data and protects the sandbox card flow', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esa-node-api-test-'));
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const { child, ready } = startServer(port, dataDir);

  try {
    await ready;

    const unauthBookingList = await api(base, '/api/bookings');
    assert.equal(unauthBookingList.status, 401);
    const unauthCreateAdmin = await api(base, '/api/auth/create/admin', {
      method: 'POST', body: { fullName: 'New Admin', email: 'new-admin@example.com', password: 'Password123' }
    });
    assert.equal(unauthCreateAdmin.status, 401);

    const aliceSignup = await api(base, '/api/auth/signup', {
      method: 'POST', body: {
        firstName: 'Alice', lastName: 'Customer', companyName: 'Test Co',
        email: 'alice@example.com', password: 'StrongPass9'
      }
    });
    const bobSignup = await api(base, '/api/auth/signup', {
      method: 'POST', body: {
        firstName: 'Bob', lastName: 'Customer', companyName: 'Test Co',
        email: 'bob@example.com', password: 'StrongPass9'
      }
    });
    assert.equal(aliceSignup.status, 201);
    assert.equal(bobSignup.status, 201);
    const aliceToken = aliceSignup.data.token;
    const bobToken = bobSignup.data.token;
    assert.ok(aliceToken);
    assert.ok(bobToken);
    const customerCreateAdmin = await api(base, '/api/auth/create/admin', {
      method: 'POST', token: aliceToken,
      body: { fullName: 'New Admin', email: 'new-admin@example.com', password: 'Password123' }
    });
    assert.equal(customerCreateAdmin.status, 403);

    const unauthCreateBooking = await api(base, '/api/bookings', {
      method: 'POST', body: { name: 'Alice', email: 'alice@example.com', service: 'Plant Commissioning' }
    });
    assert.equal(unauthCreateBooking.status, 401);

    const transferBooking = await api(base, '/api/bookings', {
      method: 'POST',
      token: aliceToken,
      body: {
        name: 'Alice Customer', email: 'bob@example.com', phone: '0400000000',
        service: 'Plant Commissioning', preferredDate: new Date().toISOString().slice(0, 10),
        preferredSlot: '10:00'
      }
    });
    assert.equal(transferBooking.status, 200);
    const bookingId = transferBooking.data.booking.id;
    const paymentId = transferBooking.data.payment.id;

    const aliceBooking = await api(base, '/api/bookings/' + bookingId, { token: aliceToken });
    assert.equal(aliceBooking.status, 200);
    assert.equal(aliceBooking.data.booking.email, 'alice@example.com');
    assert.equal(aliceBooking.data.payment.status, 'incomplete');
    assert.equal((await api(base, '/api/bookings/' + bookingId, { token: bobToken })).status, 404);
    assert.equal((await api(base, '/api/bookings/' + bookingId)).status, 401);

    const badBookingDate = await api(base, '/api/bookings', {
      method: 'POST', token: aliceToken,
      body: { name: 'Alice', preferredDate: '2026-02-31', preferredSlot: '10:00' }
    });
    assert.equal(badBookingDate.status, 400);

    const slotBooking = await api(base, '/api/bookings', {
      method: 'POST', token: aliceToken,
      body: { name: 'Alice Customer', service: 'Waste Management', preferredSlot: '10:00' }
    });
    const todayForReschedule = new Date().toISOString().slice(0, 10);
    const clearedSlot = await api(base, '/api/portal/bookings/' + slotBooking.data.booking.id + '/reschedule', {
      method: 'POST', token: aliceToken,
      body: { preferredDate: todayForReschedule, preferredSlot: '' }
    });
    assert.equal(clearedSlot.status, 200);
    assert.equal(clearedSlot.data.booking.preferredSlot, null);
    const invalidSlot = await api(base, '/api/portal/bookings/' + slotBooking.data.booking.id + '/reschedule', {
      method: 'POST', token: aliceToken,
      body: { preferredSlot: '25:00' }
    });
    assert.equal(invalidSlot.status, 400);

    assert.equal((await api(base, '/api/payments/' + paymentId, { token: bobToken })).status, 404);
    assert.equal((await api(base, '/api/payments/' + paymentId + '/confirm', {
      method: 'POST', token: bobToken,
      body: { transferReference: 'NOT-ALICE', paidDate: new Date().toISOString().slice(0, 10) }
    })).status, 404);
    assert.equal((await api(base, '/api/payments/' + paymentId + '/card', {
      method: 'POST', token: bobToken,
      body: { cardName: 'Bob Customer', cardNumber: '4242 4242 4242 4242', cardExpiry: '12/35', cardCvv: '123' }
    })).status, 404);

    const today = new Date().toISOString().slice(0, 10);
    const transfer = await api(base, '/api/payments/' + paymentId + '/confirm', {
      method: 'POST', token: aliceToken,
      body: { transferReference: 'BANK-RECEIPT-1', paidDate: today }
    });
    assert.equal(transfer.status, 200);
    assert.equal(transfer.data.status, 'pending');

    const duplicateTransfer = await api(base, '/api/payments/' + paymentId + '/confirm', {
      method: 'POST', token: aliceToken,
      body: { transferReference: 'BANK-RECEIPT-2', paidDate: today }
    });
    assert.equal(duplicateTransfer.status, 200);
    assert.equal(duplicateTransfer.data.status, 'pending');

    const secondPayment = await api(base, '/api/payments/' + paymentId + '/card', {
      method: 'POST', token: aliceToken,
      body: { cardName: 'Alice Customer', cardNumber: '4242 4242 4242 4242', cardExpiry: '12/35', cardCvv: '123' }
    });
    assert.equal(secondPayment.status, 409);

    const cancelPending = await api(base, '/api/portal/bookings/' + bookingId + '/cancel', {
      method: 'POST', token: aliceToken, body: {}
    });
    assert.equal(cancelPending.status, 400);
    const portal = await api(base, '/api/portal/summary', { token: aliceToken });
    const portalBooking = portal.data.bookings.find((booking) => String(booking.bookingId) === String(bookingId));
    assert.equal(portalBooking.canPay, false);
    assert.equal(portalBooking.canCancel, false);

    const cardBooking = await api(base, '/api/bookings', {
      method: 'POST', token: aliceToken,
      body: { name: 'Alice Customer', email: 'somebody-else@example.com', service: 'Utility Appraisals' }
    });
    const cardPaymentId = cardBooking.data.payment.id;
    const cardResponse = await api(base, '/api/payments/' + cardPaymentId + '/card', {
      method: 'POST', token: aliceToken,
      body: { cardName: 'Alice Customer', cardNumber: '4242 4242 4242 4242', cardExpiry: '12/35', cardCvv: '123' }
    });
    assert.equal(cardResponse.status, 200);
    assert.equal(cardResponse.data.status, 'completed');
    assert.equal(cardResponse.data.cardLast4, '4242');
    const cardDetails = await api(base, '/api/payments/' + cardPaymentId, { token: aliceToken });
    assert.equal(cardDetails.status, 200);
    assert.equal(cardDetails.data.payment.method, 'card');
    assert.equal(cardDetails.data.payment.cardLast4, '4242');
    assert.equal(JSON.stringify(cardDetails.data).includes('cardNumber'), false);
    assert.equal(JSON.stringify(cardDetails.data).includes('cardCvv'), false);

    const cardRows = JSON.parse(fs.readFileSync(path.join(dataDir, 'payments.json'), 'utf8'));
    const savedCardPayment = cardRows.find((payment) => String(payment.id) === String(cardPaymentId));
    assert.equal(savedCardPayment.cardLast4, '4242');
    assert.equal(Object.hasOwn(savedCardPayment, 'cardNumber'), false);
    assert.equal(Object.hasOwn(savedCardPayment, 'cardCvv'), false);

    const adminSignin = await api(base, '/api/auth/signin', {
      method: 'POST', body: { email: 'admin@esaengineering.com.au', password: 'Admin123' }
    });
    assert.equal(adminSignin.status, 200);
    const weakAdmin = await api(base, '/api/auth/create/admin', {
      method: 'POST', token: adminSignin.data.token,
      body: { fullName: 'Weak Admin', email: 'weak-admin@example.com', password: 'weak' }
    });
    assert.equal(weakAdmin.status, 400);
    const createdAdmin = await api(base, '/api/auth/create/admin', {
      method: 'POST', token: adminSignin.data.token,
      body: { fullName: 'New Admin', email: 'new-admin@example.com', password: 'StrongAdmin9' }
    });
    assert.equal(createdAdmin.status, 200);
    const adminBookings = await api(base, '/api/bookings', { token: adminSignin.data.token });
    assert.equal(adminBookings.status, 200);
    const adminPayments = await api(base, '/api/admin/payments', { token: adminSignin.data.token });
    const transferRow = adminPayments.data.payments.find((payment) => String(payment.id) === String(paymentId));
    assert.equal(transferRow.method, 'transfer');
    assert.equal(transferRow.transferReference, 'BANK-RECEIPT-1');

    const enquiry = await api(base, '/api/enquiries', {
      method: 'POST', body: { name: 'Alice', email: 'alice@example.com', message: 'private detail' }
    });
    const enquiryId = enquiry.data.enquiry.id;
    assert.equal((await api(base, '/api/enquiries/' + enquiryId, { token: aliceToken })).status, 200);
    assert.equal((await api(base, '/api/enquiries/' + enquiryId, { token: bobToken })).status, 404);
    assert.equal((await api(base, '/api/enquiries/' + enquiryId)).status, 401);

    await t.test('sandbox card route rejects malformed card data without storing it', async () => {
      const invalidBooking = await api(base, '/api/bookings', {
        method: 'POST', token: aliceToken, body: { name: 'Alice Customer', service: 'Waste Management' }
      });
      const invalid = await api(base, '/api/payments/' + invalidBooking.data.payment.id + '/card', {
        method: 'POST', token: aliceToken,
        body: { cardName: 'Alice Customer', cardNumber: '4242x4242x4242x4242', cardExpiry: '12/35', cardCvv: '123' }
      });
      assert.equal(invalid.status, 400);
    });
  } finally {
    await stopServer(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});


test('Node production startup refuses demo secrets and missing admin credentials', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esa-node-prod-test-'));
  const serverPath = path.join(__dirname, '..', 'server.js');
  try {
    const noSecret = spawnSync(process.execPath, [serverPath], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, {
        NODE_ENV: 'production', PORT: '0', ESA_DATA_DIR: dataDir,
        JWT_SECRET: '', ADMIN_EMAIL: '', ADMIN_PASSWORD: ''
      }),
      encoding: 'utf8', timeout: 5000
    });
    assert.notEqual(noSecret.status, 0);
    assert.match(noSecret.stderr, /Set a unique JWT_SECRET/);

    const noAdmin = spawnSync(process.execPath, [serverPath], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, {
        NODE_ENV: 'production', PORT: '0', ESA_DATA_DIR: dataDir,
        JWT_SECRET: 'a-unique-production-secret-for-node-tests',
        ADMIN_EMAIL: '', ADMIN_PASSWORD: ''
      }),
      encoding: 'utf8', timeout: 5000
    });
    assert.notEqual(noAdmin.status, 0);
    assert.match(noAdmin.stderr, /Set ADMIN_EMAIL and ADMIN_PASSWORD/);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
