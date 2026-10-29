// Ignore presentation differences, but never accept fuzzy spelling or a first name alone.
export function normalizeName(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.length > 1 ? normalizeName(`${parts[0]} ${parts.at(-1)}`) : '';
}
export function checkTypedName(answer, person, people) {
  const submitted = normalizeName(answer);
  if (!submitted) return false;
  if (submitted === normalizeName(person.name)) return true;
  const short = shortName(person.name);
  return !!short && submitted === short && people.filter(p => shortName(p.name) === short).length === 1;
}
