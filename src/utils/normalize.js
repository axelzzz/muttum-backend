function normalizeWord(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().normalize('NFC');
}

module.exports = { normalizeWord };
