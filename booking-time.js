const BUSINESS_TIME_ZONE = 'Australia/Melbourne';
const RESCHEDULE_CUTOFF_MS = 90 * 60 * 1000;
const ALLOWED_SLOTS = [
  '',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00'
];

function melbourneParts(date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date || new Date());
  const values = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  });
  return values;
}

function melbourneToday(date) {
  const parts = melbourneParts(date);
  return String(parts.year).padStart(4, '0') + '-'
    + String(parts.month).padStart(2, '0') + '-'
    + String(parts.day).padStart(2, '0');
}

function melbourneWallTime(date) {
  const parts = melbourneParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function bookingWallTime(booking) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(booking.bookingDate || '').slice(0, 10));
  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const checkDate = new Date(Date.UTC(year, month - 1, day));
  if (checkDate.toISOString().slice(0, 10) !== dateMatch[0]) return null;

  const slotMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(booking.preferredSlot || '09:00'));
  const hour = slotMatch ? Number(slotMatch[1]) : 9;
  const minute = slotMatch ? Number(slotMatch[2]) : 0;
  return Date.UTC(year, month - 1, day, hour, minute);
}

function isRescheduleCutoffPassed(booking, now) {
  const start = bookingWallTime(booking);
  if (start === null) return false;
  return start - melbourneWallTime(now || new Date()) <= RESCHEDULE_CUTOFF_MS;
}

module.exports = { ALLOWED_SLOTS, melbourneToday, isRescheduleCutoffPassed };
