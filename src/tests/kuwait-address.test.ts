import { describe, it, expect } from 'vitest';
import { buildKuwaitAddressText, getMissingAddressFields, isValidKuwaitPhone } from '../utils/kuwaitAddress';

describe('kuwait address helpers', () => {
  it('validates Kuwaiti phone numbers', () => {
    for (const ok of ['92225308', '55512345', '66612345', '41234567', '22223333', '+96592225308', '0096592225308']) {
      expect(isValidKuwaitPhone(ok)).toBe(true);
    }
    for (const bad of ['', '1234567', '12345678', '32345678', '72345678', '8234567', '922253081']) {
      expect(isValidKuwaitPhone(bad)).toBe(false);
    }
  });

  it('builds a one-line address from structured parts', () => {
    expect(
      buildKuwaitAddressText({ region: 'السالمية', block: '5', street: '12', avenue: '3', building: '20', floor: '2', apartment: '4' }),
    ).toBe('السالمية، قطعة 5، شارع 12، جادة 3، منزل 20، الدور 2، شقة 4');
    expect(buildKuwaitAddressText({ region: 'حولي', block: '1', street: 'تونس', avenue: '', building: '7' })).toBe(
      'حولي، قطعة 1، شارع تونس، منزل 7',
    );
    expect(buildKuwaitAddressText(null)).toBe('');
  });

  it('lists missing required fields (avenue/floor/apartment optional)', () => {
    expect(getMissingAddressFields({ region: 'حولي', block: '1', street: ' ', building: '' }).map((f) => f.key)).toEqual([
      'street',
      'building',
    ]);
    expect(getMissingAddressFields({ region: 'a', block: '1', street: '2', building: '3' })).toEqual([]);
  });
});

import { formatAdminWhatsAppAddress, getAddressMapUrl } from '../utils/kuwaitAddress';

describe('admin address formatting', () => {
  it('keeps the original WhatsApp layout and adds optional parts', () => {
    expect(formatAdminWhatsAppAddress({ region: 'حولي', block: '1', street: '2', building: '3' })).toBe(
      '\n\n✉️ العنوان:\nالمنطقة: حولي\nقطعة: 1\nشارع: 2\nمنزل: 3',
    );
    expect(
      formatAdminWhatsAppAddress({ region: 'حولي', block: '1', street: '2', avenue: '4', building: '3', location: { lat: 29.3, lng: 47.9 } }),
    ).toContain('جادة: 4\nمنزل: 3\nالموقع: https://www.google.com/maps?q=29.3,47.9');
  });
  it('map url only with a pin', () => {
    expect(getAddressMapUrl({ region: 'x' })).toBe('');
    expect(getAddressMapUrl({ lat: 29.1, lng: 48 })).toBe('https://www.google.com/maps?q=29.1,48');
  });
});
