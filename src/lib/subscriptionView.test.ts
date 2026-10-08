import { describe, it, expect } from 'vitest';
import { effectivePaused, deleteButtonLabel, totalGramsTitle, pauseButtonLabel, pendingLabel, parseSubscriptionUrl, siteOrigin, subscriptionTotals, togglePauseStage, stagedPause, urlWarning } from './subscriptionView';
import type { PendingChange } from './pendingChanges';

describe('parseSubscriptionUrl', () => {
  it('empty or blank is null', () => {
    expect(parseSubscriptionUrl('')).toEqual({ url: null });
    expect(parseSubscriptionUrl('   ')).toEqual({ url: null });
    expect(parseSubscriptionUrl(undefined)).toEqual({ url: null });
  });
  it('keeps a trimmed http(s) URL', () => {
    expect(parseSubscriptionUrl(' https://ceto.coffee/sub ')).toEqual({ url: 'https://ceto.coffee/sub' });
    expect(parseSubscriptionUrl('http://x.com')).toEqual({ url: 'http://x.com' });
  });
  it('rejects non-URLs and other protocols', () => {
    for (const bad of ['ceto.coffee', 'javascript:alert(1)', 'ftp://x.com', 'not a url']) {
      expect(parseSubscriptionUrl(bad)).toHaveProperty('error');
    }
  });
});

describe('siteOrigin', () => {
  it('returns the origin of a URL', () => expect(siteOrigin('https://www.shoebox.coffee/a/b?c=1')).toBe('https://www.shoebox.coffee'));
});

describe('urlWarning', () => {
  it('is null when empty, invalid, or the host matches the roaster', () => {
    expect(urlWarning('', 'Ceto')).toBeNull();
    expect(urlWarning('nope', 'Ceto')).toBeNull();
    expect(urlWarning('https://ceto.coffee/sub', 'Ceto')).toBeNull();
    expect(urlWarning('https://hscoffeeroasters.com/x', 'H&S Coffee Roasters')).toBeNull();
  });
  it('warns when the host does not look like the roaster', () => {
    expect(urlWarning('https://evil.example.com', 'Ceto')).toBe("⚠ doesn't look like Ceto's site");
  });
  it('says nothing without a roaster name', () => expect(urlWarning('https://evil.example.com', ' ')).toBeNull());
});

describe('subscriptionTotals', () => {
  it('sums price and grams, skipping paused subs', () => {
    expect(
      subscriptionTotals([
        { price: 10, total_grams: 500, paused: 0 },
        { price: 5.5, total_grams: null, paused: 0 },
        { price: 100, total_grams: 1000, paused: 1 }
      ])
    ).toEqual({ price: 15.5, grams: 500 });
  });
  it('is null when nothing (active) has a value', () => {
    expect(subscriptionTotals([])).toEqual({ price: null, grams: null });
    expect(subscriptionTotals([{ price: 9, total_grams: 9, paused: 1 }])).toEqual({ price: null, grams: null });
  });
});

describe('togglePauseStage / stagedPause', () => {
  it('stages a pause, and a second click un-stages it', () => {
    const pending = new Map<number, PendingChange>();
    togglePauseStage(pending, 1, 0);
    expect(pending.get(1)).toEqual({ fields: { paused: '1' } });
    expect(stagedPause(pending.get(1))).toBe('pause');
    togglePauseStage(pending, 1, 0);
    expect(pending.has(1)).toBe(false);
  });
  it('stages a resume for a paused sub', () => {
    const pending = new Map<number, PendingChange>();
    togglePauseStage(pending, 2, 1);
    expect(stagedPause(pending.get(2))).toBe('resume');
  });
  it('keeps other staged fields', () => {
    const pending = new Map<number, PendingChange>([[1, { fields: { roaster_service: 'X' } }]]);
    togglePauseStage(pending, 1, 0);
    expect(pending.get(1)).toEqual({ fields: { roaster_service: 'X', paused: '1' } });
    togglePauseStage(pending, 1, 0);
    expect(pending.get(1)).toEqual({ fields: { roaster_service: 'X' } });
  });
  it('stagedPause is null with nothing staged', () => {
    expect(stagedPause(undefined)).toBeNull();
    expect(stagedPause({ fields: { roaster_service: 'X' } })).toBeNull();
  });
});

describe('pendingLabel', () => {
  it('is null with nothing staged', () => expect(pendingLabel(undefined)).toBeNull());
  it('names a delete, a pause/resume, an edit, or both', () => {
    expect(pendingLabel({ statusAction: 'delete' })).toBe('Pending: delete');
    expect(pendingLabel({ fields: { paused: '1' } })).toBe('Pending: pause');
    expect(pendingLabel({ fields: { paused: '0' } })).toBe('Pending: resume');
    expect(pendingLabel({ fields: { roaster_service: 'X' } })).toBe('Pending: edited');
    expect(pendingLabel({ fields: { roaster_service: 'X', paused: '1' } })).toBe('Pending: pause, edited');
  });
});

describe('pauseButtonLabel', () => {
  it('names what a click would do now, from the effective state', () => {
    expect(pauseButtonLabel(0, undefined)).toBe('Pause');
    expect(pauseButtonLabel(0, { fields: { paused: '1' } })).toBe('Resume');
    expect(pauseButtonLabel(1, undefined)).toBe('Resume');
    expect(pauseButtonLabel(1, { fields: { paused: '0' } })).toBe('Pause');
  });
});

describe('deleteButtonLabel', () => {
  it('reads Restore while a delete is staged', () => {
    expect(deleteButtonLabel(undefined)).toBe('Delete');
    expect(deleteButtonLabel({ fields: { paused: '1' } })).toBe('Delete');
    expect(deleteButtonLabel({ statusAction: 'delete' })).toBe('Restore');
  });
});

describe('totalGramsTitle', () => {
  it('multiplies bags by grams per bag', () => {
    expect(totalGramsTitle('2', '150')).toBe('Total: 300 g');
    expect(totalGramsTitle('', '150')).toBe('Total: —');
    expect(totalGramsTitle('2', 'x')).toBe('Total: —');
  });
});

describe('effectivePaused', () => {
  it('is the saved state unless a pause/resume is staged', () => {
    expect(effectivePaused(0, undefined)).toBe(false);
    expect(effectivePaused(1, undefined)).toBe(true);
    expect(effectivePaused(0, { fields: { paused: '1' } })).toBe(true);
    expect(effectivePaused(1, { fields: { paused: '0', price: '3' } })).toBe(false);
    expect(effectivePaused(1, { fields: { price: '3' } })).toBe(true);
  });
});
