import { describe, it, expect } from 'vitest';
import { stageFieldChange, stageStatusAction, clearPending, hasPending, type PendingChange } from './pendingChanges';

describe('stageFieldChange', () => {
  it('adds a field change for a fresh id', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 1, { roaster: 'Sey' });
    expect(pending.get(1)).toEqual({ fields: { roaster: 'Sey' } });
  });

  it('preserves an existing pending status action when staging fields for the same id', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 1, 'archive');
    stageFieldChange(pending, 1, { roaster: 'Sey' });
    expect(pending.get(1)).toEqual({ statusAction: 'archive', fields: { roaster: 'Sey' } });
  });

  it('replaces a previous field change for the same id rather than merging keys', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 1, { roaster: 'Sey' });
    stageFieldChange(pending, 1, { roaster: 'Scenery' });
    expect(pending.get(1)).toEqual({ fields: { roaster: 'Scenery' } });
  });
});

describe('stageStatusAction', () => {
  it('adds a status action for a fresh id', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 2, 'open');
    expect(pending.get(2)).toEqual({ statusAction: 'open' });
  });

  it('preserves an existing pending field change when staging a status action for the same id', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 2, { roaster: 'Sey' });
    stageStatusAction(pending, 2, 'archive');
    expect(pending.get(2)).toEqual({ fields: { roaster: 'Sey' }, statusAction: 'archive' });
  });

  it('replaces a previous status action for the same id rather than accumulating', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 2, 'open');
    stageStatusAction(pending, 2, 'archive');
    expect(pending.get(2)).toEqual({ statusAction: 'archive' });
  });

  it('un-stages when the same status action is staged twice, removing the entry if no fields remain', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 2, 'archive');
    stageStatusAction(pending, 2, 'archive');
    expect(pending.has(2)).toBe(false);
  });

  it('un-stages just the status action when the same action is staged twice with fields also present, keeping the fields', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 2, { roaster: 'Sey' });
    stageStatusAction(pending, 2, 'archive');
    stageStatusAction(pending, 2, 'archive');
    expect(pending.get(2)).toEqual({ fields: { roaster: 'Sey' } });
  });

  it('staging delete clears any existing staged fields for that entry', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 2, { roaster: 'Sey' });
    stageStatusAction(pending, 2, 'delete');
    expect(pending.get(2)).toEqual({ statusAction: 'delete' });
  });

  it('staging a different (non-repeat) status action does not clear existing staged fields', () => {
    const pending = new Map<number, PendingChange>();
    stageFieldChange(pending, 2, { roaster: 'Sey' });
    stageStatusAction(pending, 2, 'open');
    stageStatusAction(pending, 2, 'archive');
    expect(pending.get(2)).toEqual({ fields: { roaster: 'Sey' }, statusAction: 'archive' });
  });
});

describe('clearPending', () => {
  it('removes the entry for the given id entirely', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 3, 'delete');
    clearPending(pending, 3);
    expect(pending.has(3)).toBe(false);
  });

  it('is a no-op for an id with no pending entry', () => {
    const pending = new Map<number, PendingChange>();
    expect(() => clearPending(pending, 999)).not.toThrow();
    expect(pending.size).toBe(0);
  });
});

describe('hasPending', () => {
  it('is false for an empty map', () => {
    expect(hasPending(new Map())).toBe(false);
  });

  it('is true once any entry exists', () => {
    const pending = new Map<number, PendingChange>();
    stageStatusAction(pending, 1, 'open');
    expect(hasPending(pending)).toBe(true);
  });
});
