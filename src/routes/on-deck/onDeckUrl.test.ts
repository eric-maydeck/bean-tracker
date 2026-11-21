import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES } from '#lib/pick/rules.ts';
import { decodeRulesLink, encodeRulesLink, MAX_RULES_CODE, onDeckParams, parseDefaultRules, parseRulesCode, parseGame, parseOnDeckView, parseProfile, parseCoffees, parseRoll, parseCoffeeParam } from './onDeckUrl';

const p = (q: string) => new URLSearchParams(q);

describe('on-deck view param', () => {
  it('only the non-default view is explicit', () => {
    expect(parseOnDeckView(p('view=next'))).toBe('next');
    expect(parseOnDeckView(p('view=NEXT'))).toBe('next');
    expect(parseOnDeckView(p('view=open'))).toBeUndefined(); // the default never rides the URL
    expect(parseOnDeckView(p('view=bogus'))).toBeUndefined();
    expect(parseOnDeckView(p(''))).toBeUndefined();
  });
  it('pick view and game', () => {
    expect(parseOnDeckView(p('view=pick'))).toBe('pick');
    expect(parseOnDeckView(p('view=PICK'))).toBe('pick');
    expect(parseGame(p('game=d20'))).toBe('d20');
    expect(parseGame(p('game=wheel'))).toBe('wheel');
    expect(parseGame(p('game=Wheel'))).toBe('wheel');
    expect(parseGame(p('view=pick'))).toBeUndefined(); // bare: the visitor's last game today, else the wheel
    expect(parseGame(p('game=bogus'))).toBeUndefined();
    expect(parseGame(p(''))).toBeUndefined();
    expect(onDeckParams({ view: 'pick', game: 'd20' }).toString()).toBe('view=pick&game=d20');
    expect(onDeckParams({ view: 'pick', game: 'wheel' }).toString()).toBe('view=pick&game=wheel');
    expect(onDeckParams({ view: 'pick' }).toString()).toBe('view=pick');
    expect(onDeckParams({ view: 'next', game: 'd20' }).toString()).toBe('view=next');
    expect(onDeckParams({ game: 'd20' }).toString()).toBe('');
  });
  it('round trip, kept alongside show', () => {
    expect(onDeckParams({ show: 'decaf', view: 'next' }).toString()).toBe('show=decaf&view=next');
    expect(onDeckParams({ view: 'next' }).toString()).toBe('view=next');
    expect(onDeckParams({ show: 'all' }).toString()).toBe('show=all');
    expect(onDeckParams({}).toString()).toBe('');
  });
  it('profile: trimmed, case kept, empty or too long ignored, only written with the pick view', () => {
    expect(parseProfile(p('profile=Morning'))).toBe('Morning');
    expect(parseProfile(p('profile=%20Morning%20'))).toBe('Morning');
    expect(parseProfile(p('profile=Dark+Roast+%26+Co'))).toBe('Dark Roast & Co');
    expect(parseProfile(p('profile='))).toBeUndefined();
    expect(parseProfile(p('profile=%20%20'))).toBeUndefined();
    expect(parseProfile(p('profile=' + 'a'.repeat(61)))).toBeUndefined();
    expect(parseProfile(p('profile=' + 'a'.repeat(60)))).toBe('a'.repeat(60));
    expect(parseProfile(p(''))).toBeUndefined();
    expect(onDeckParams({ view: 'pick', game: 'd20', profile: 'Dark & Co' }).toString()).toBe('view=pick&game=d20&profile=Dark+%26+Co');
    expect(onDeckParams({ view: 'pick', profile: 'A' }).toString()).toBe('view=pick&profile=A');
    expect(onDeckParams({ view: 'next', profile: 'A' }).toString()).toBe('view=next');
    expect(onDeckParams({ profile: 'A' }).toString()).toBe('');
  });
  it('rules=default: only that value, only with the pick view, a profile wins', () => {
    expect(parseDefaultRules(p('rules=default'))).toBe(true);
    expect(parseDefaultRules(p('rules=DEFAULT'))).toBe(true);
    expect(parseDefaultRules(p('rules=other'))).toBe(false);
    expect(parseDefaultRules(p(''))).toBe(false);
    expect(onDeckParams({ view: 'pick', game: 'd20', defaultRules: true }).toString()).toBe('view=pick&game=d20&rules=default');
    expect(onDeckParams({ view: 'pick', profile: 'A', defaultRules: true }).toString()).toBe('view=pick&profile=A');
    expect(onDeckParams({ view: 'next', defaultRules: true }).toString()).toBe('view=next');
  });
  it('rules code: round trip keeps name (unicode too) and rules, stays small, and is not "default"', () => {
    const rules = { ...DEFAULT_RULES, sort: 'name' as const, critFailOn: false, excluded: [3, 9], critSuccess: [4], critSuccessMode: 'specific' as const };
    const code = encodeRulesLink('Café ☕ rules', rules)!;
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(400);
    expect(decodeRulesLink(code)).toEqual({ name: 'Café ☕ rules', rules });
    expect(decodeRulesLink(encodeRulesLink('A', DEFAULT_RULES)!)).toEqual({ name: 'A', rules: DEFAULT_RULES });
    expect(parseRulesCode(p(`rules=${code}`))).toBe(code);
    expect(parseRulesCode(p('rules=default'))).toBeUndefined();
    expect(parseRulesCode(p('rules=DEFAULT'))).toBeUndefined();
    expect(parseRulesCode(p('rules='))).toBeUndefined();
    expect(parseRulesCode(p('rules=a+b'))).toBeUndefined();
    expect(parseRulesCode(p(''))).toBeUndefined();
    expect(onDeckParams({ view: 'pick', game: 'd20', rulesCode: code }).toString()).toBe(`view=pick&game=d20&rules=${code}`);
    expect(onDeckParams({ view: 'pick', rulesCode: code, defaultRules: true }).toString()).toBe(`view=pick&rules=${code}`);
    expect(onDeckParams({ view: 'pick', profile: 'A', rulesCode: code }).toString()).toBe('view=pick&profile=A');
    expect(onDeckParams({ view: 'next', rulesCode: code }).toString()).toBe('view=next');
  });
  it('rules code: one that would be over the cap is not made', () => {
    const many = { ...DEFAULT_RULES, excluded: Array.from({ length: 600 }, (_, i) => 1000 + i) };
    expect(encodeRulesLink('A', many)).toBeNull();
    const fits = { ...DEFAULT_RULES, excluded: Array.from({ length: 20 }, (_, i) => 1000 + i) };
    expect(encodeRulesLink('A', fits)!.length).toBeLessThanOrEqual(MAX_RULES_CODE);
  });
  it('rules code: untrusted input is refused or repaired, never thrown', () => {
    const b64 = (s: string) => btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expect(decodeRulesLink('default')).toBeNull(); // valid base64 characters, not JSON
    expect(decodeRulesLink('!!!')).toBeNull(); // bad characters
    expect(decodeRulesLink('A')).toBeNull(); // impossible base64 length
    expect(decodeRulesLink(b64('not json'))).toBeNull();
    expect(decodeRulesLink(b64('[1]'))).toBeNull();
    expect(decodeRulesLink(b64('{"n":"A"}'))).toBeNull(); // no rules
    expect(decodeRulesLink(b64('{"r":{}}'))).toBeNull(); // no name
    expect(decodeRulesLink(b64('{"n":"  ","r":{}}'))).toBeNull();
    expect(decodeRulesLink(b64('{"n":"A","r":[]}'))).toBeNull();
    expect(decodeRulesLink(b64('{"n":"' + 'x'.repeat(41) + '","r":{}}'))).toBeNull();
    expect(decodeRulesLink('A'.repeat(MAX_RULES_CODE + 1))).toBeNull(); // oversize
    expect(parseRulesCode(p('rules=' + 'A'.repeat(MAX_RULES_CODE + 1)))).toBeUndefined();
    // invalid rule values fall back field by field to the defaults
    expect(decodeRulesLink(b64('{"n":"A","r":{"sort":"bogus","includeDecaf":true,"categories":7}}'))).toEqual({ name: 'A', rules: { ...DEFAULT_RULES, includeDecaf: true } });
    expect(decodeRulesLink(b64(String.fromCharCode(0xff, 0xfe)))).toBeNull(); // not UTF-8
  });
});

describe('coffees param', () => {
  it('only custom is explicit, case-insensitive', () => {
    expect(parseCoffees(p('coffees=custom'))).toBe('custom');
    expect(parseCoffees(p('coffees=CUSTOM'))).toBe('custom');
    expect(parseCoffees(p('coffees=site'))).toBeUndefined();
    expect(parseCoffees(p(''))).toBeUndefined();
  });
  it('written only with the pick view; a share path (no coffees passed) never has it', () => {
    expect(onDeckParams({ view: 'pick', game: 'd20', coffees: 'custom' }).toString()).toBe('view=pick&game=d20&coffees=custom');
    expect(onDeckParams({ view: 'next', coffees: 'custom' }).toString()).toBe('view=next');
    expect(onDeckParams({ coffees: 'custom' }).toString()).toBe('');
    expect(onDeckParams({ view: 'pick', defaultRules: true }).toString()).toBe('view=pick&rules=default');
  });
});

describe('shared result params', () => {
  it('roll is an integer 1-20', () => {
    expect(parseRoll(p('roll=7'))).toBe(7);
    expect(parseRoll(p('roll=20'))).toBe(20);
    for (const bad of ['0', '21', '-3', '2.5', 'abc', '', '1e1']) expect(parseRoll(p(`roll=${bad}`))).toBeUndefined();
    expect(parseRoll(p(''))).toBeUndefined();
  });
  it('c is a positive integer', () => {
    expect(parseCoffeeParam(p('c=42'))).toBe(42);
    for (const bad of ['0', '-1', '1.5', 'x', '', '99999999999999999999']) expect(parseCoffeeParam(p(`c=${bad}`))).toBeUndefined();
  });
  it('rides along only with view=pick; c only with roll', () => {
    expect(onDeckParams({ view: 'pick', game: 'd20', roll: 20, c: 5 }).toString()).toBe('view=pick&game=d20&roll=20&c=5');
    expect(onDeckParams({ view: 'pick', game: 'wheel', coffees: 'custom', roll: 3 }).toString()).toBe('view=pick&game=wheel&coffees=custom&roll=3');
    expect(onDeckParams({ view: 'pick', c: 5 }).toString()).toBe('view=pick');
    expect(onDeckParams({ view: 'next', roll: 4, c: 5 }).toString()).toBe('view=next');
    expect(onDeckParams({ roll: 4 }).toString()).toBe('');
  });
});
