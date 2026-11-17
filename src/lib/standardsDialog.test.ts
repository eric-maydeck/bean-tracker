import { describe, expect, it } from 'vitest';
import { allLeaveBlank, initialDecisions, inFormOrder, needsDialog, resolve, saveBlock, type Decision, type StdRow } from './standardsDialog';

const row = (field: string, kind: StdRow['kind'], now: string | null = 'a', proposed: string | null = 'b'): StdRow => ({ field, label: field[0].toUpperCase() + field.slice(1), now, proposed, kind });

describe('needsDialog', () => {
  it('is false for only locked rows (or none)', () => {
    expect(needsDialog([])).toBe(false);
    expect(needsDialog([row('cost', 'locked')])).toBe(false);
  });
  it('is true for a forced row or any other kind', () => {
    expect(needsDialog([row('cost', 'locked'), row('origin', 'forced')])).toBe(true);
    expect(needsDialog([row('roaster', 'choice')])).toBe(true);
  });
});

describe('saveBlock', () => {
  it('lists blocked rows first, ahead of undecided ones', () => {
    const rows = [row('roaster', 'choice'), row('cost', 'blocked', 'abc')];
    expect(saveBlock(rows, {})).toBe('Cost "abc" can\'t be converted: Cancel and fix it in the form');
  });
  it('names undecided choice and missing rows', () => {
    const rows = [row('roaster', 'choice'), row('name', 'choice'), row('roast_date', 'missing', '', null)];
    expect(saveBlock(rows, { name: 'approve' })).toBe('Approve or reject: Roaster. Leave blank: Roast_date');
  });
  it('is null when everything is decided', () => {
    const rows = [row('roaster', 'choice'), row('amount_g', 'missing', '', null), row('cost', 'locked')];
    expect(saveBlock(rows, { roaster: 'reject', amount_g: 'leave' })).toBeNull();
  });
});

describe('resolve', () => {
  it('maps each kind to the value to write', () => {
    const rows = [row('a', 'choice', 'n1', 'p1'), row('b', 'choice', 'n2', 'p2'), row('c', 'locked', 'n3', 'p3'), row('d', 'forced', 'n4', 'p4'), row('e', 'unconverted', 'n5', 'p5'), row('f', 'missing', '', null)];
    const d: Record<string, Decision> = { a: 'approve', b: 'reject', f: 'leave' };
    expect(resolve(rows, d)).toEqual({ a: 'p1', b: 'n2', c: 'p3', d: 'p4', e: 'n5', f: '' });
  });
});

describe('inFormOrder', () => {
  it('lists rows as the form lays out its fields, missing rows included', () => {
    const row = (field: string) => ({ field, label: field, now: null, proposed: null, kind: 'missing' as const });
    expect(inFormOrder(['cost', 'variety', 'roast_date', 'roaster', 'elevation'].map(row)).map((r) => r.field)).toEqual(['roaster', 'variety', 'elevation', 'cost', 'roast_date']);
  });
});

describe('all Leave blank rows', () => {
  const row = (field: string, kind: 'missing' | 'choice') => ({ field, label: field, now: null, proposed: kind === 'choice' ? 'x' : null, kind });
  const only = [row('elevation', 'missing'), row('amount_g', 'missing')];
  it('starts every row on Leave blank, so Save is allowed at once', () => {
    expect(allLeaveBlank(only)).toBe(true);
    expect(needsDialog(only)).toBe(true);
    const d = initialDecisions(only);
    expect(d).toEqual({ elevation: 'leave', amount_g: 'leave' });
    expect(saveBlock(only, d)).toBeNull();
    expect(resolve(only, d)).toEqual({ elevation: '', amount_g: '' });
  });
  it('mixed rows start undecided', () => {
    const mixed = [...only, row('variety', 'choice')];
    expect(allLeaveBlank(mixed)).toBe(false);
    expect(initialDecisions(mixed)).toEqual({});
    expect(saveBlock(mixed, {})).toMatch(/Leave blank/);
  });
});
