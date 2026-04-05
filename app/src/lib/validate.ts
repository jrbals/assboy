const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_PATTERN = /^\.[a-z]{2,10}$/;
const MAX_DESC_LENGTH = 500;

export function sanitizeDomainName(name: string): string | null {
  const clean = name.trim().toLowerCase().replace(/\s+/g, '');
  if (!clean || clean.length > 63 || !DOMAIN_PATTERN.test(clean)) return null;
  return clean;
}

export function sanitizeTld(tld: string): string | null {
  const clean = tld.trim().toLowerCase();
  if (!TLD_PATTERN.test(clean)) return null;
  return clean;
}

export function sanitizeDescription(desc: string): string {
  return (desc || '').substring(0, MAX_DESC_LENGTH).replace(/<[^>]*>/g, '');
}

export function sanitizePrice(price: number): number {
  if (typeof price !== 'number' || isNaN(price)) return 0;
  return Math.max(0, Math.min(price, 10000000)); // max $100k
}
