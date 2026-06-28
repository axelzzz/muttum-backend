export function normalizeWord(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().normalize('NFC');
}
