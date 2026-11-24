export type SupportedCountry = 'EG' | 'JO';

// We validate locally because SMS verification was deliberately left out of
// the cost-free first release.  The database accepts only this normalized
// E.164 value, never the raw text that the student typed.
export function normalizeStudentPhone(country: SupportedCountry, rawPhone: string): string | null {
  let digits = rawPhone.replace(/\D/g, '');
  if (country === 'EG') {
    if (digits.startsWith('0020')) digits = `0${digits.slice(4)}`;
    else if (digits.startsWith('20')) digits = `0${digits.slice(2)}`;
    return /^01[0125]\d{8}$/.test(digits) ? `+20${digits.slice(1)}` : null;
  }
  if (digits.startsWith('00962')) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith('962')) digits = `0${digits.slice(3)}`;
  return /^07[789]\d{7}$/.test(digits) ? `+962${digits.slice(1)}` : null;
}
