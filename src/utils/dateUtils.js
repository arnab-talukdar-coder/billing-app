/**
 * Safely parses various date formats into a millisecond timestamp for sorting.
 * Handles YYYY-MM-DD, DD/MM/YYYY, ISO strings, Timestamps, numbers, etc.
 */
export const parseDateToTime = (dateVal) => {
  if (!dateVal) return 0;
  if (typeof dateVal === 'number') return dateVal;
  
  // Handle Firestore timestamp objects ({ seconds: ... } or .toDate())
  if (typeof dateVal === 'object') {
    if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
    if (typeof dateVal.seconds === 'number') return dateVal.seconds * 1000;
  }
  
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return 0;
    
    // Handle DD/MM/YYYY or DD-MM-YYYY formats (e.g. 24/05/2026)
    if (trimmed.includes('/') || (trimmed.includes('-') && trimmed.split('-')[0].length === 2)) {
      const separator = trimmed.includes('/') ? '/' : '-';
      const parts = trimmed.split(separator);
      if (parts.length === 3) {
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        const p3 = parseInt(parts[2], 10);
        if (p3 > 1000) { // Format: DD/MM/YYYY
          const d = new Date(p3, p2 - 1, p1);
          if (!isNaN(d.getTime())) return d.getTime();
        } else if (p1 > 1000) { // Format: YYYY/MM/DD
          const d = new Date(p1, p2 - 1, p3);
          if (!isNaN(d.getTime())) return d.getTime();
        }
      }
    }
    
    // Handle standard YYYY-MM-DD or ISO strings
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return parsed;
  }
  
  return 0;
};

/**
 * Gets the primary effective date for a ledger entry.
 * For Bill entries, prefers invoiceDate over entry date if available.
 */
export const getEffectiveDate = (entry) => {
  if (!entry) return '';
  if (entry.method === 'Bill') {
    return entry.invoiceDate || entry.date || '';
  }
  return entry.date || '';
};
