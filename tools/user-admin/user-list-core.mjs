const dayMs = 24 * 60 * 60 * 1000;
const time = value => {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
};
const byName = (a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'de', { sensitivity:'base', numeric:true }) || String(a.id).localeCompare(String(b.id), 'de');

export function sortUsers(users, field = 'lastAppSeen', direction = 'desc') {
  return [...users].sort((a,b) => {
    const factor = direction === 'asc' ? 1 : -1;
    if (field === 'name') return factor * byName(a,b);
    const aTime = time(a[field]), bTime = time(b[field]);
    // Missing dates always follow known dates, in either direction.
    if (!aTime || !bTime) return aTime ? -1 : bTime ? 1 : byName(a,b);
    return factor * (aTime - bTime) || byName(a,b);
  });
}

export function usageSummary(users, now = Date.now()) {
  let active24h = 0, active7d = 0, unknownActivity = 0;
  for (const user of users) {
    const seen = time(user.lastAppSeen);
    if (!seen || seen > now) { unknownActivity++; continue; }
    if (seen >= now - dayMs) active24h++;
    if (seen >= now - 7 * dayMs) active7d++;
  }
  return { total:users.length, active24h, active7d, unknownActivity, asOf:new Date(now).toISOString() };
}
