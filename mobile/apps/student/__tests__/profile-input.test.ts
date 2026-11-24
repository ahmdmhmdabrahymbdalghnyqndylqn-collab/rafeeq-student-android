import { normalizeStudentPhone } from '../lib/profile-input';

describe('student phone normalization', () => {
  it('accepts valid Egyptian local and international forms', () => {
    expect(normalizeStudentPhone('EG', '01012345678')).toBe('+201012345678');
    expect(normalizeStudentPhone('EG', '+20 10 1234 5678')).toBe('+201012345678');
  });

  it('accepts valid Jordanian local and international forms', () => {
    expect(normalizeStudentPhone('JO', '0791234567')).toBe('+962791234567');
    expect(normalizeStudentPhone('JO', '+962 79 123 4567')).toBe('+962791234567');
  });

  it('rejects a number from the wrong country or invalid prefix', () => {
    expect(normalizeStudentPhone('EG', '0791234567')).toBeNull();
    expect(normalizeStudentPhone('JO', '0711234567')).toBeNull();
  });
});
