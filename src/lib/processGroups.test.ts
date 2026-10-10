import { describe, it, expect } from 'vitest';
import { processGroup, PROCESS_GROUPS } from './processGroups';

// Every prod processing label on 2026-10-09 → its group.
const PROD: [string, string][] = [
  ['Anaerobic Natural', 'Anaerobic Natural'],
  ['Anaerobic Washed', 'Anaerobic Washed'],
  ['Anoxic Natural', 'Anaerobic Natural'],
  ['Anoxic Washed', 'Anaerobic Washed'],
  ['Bioreactor + Mosto Anoxic Natural', 'Anaerobic Natural'],
  ['Black Honey', 'Honey'],
  ['Carbonic Macerated Natural, Washed Finish Hybrid', 'Anaerobic Natural'],
  ['Cherry Anaerobic & Mucilage Washed', 'Anaerobic Washed'],
  ['Decaffeinated Thermal Shock Washed', 'Co-ferment / Infused'],
  ['Double Anaerobic Thermal Shock Washed', 'Co-ferment / Infused'],
  ['Double Ferment Washed', 'Extended Ferment Washed'],
  ['EA Decaf Washed', 'Washed'],
  ['Extended Ferment Washed', 'Extended Ferment Washed'],
  ['Extended Fermentation, Three-Stage Slow-Drying Natural', 'Natural'],
  ['Fermented Washed', 'Extended Ferment Washed'],
  ['Fermented in GrainPro Bags & Washed', 'Extended Ferment Washed'],
  ['Fragrancia Washed', 'Washed'],
  ['Fully Washed', 'Washed'],
  ['Honey', 'Honey'],
  ['Lactobacillus Inoculated', 'Inoculated'],
  ['Mechanically Demucilaged', 'Washed'],
  ['N/A', 'Other / Unknown'],
  ['Natural', 'Natural'],
  ['Natural EA Decaf', 'Natural'],
  ['Natural, EA Decaf', 'Natural'],
  ['Oma Honey', 'Honey'],
  ['Pink Champagne Natural', 'Co-ferment / Infused'],
  ['Pink Champagne Washed', 'Co-ferment / Infused'],
  ['Red Fruits Co-Ferment Decaf', 'Co-ferment / Infused'],
  ['Red Honey', 'Honey'],
  ['Red fruits co-ferment', 'Co-ferment / Infused'],
  ['Slow Dry Washed', 'Washed'],
  ['Sugarcane (EA) Decaffeinated, Thermal Shock Washed Anaerobic', 'Co-ferment / Infused'],
  ['Surma Washed', 'Washed'],
  ['Tartaric Acid Natural Cold Room', 'Co-ferment / Infused'],
  ['Tartaric Acid Washed Cold Room', 'Co-ferment / Infused'],
  ['Thermal Shock', 'Co-ferment / Infused'],
  ['Triple Ferment Washed', 'Extended Ferment Washed'],
  ['Tyoxidator Washed', 'Anaerobic Washed'],
  ['Tyoxy Washed', 'Anaerobic Washed'],
  ['Washed', 'Washed'],
  ['Washed (72 Hours Wet Fermentation + 21 Days Drying On Raised Beds)', 'Washed'],
  ['Washed Decaf', 'Washed'],
  ['Wild Fermentation', 'Inoculated'],
  ['Yeast Inoculated', 'Inoculated'],
  ['Yellow Honey', 'Honey']
];

describe('processGroup', () => {
  it('covers all 46 prod labels', () => expect(PROD).toHaveLength(46));
  it.each(PROD)('%s → %s', (label, group) => expect(processGroup(label)).toBe(group));
  it('is case-insensitive', () => expect(processGroup('ANOXIC NATURAL')).toBe('Anaerobic Natural'));
  it('empty or missing → Other / Unknown', () => {
    expect(processGroup(null)).toBe('Other / Unknown');
    expect(processGroup('')).toBe('Other / Unknown');
  });
  it('lists every group once, Other last', () => {
    expect(new Set(PROCESS_GROUPS).size).toBe(9);
    expect(PROCESS_GROUPS.at(-1)).toBe('Other / Unknown');
  });
});
