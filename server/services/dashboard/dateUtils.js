export const isValidTimezone = (timezone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
};

export const toDateKey = (value, timezone = "UTC") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const addUtcDays = (dateKey, amount) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

export const calculateStreak = (dateKeys, todayKey) => {
  const uniqueDates = [...new Set(dateKeys)].sort().reverse();
  if (!uniqueDates.length) return { current: 0, longest: 0, activeToday: false };
  const dateSet = new Set(uniqueDates);
  let longest = 0;
  let run = 0;
  let previous = null;
  [...uniqueDates].reverse().forEach((dateKey) => {
    run = previous && addUtcDays(previous, 1) === dateKey ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = dateKey;
  });
  const activeToday = dateSet.has(todayKey);
  const start = activeToday ? todayKey : addUtcDays(todayKey, -1);
  let current = 0;
  for (let cursor = start; dateSet.has(cursor); cursor = addUtcDays(cursor, -1)) current += 1;
  return { current, longest, activeToday };
};
