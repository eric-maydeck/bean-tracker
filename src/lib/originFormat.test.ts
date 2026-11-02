import { describe, it, expect } from 'vitest';
import { formatOriginField as f } from './originFormat';

const table = (field: string, rows: [string, string][]) =>
  it.each(rows)(`${field}: %s -> %s`, (input, out) => {
    expect(f(field, input)).toBe(out);
    expect(f(field, out)).toBe(out); // idempotent
  });

describe('formatOriginField', () => {
  describe('elevation', () => {
    table('elevation', [
      ['1500masl', '1,500 masl'],
      ['1,500 m', '1,500 masl'],
      ['1500 meters', '1,500 masl'],
      ['1,500 meters above sea level', '1,500 masl'],
      ['1.650-1.950', '1,650-1,950 masl'],
      ['1700 - 1800 masl', '1,700-1,800 masl'],
      ['1700–1800 m', '1,700-1,800 masl'],
      ['Above 2,450 meters', '>2,450 masl'],
      ['2450+ masl', '>2,450 masl'],
      ['+2450 masl', '>2,450 masl'],
      ['2,450 masl+', '>2,450 masl'],
      ['~2,000 m', '~2,000 masl'],
      ['60-250 masl', '60-250 masl']
    ]);
    it('leaves feet and unparsed text unchanged, trimmed', () => {
      expect(f('elevation', ' 5000 ft ')).toBe('5000 ft');
      expect(f('elevation', ' high up ')).toBe('high up');
      expect(f('elevation', '1500')).toBe('1500');
    });
  });

  describe('harvest_time', () => {
    table('harvest_time', [
      ['Sept 2025', 'September 2025'],
      ['Feb 2026', 'February 2026'],
      ['December 2025 – January 2026', 'December 2025-January 2026'],
      ['January–April 2026', 'January-April 2026'],
      ['December 23rd, 2025', 'December 2025'],
      ['December 11, 2025', 'December 2025'],
      ['December 20-24, 2025', 'December 2025'],
      ['08/01/2025 - 16/01/2025', 'January 2025'],
      ['25/26', '2025/26'],
      ['Crop 25/26', '2025/26'],
      ['crop 25/26', '2025/26'],
      ['2024-2025', '2024/25'],
      ['Dec-Jan 2025/26', 'December 2025-January 2026'],
      ['Semester 2025 Q3', 'Q3 2025'],
      ['late 2025', 'Late 2025'],
      ['2025', '2025']
    ]);
  });

  describe('variety', () => {
    table('variety', [
      ['A & B', 'A, B'],
      ['A and B', 'A, B'],
      ['A / B', 'A, B'],
      ['A, B, & C', 'A, B, C'],
      ['Geisha', 'Gesha'],
      ['Geisha 1931', 'Gesha 1931'],
      ['SL-28, SL-34, SL-09, SL09', 'SL28, SL34, SL9, SL9'],
      ['Ruiru-11, Ruiru, Ruiri', 'Ruiru 11, Ruiru 11, Ruiru 11'],
      ['Mundo Nuvo', 'Mundo Novo'],
      ['Aji', 'Ají'],
      ['Bourbon Aji', 'Bourbon Ají'],
      ['JARC 74158', '74158'],
      ['JARC', 'JARC'],
      ['Heirloom', 'Landrace'],
      ['Ethiopian heirloom', 'Landrace'],
      ['Heirloom Ethiopian Varieties', 'Landrace'],
      ['Ethiopian Landrace (heirloom)', 'Landrace'],
      ['Local Bourbon cultivars', 'Bourbon'],
      ['Local Bourbon varietals', 'Bourbon'],
      ['Rosado/Pink Bourbon', 'Pink Bourbon'],
      ['CATURRA, SL28, H1', 'Caturra, SL28, H1'],
      ['Welicho', 'Welicho'],
      ['Landrace, mostly 74158', 'Landrace, mostly 74158'],
      ['Caturra field blend', 'Caturra field blend']
    ]);
  });

  describe('region and other fields', () => {
    table('region', [
      ['A – B', 'A, B'],
      ['A - B', 'A, B'],
      ['A, B', 'A, B']
    ]);
    it('leaves other fields unchanged', () => {
      expect(f('producer', ' A - B ')).toBe(' A - B ');
    });
  });
});
