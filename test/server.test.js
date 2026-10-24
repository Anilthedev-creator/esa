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

function startServer(port, dataDir, demoEmailPreview) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, {
      PORT: String(port),
      ESA_DATA_DIR: dataDir,
      NODE_ENV: 'test',
      ESA_DEMO_EMAIL_PREVIEW: demoEmailPreview === false ? 'false' : 'true'
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

    const resetRequest = await api(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: 'alice@example.com' }
    });
    assert.equal(resetRequest.status, 200);
    assert.ok(resetRequest.data.demoEmailPreview);
    assert.ok(resetRequest.data.demoEmailPreview.actionUrl.startsWith('reset-password.html?token='));
    const resetToken = new URL(resetRequest.data.demoEmailPreview.actionUrl, base).searchParams.get('token');
    const resetResult = await api(base, '/api/auth/reset-password', {
      method: 'POST', body: { token: resetToken, password: 'NewStrongPass9' }
    });
    assert.equal(resetResult.status, 200);
    const unknownReset = await api(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: 'missing@example.com' }
    });
    assert.equal(Object.hasOwn(unknownReset.data, 'demoEmailPreview'), false);

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
    assert.equal(transferBooking.data.demoEmailPreview.bookingId, transferBooking.data.booking.id);
    assert.match(transferBooking.data.demoEmailPreview.subject, /We got your booking/);
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
    const newAdminSignin = await api(base, '/api/auth/signin', {
      method: 'POST', body: { email: 'new-admin@example.com', password: 'StrongAdmin9' }
    });
    const adminReset = await api(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: 'new-admin@example.com' }
    });
    assert.equal(Object.hasOwn(adminReset.data, 'demoEmailPreview'), false);
    const adminBooking = await api(base, '/api/bookings', {
      method: 'POST', token: newAdminSignin.data.token,
      body: { name: 'Demo Admin', service: 'Waste Management' }
    });
    assert.equal(Object.hasOwn(adminBooking.data, 'demoEmailPreview'), false);
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


test('Node demo wallet payments support PayPal and Zip Pay without storing payment details', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esa-node-wallet-test-'));
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const { child, ready } = startServer(port, dataDir, false);

  try {
    await ready;
    const alice = await api(base, '/api/auth/signup', {
      method: 'POST', body: {
        firstName: 'Alice', lastName: 'Customer', email: 'alice@example.com', password: 'StrongPass9'
      }
    });
    const bob = await api(base, '/api/auth/signup', {
      method: 'POST', body: {
        firstName: 'Bob', lastName: 'Customer', email: 'bob@example.com', password: 'StrongPass9'
      }
    });
    assert.equal(alice.status, 201);
    assert.equal(bob.status, 201);

    const walletPaymentIds = [];
    for (const method of ['paypal', 'zip_pay']) {
      const booking = await api(base, '/api/bookings', {
        method: 'POST', token: alice.data.token,
        body: { name: 'Alice Customer', service: 'Plant Commissioning' }
      });
      assert.equal(booking.status, 200);
      const paymentId = booking.data.payment.id;
      walletPaymentIds.push(paymentId);

      const otherCustomer = await api(base, '/api/payments/' + paymentId + '/wallet', {
        method: 'POST', token: bob.data.token, body: { method: method }
      });
      assert.equal(otherCustomer.status, 404);

      const unsupported = await api(base, '/api/payments/' + paymentId + '/wallet', {
        method: 'POST', token: alice.data.token, body: { method: 'card' }
      });
      assert.equal(unsupported.status, 400);

      const paid = await api(base, '/api/payments/' + paymentId + '/wallet', {
        method: 'POST', token: alice.data.token, body: { method: method }
      });
      assert.equal(paid.status, 200);
      assert.equal(paid.data.status, 'completed');
      assert.equal(paid.data.method, method);
      assert.equal(paid.data.demo, true);
      assert.match(paid.data.message, /no real charge/i);

      const details = await api(base, '/api/payments/' + paymentId, { token: alice.data.token });
      assert.equal(details.data.payment.method, method);
      assert.equal(details.data.payment.status, 'completed');
      assert.equal(JSON.stringify(details.data).includes('cardNumber'), false);
      assert.equal(JSON.stringify(details.data).includes('cardCvv'), false);

      const savedPayments = JSON.parse(fs.readFileSync(path.join(dataDir, 'payments.json'), 'utf8'));
      const saved = savedPayments.find((payment) => String(payment.id) === String(paymentId));
      assert.equal(saved.method, method);
      assert.equal(saved.status, 'completed');
      assert.equal(saved.cardLast4, null);
      assert.equal(Object.hasOwn(saved, 'cardNumber'), false);
      assert.equal(Object.hasOwn(saved, 'cardCvv'), false);

      const bookingDetails = await api(base, '/api/bookings/' + booking.data.booking.id, { token: alice.data.token });
      assert.equal(bookingDetails.data.booking.status, 'confirmed');
    }

    const portalPayments = await api(base, '/api/portal/payments', { token: alice.data.token });
    for (let i = 0; i < walletPaymentIds.length; i++) {
      const method = i === 0 ? 'paypal' : 'zip_pay';
      const row = portalPayments.data.payments.find((payment) => String(payment.id) === String(walletPaymentIds[i]));
      assert.equal(row.method, method);
    }
    const adminSignin = await api(base, '/api/auth/signin', {
      method: 'POST', body: { email: 'admin@esaengineering.com.au', password: 'Admin123' }
    });
    const adminPayments = await api(base, '/api/admin/payments', { token: adminSignin.data.token });
    for (let i = 0; i < walletPaymentIds.length; i++) {
      const method = i === 0 ? 'paypal' : 'zip_pay';
      const row = adminPayments.data.payments.find((payment) => String(payment.id) === String(walletPaymentIds[i]));
      assert.equal(row.method, method);
    }

    const transferBooking = await api(base, '/api/bookings', {
      method: 'POST', token: alice.data.token,
      body: { name: 'Alice Customer', service: 'Waste Management' }
    });
    const transferPaymentId = transferBooking.data.payment.id;
    const transfer = await api(base, '/api/payments/' + transferPaymentId + '/confirm', {
      method: 'POST', token: alice.data.token,
      body: { transferReference: 'BANK-123', paidDate: new Date().toISOString().slice(0, 10) }
    });
    assert.equal(transfer.status, 200);
    const walletAfterTransfer = await api(base, '/api/payments/' + transferPaymentId + '/wallet', {
      method: 'POST', token: alice.data.token, body: { method: 'paypal' }
    });
    assert.equal(walletAfterTransfer.status, 409);
  } finally {
    await stopServer(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});


test('admin edits are audited and data can be read again after a Node restart', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esa-node-audit-test-'));
  let port = await freePort();
  let base = 'http://127.0.0.1:' + port;
  let running = startServer(port, dataDir);

  try {
    await running.ready;
    const adminLogin = await api(base, '/api/auth/signin', {
      method: 'POST', body: { email: 'admin@esaengineering.com.au', password: 'Admin123' }
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.data.token;

    const customerSignup = await api(base, '/api/auth/signup', {
      method: 'POST', body: {
        firstName: 'Persisted', lastName: 'Customer', email: 'persist@example.com',
        password: 'StrongPass9', phone: '0400000000', companyName: 'Original Co'
      }
    });
    assert.equal(customerSignup.status, 201);
    const customerToken = customerSignup.data.token;
    const customerId = customerSignup.data.user.id;

    const profileEdit = await api(base, '/api/portal/profile', {
      method: 'PUT', token: customerToken,
      body: { fullName: 'Saved Customer', phoneNumber: '0412345678', companyName: 'Saved Co' }
    });
    assert.equal(profileEdit.status, 200);
    assert.equal(profileEdit.data.profile.companyName, 'Saved Co');
    const savedUsersAfterProfileEdit = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
    const savedProfileUser = savedUsersAfterProfileEdit.find((user) => user.id === customerId);
    assert.equal(savedProfileUser.phone, '0412345678');
    assert.equal(savedProfileUser.company, 'Saved Co');

    const clearCustomerSignup = await api(base, '/api/auth/signup', {
      method: 'POST', body: {
        firstName: 'Clear', lastName: 'Customer', email: 'clear@example.com',
        password: 'StrongPass9', phone: '0400000001', companyName: 'To be cleared'
      }
    });
    assert.equal(clearCustomerSignup.status, 201);
    const clearCustomerId = clearCustomerSignup.data.user.id;
    const customerEdit = await api(base, '/api/admin/customers/' + clearCustomerId, {
      method: 'PATCH', token: adminToken,
      body: { phone: '', companyName: '', status: 'inactive' }
    });
    assert.equal(customerEdit.status, 200);
    assert.equal(customerEdit.data.customer.phone, '');
    assert.equal(customerEdit.data.customer.company, '');
    assert.equal(Object.hasOwn(customerEdit.data.customer, 'password'), false);

    const savedUsersAfterClear = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
    const clearedUser = savedUsersAfterClear.find((user) => user.id === clearCustomerId);
    assert.equal(clearedUser.phone, '');
    assert.equal(clearedUser.companyName, '');

    const booking = await api(base, '/api/bookings', {
      method: 'POST', token: customerToken,
      body: {
        name: 'Saved Customer', phone: '0412345678', service: 'Waste Management',
        notes: 'saved booking notes', preferredDate: new Date().toISOString().slice(0, 10), preferredSlot: '10:00'
      }
    });
    assert.equal(booking.status, 200);

    const enquiry = await api(base, '/api/enquiries', {
      method: 'POST', body: { name: 'Saved Customer', email: 'persist@example.com', message: 'saved enquiry text' }
    });
    assert.equal(enquiry.status, 200);
    const enquiryEdit = await api(base, '/api/admin/enquiries/' + enquiry.data.enquiry.id, {
      method: 'PATCH', token: adminToken,
      body: { status: 'resolved', reply: 'we have replied' }
    });
    assert.equal(enquiryEdit.status, 200);

    const paymentEdit = await api(base, '/api/admin/payments/' + booking.data.payment.id, {
      method: 'PATCH', token: adminToken,
      body: { status: 'completed', amount: 125 }
    });
    assert.equal(paymentEdit.status, 200);

    const pageCreate = await api(base, '/api/admin/pages', {
      method: 'POST', token: adminToken,
      body: { title: 'Persistence test page', slug: 'persistence-test.html' }
    });
    assert.equal(pageCreate.status, 200);
    const pageId = pageCreate.data.page.id;
    const pageEdit = await api(base, '/api/admin/pages/' + pageId, {
      method: 'PATCH', token: adminToken, body: { status: 'draft' }
    });
    assert.equal(pageEdit.status, 200);
    const blockSave = await api(base, '/api/admin/pages/' + pageId + '/blocks', {
      method: 'PUT', token: adminToken,
      body: { blocks: { 'audit-test': 'saved page content', 'reset-test': 'temporary page content' } }
    });
    assert.equal(blockSave.status, 200);
    const blockReset = await api(base, '/api/admin/pages/' + pageId + '/blocks/reset-test', {
      method: 'DELETE', token: adminToken
    });
    assert.equal(blockReset.status, 200);

    const settingsEdit = await api(base, '/api/admin/settings', {
      method: 'PUT', token: adminToken,
      body: { siteName: 'Saved ESA name', timezone: 'Australia/Melbourne' }
    });
    assert.equal(settingsEdit.status, 200);

    const aboutEdit = await api(base, '/about', {
      method: 'PUT', token: adminToken,
      body: { story: 'Saved about vision', paragraph3: 'Saved about description' }
    });
    assert.equal(aboutEdit.status, 200);
    assert.equal(aboutEdit.data.success, true);

    const projectCreate = await api(base, '/api/admin/projects', {
      method: 'POST', token: adminToken,
      body: {
        title: 'Saved case study', category: 'water', location: 'Melbourne',
        summary: 'Saved project summary', status: 'draft'
      }
    });
    assert.equal(projectCreate.status, 200);
    const projectEdit = await api(base, '/api/admin/projects/' + projectCreate.data.project.id, {
      method: 'PATCH', token: adminToken,
      body: { summary: 'Edited project summary', status: 'published' }
    });
    assert.equal(projectEdit.status, 200);
    const deletedProject = await api(base, '/api/admin/projects', {
      method: 'POST', token: adminToken,
      body: { title: 'Temporary case study', status: 'draft' }
    });
    assert.equal(deletedProject.status, 200);
    const projectDelete = await api(base, '/api/admin/projects/' + deletedProject.data.project.id, {
      method: 'DELETE', token: adminToken
    });
    assert.equal(projectDelete.status, 200);

    const createAdmin = await api(base, '/api/auth/create/admin', {
      method: 'POST', token: adminToken,
      body: { fullName: 'Another Admin', email: 'another-admin@example.com', password: 'StrongAdmin9' }
    });
    assert.equal(createAdmin.status, 200);

    const auditBeforeRestart = await api(base, '/api/admin/audit', { token: adminToken });
    assert.equal(auditBeforeRestart.status, 200);
    const actions = auditBeforeRestart.data.entries.map((entry) => entry.action);
    for (const action of [
      'customer updated', 'enquiry updated', 'payment updated', 'page created', 'page updated',
      'page content updated', 'page content reset', 'site settings updated', 'about content updated',
      'case study created', 'case study updated', 'case study deleted', 'administrator created'
    ]) assert.ok(actions.includes(action), 'missing audit entry: ' + action);
    const auditText = JSON.stringify(auditBeforeRestart.data.entries);
    assert.equal(auditText.includes('StrongAdmin9'), false);
    assert.equal(auditText.includes('saved about vision'), false);
    assert.equal(auditText.includes('saved page content'), false);
    assert.equal(auditText.includes('we have replied'), false);

    await stopServer(running.child);
    port = await freePort();
    base = 'http://127.0.0.1:' + port;
    running = startServer(port, dataDir);
    await running.ready;

    const reloadedAudit = await api(base, '/api/admin/audit', { token: adminToken });
    assert.equal(reloadedAudit.status, 200);
    assert.deepEqual(reloadedAudit.data.entries.map((entry) => entry.action), actions);
    assert.equal(reloadedAudit.data.entries[0].action, 'administrator created');
    assert.equal(reloadedAudit.data.entries[0].who, 'admin@esaengineering.com.au');

    const customers = await api(base, '/api/admin/customers', { token: adminToken });
    const savedCustomer = customers.data.customers.find((user) => user.id === customerId);
    assert.equal(savedCustomer.name, 'Saved Customer');
    assert.equal(savedCustomer.phone, '0412345678');
    assert.equal(savedCustomer.company, 'Saved Co');
    assert.equal(savedCustomer.status, 'active');
    const clearedCustomer = customers.data.customers.find((user) => user.id === clearCustomerId);
    assert.equal(clearedCustomer.phone, '');
    assert.equal(clearedCustomer.company, '');
    assert.equal(clearedCustomer.status, 'inactive');

    const savedProfile = await api(base, '/api/portal/me', { token: customerToken });
    assert.equal(savedProfile.data.profile.fullName, 'Saved Customer');
    assert.equal(savedProfile.data.profile.phoneNumber, '0412345678');
    assert.equal(savedProfile.data.profile.companyName, 'Saved Co');
    const authUser = await api(base, '/api/auth/me', { token: customerToken });
    assert.equal(authUser.data.user.firstName, 'Saved');
    assert.equal(authUser.data.user.lastName, 'Customer');
    const savedBookings = await api(base, '/api/admin/bookings', { token: adminToken });
    assert.equal(savedBookings.status, 200);
    assert.equal(savedBookings.data.bookings[0].notes, 'saved booking notes');

    const savedEnquiries = await api(base, '/api/admin/enquiries', { token: adminToken });
    const savedEnquiry = savedEnquiries.data.enquiries.find((row) => row.id === enquiry.data.enquiry.id);
    assert.equal(savedEnquiry.status, 'resolved');
    assert.equal(savedEnquiry.reply, 'we have replied');

    const savedPayments = await api(base, '/api/admin/payments', { token: adminToken });
    const savedPayment = savedPayments.data.payments.find((row) => row.id === booking.data.payment.id);
    assert.equal(savedPayment.amount, 125);
    assert.equal(savedPayment.status, 'completed');

    const savedPage = await api(base, '/api/admin/pages/' + pageId, { token: adminToken });
    assert.equal(savedPage.data.page.status, 'draft');
    assert.equal(savedPage.data.blocks.find((block) => block.key === 'audit-test').value, 'saved page content');
    assert.equal(savedPage.data.blocks.some((block) => block.key === 'reset-test'), false);
    const publicContent = await api(base, '/api/content?slug=persistence-test.html');
    assert.equal(publicContent.data.blocks['audit-test'], 'saved page content');

    const settings = await api(base, '/api/admin/settings', { token: adminToken });
    assert.equal(settings.data.settings.siteName, 'Saved ESA name');
    const about = await api(base, '/about');
    assert.equal(about.data.story, 'Saved about vision');
    assert.equal(about.data.paragraph3, 'Saved about description');

    const projects = await api(base, '/api/admin/projects', { token: adminToken });
    const savedProject = projects.data.projects.find((project) => project.id === projectCreate.data.project.id);
    assert.equal(savedProject.summary, 'Edited project summary');
    assert.equal(savedProject.status, 'published');
    assert.equal(projects.data.projects.some((project) => project.title === 'Temporary case study'), false);

    const secondAdmin = await api(base, '/api/auth/signin', {
      method: 'POST', body: { email: 'another-admin@example.com', password: 'StrongAdmin9' }
    });
    assert.equal(secondAdmin.status, 200);
  } finally {
    await stopServer(running.child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('Node keeps email previews off unless the demo flag is enabled', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esa-node-email-off-test-'));
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const { child, ready } = startServer(port, dataDir, false);

  try {
    await ready;
    const customer = await api(base, '/api/auth/signup', {
      method: 'POST', body: {
        firstName: 'Demo', lastName: 'Customer', email: 'preview@example.com', password: 'DemoPass123'
      }
    });
    assert.equal(customer.status, 201);

    const reset = await api(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: 'preview@example.com' }
    });
    assert.equal(Object.hasOwn(reset.data, 'demoEmailPreview'), false);

    const booking = await api(base, '/api/bookings', {
      method: 'POST', token: customer.data.token,
      body: { name: 'Demo Customer', service: 'Plant Commissioning' }
    });
    assert.equal(Object.hasOwn(booking.data, 'demoEmailPreview'), false);
  } finally {
    await stopServer(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('Node production startup refuses demo secrets, missing admin credentials, and email previews', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esa-node-prod-test-'));
  const serverPath = path.join(__dirname, '..', 'server.js');
  try {
    const noSecret = spawnSync(process.execPath, [serverPath], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, {
        NODE_ENV: 'production', PORT: '0', ESA_DATA_DIR: dataDir,
        JWT_SECRET: '', ADMIN_EMAIL: '', ADMIN_PASSWORD: '', ESA_DEMO_EMAIL_PREVIEW: 'false'
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
        ADMIN_EMAIL: '', ADMIN_PASSWORD: '', ESA_DEMO_EMAIL_PREVIEW: 'false'
      }),
      encoding: 'utf8', timeout: 5000
    });
    assert.notEqual(noAdmin.status, 0);
    assert.match(noAdmin.stderr, /Set ADMIN_EMAIL and ADMIN_PASSWORD/);

    const demoPreviewInProd = spawnSync(process.execPath, [serverPath], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, {
        NODE_ENV: 'production', PORT: '0', ESA_DATA_DIR: dataDir,
        JWT_SECRET: 'another-unique-production-secret-for-tests',
        ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'StrongAdminPass9',
        ESA_DEMO_EMAIL_PREVIEW: 'true'
      }),
      encoding: 'utf8', timeout: 5000
    });
    assert.notEqual(demoPreviewInProd.status, 0);
    assert.match(demoPreviewInProd.stderr, /Demo email previews must not be enabled in production/);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
