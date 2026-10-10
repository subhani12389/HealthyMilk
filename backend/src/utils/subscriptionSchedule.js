const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function normalizeScheduleDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isSubscriptionScheduledForDate(subscription, value) {
  const date = normalizeScheduleDate(value);
  const startDate = normalizeScheduleDate(subscription.startDate);
  const endDate = normalizeScheduleDate(subscription.endDate);
  if (!date || !startDate || !endDate || date < startDate || date > endDate) return false;

  const schedule = String(subscription.schedule || 'Daily').trim();
  if (/^daily$/i.test(schedule)) return true;

  const weekday = WEEKDAYS[date.getUTCDay()];
  if (/^weekly$/i.test(schedule)) {
    return WEEKDAYS[startDate.getUTCDay()] === weekday;
  }
  return schedule.toLowerCase() === weekday.toLowerCase();
}

function nextScheduledDate(subscription, after) {
  const start = normalizeScheduleDate(after);
  if (!start) return null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(start.getTime() + offset * DAY_MS);
    if (isSubscriptionScheduledForDate(subscription, candidate)) return candidate;
  }
  return null;
}

module.exports = {
  normalizeScheduleDate,
  isSubscriptionScheduledForDate,
  nextScheduledDate
};
