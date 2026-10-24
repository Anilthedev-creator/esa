const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { ALLOWED_SLOTS, melbourneToday, isRescheduleCutoffPassed } = require('../booking-time');

test('booking slots are every 30 minutes from 9:00 am through 5:00 pm', () => {
  assert.deepEqual(ALLOWED_SLOTS, [
    '',
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00'
  ]);
});

test('booking and portal screens use the same half-hour slots as the API', () => {
  const staticDir = path.join(__dirname, '../src/main/resources/static');
  const bookingPage = fs.readFileSync(path.join(staticDir, 'booking.html'), 'utf8');
  const portalPage = fs.readFileSync(path.join(staticDir, 'portal.html'), 'utf8');
  const chipSlots = Array.from(bookingPage.matchAll(/data-slot="(\d{2}:\d{2})"/g), (match) => match[1]);
  const bookingOptions = Array.from(bookingPage.matchAll(/<option value="(\d{2}:\d{2})"/g), (match) => match[1]);
  const portalOptions = Array.from(portalPage.matchAll(/<option value="(\d{2}:\d{2})"/g), (match) => match[1]);

  assert.deepEqual(chipSlots, ALLOWED_SLOTS.slice(1));
  assert.deepEqual(bookingOptions, ALLOWED_SLOTS.slice(1));
  assert.deepEqual(portalOptions, ALLOWED_SLOTS.slice(1));
});

test('rescheduling closes at 90 minutes before the booking in Melbourne time', () => {
  const now = new Date('2026-06-11T00:00:00Z'); // 10:00 am in Melbourne
  const booking = { bookingDate: '2026-06-11', preferredSlot: '11:30' };
  assert.equal(isRescheduleCutoffPassed(booking, now), true);
  assert.equal(isRescheduleCutoffPassed({ bookingDate: '2026-06-11', preferredSlot: '11:31' }, now), false);
  assert.equal(isRescheduleCutoffPassed({ bookingDate: '2026-06-11', preferredSlot: '09:00' }, now), true);
  assert.equal(isRescheduleCutoffPassed({ bookingDate: '2026-06-12', preferredSlot: '' }, now), false);
});

test('booking date checks use the Melbourne calendar day', () => {
  assert.equal(melbourneToday(new Date('2026-06-10T14:30:00Z')), '2026-06-11');
});
