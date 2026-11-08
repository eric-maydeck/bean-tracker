import { describe, expect, it } from 'vitest';
import { formatItems, parseId, toItems, trimIssueView, type Item } from './backlog';

const it_ = (o: Partial<Item> & { id: string }): Item => ({ title: 't' + o.id, status: 'Next', ...o });

describe('formatItems', () => {
  it('next sorts in-progress first then want', () => {
    const out = formatItems([
      it_({ id: '1', status: 'Blocked', want: 5 }),
      it_({ id: '2', status: 'Next', want: 2 }),
      it_({ id: '3', status: 'Next', want: 4 }),
      it_({ id: '4', status: 'In progress', want: 1 }),
      it_({ id: '5', status: 'Backlog', want: 5 }),
    ], 'next').split('\n');
    expect(out.map((l) => l.match(/#(\d)/)![1])).toEqual(['4', '3', '2', '1']);
  });
  it('breaks want ties by smaller size first', () => {
    const out = formatItems([it_({ id: '1', want: 3, size: 'L' }), it_({ id: '2', want: 3, size: 'S' })], 'next');
    expect(out.indexOf('#2')).toBeLessThan(out.indexOf('#1'));
  });
  it('all excludes done', () => {
    const out = formatItems([it_({ id: '1', status: 'Backlog' }), it_({ id: '2', status: 'Done' })], 'all');
    expect(out).toContain('#1');
    expect(out).not.toContain('#2');
  });
  it('children indent under their epic', () => {
    const out = formatItems([
      it_({ id: '9', parent: '7', want: 5 }),
      it_({ id: '7', type: 'epic', title: 'Big', want: 5 }),
      it_({ id: '3', want: 1 }),
    ], 'all').split('\n');
    expect(out[0]).toMatch(/^epic #7 /);
    expect(out[1]).toMatch(/^  #9 /);
    expect(out[2]).toMatch(/^#3 /);
  });
  it('formats private ids and fields', () => {
    expect(formatItems([it_({ id: 'p12', size: 'L', want: 5, title: 'X' })], 'all')).toBe('p#12  L  W5  X  [Next]');
    expect(formatItems([it_({ id: '142', title: 'X' })], 'all')).toBe('#142  X  [Next]');
  });
});

describe('parseId', () => {
  it('keeps the p prefix', () => {
    expect(parseId('142')).toEqual({ repo: 'public', number: 142 });
    expect(parseId('p12')).toEqual({ repo: 'private', number: 12 });
    expect(parseId('#7')).toEqual({ repo: 'public', number: 7 });
    expect(parseId('next')).toBeNull();
    expect(parseId('p')).toBeNull();
  });
});

describe('toItems', () => {
  const raw = { items: [
    { id: 'PVTI_1', title: 'A', status: 'In progress', size: 'M', want: 4, type: 'feature', severity: 2,
      content: { type: 'Issue', number: 5, repository: 'o/pub', title: 'A', url: 'u' }, repository: 'https://github.com/o/pub' },
    { id: 'PVTI_2', title: 'B', status: 'Backlog', labels: ['epic'],
      content: { type: 'Issue', number: 3, repository: 'o/priv', title: 'B', url: 'u' } },
    { id: 'PVTI_3', title: 'draft', content: { type: 'DraftIssue', title: 'draft' } },
  ] };
  it('maps project items to ids by repo, skipping drafts', () => {
    const items = toItems(raw, ['o/pub', 'o/priv'], { '5': '3' });
    expect(items).toEqual([
      { id: '5', title: 'A', status: 'In progress', size: 'M', want: 4, type: 'feature', severity: 2, parent: undefined },
      { id: 'p3', title: 'B', status: 'Backlog', size: undefined, want: undefined, type: 'epic', severity: undefined, parent: undefined },
    ].map((i) => (i.id === '5' ? { ...i, parent: '3' } : i)));
  });
});

describe('trimIssueView', () => {
  const view = {
    title: 'T',
    body: 'body text\nspec: docs/superpowers/specs/a.md\nplan `docs/superpowers/plans/b.md`',
    comments: [{ body: 'Status (resume here, old)\nold' }, { body: 'Status (resume here)\nnew' }, { body: 'chatter' }],
  };
  it('keeps body and latest status comment, lists linked docs', () => {
    const out = trimIssueView(view);
    expect(out).toContain('body text');
    expect(out).toContain('new');
    expect(out).not.toContain('old');
    expect(out).not.toContain('chatter');
    expect(out).toContain('docs/superpowers/specs/a.md');
    expect(out).toContain('docs/superpowers/plans/b.md');
  });
  it('works with no status comment', () => {
    expect(trimIssueView({ title: 'T', body: 'b', comments: [] })).toBe('T\n\nb');
  });
});
