// Match only unambiguous source names. Never use photo similarity or fuzzy identities.
export const editableFields = ['name', 'major', 'program', 'year', 'pronouns', 'notes', 'photo'];
export const nameKey = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').replace(/[‘’]/g, "'").toLocaleLowerCase('en');
export function importedCard(card) {
  return {...card, importedName: card.name, importedFields: Object.fromEntries(editableFields.map(key => [key, card[key] || '']))};
}
export function planRosterUpdate(previous, incoming, fileName, importReport, now = Date.now()) {
  const group = cards => {
    const map = new Map();
    for (const card of cards) {
      const key = nameKey(card.importedName || card.name);
      map.set(key, [...(map.get(key) || []), card]);
    }
    return map;
  };
  const oldGroups = group(previous.cards), newGroups = group(incoming);
  const retained = [], added = [], ambiguous = [], used = new Set();
  const cards = incoming.map(raw => {
    const fresh = importedCard(raw), key = nameKey(fresh.importedName);
    const candidates = oldGroups.get(key) || [];
    if (!key || candidates.length !== 1 || newGroups.get(key).length !== 1) {
      added.push(fresh.name);
      if (candidates.length || newGroups.get(key).length > 1) ambiguous.push(fresh.name);
      return {...fresh, known: false};
    }
    const old = candidates[0];
    used.add(old.id);
    retained.push(old.name);
    const overrides = {...old.overrides};
    // Preserve user edits from both current and older backups when identifiable.
    for (const field of editableFields) {
      if (old.importedFields && old[field] !== old.importedFields[field]) overrides[field] = true;
    }
    if (old.notes) overrides.notes = true;
    if (!old.importedFields && old.major) overrides.major = true;
    const merged = {...fresh, id: old.id, known: !!old.known, overrides};
    for (const field of editableFields) if (overrides[field]) merged[field] = old[field] || '';
    return merged;
  });
  const removed = previous.cards.filter(card => !used.has(card.id)).map(card => card.name);
  const summary = {retained, added, removed, ambiguous: [...new Set(ambiguous)]};
  const {previousVersion: discarded, ...snapshot} = previous;
  const next = {...previous, cards, fileName, updatedAt: now, importReport, lastUpdate: summary, previousVersion: snapshot};
  return {next, summary};
}
