import { describe, it, expect } from 'vitest';
import { missingLabels, planFields, buildIdMap, updateFieldMutation, LABELS, type ProjectField } from './backlog-setup.ts';

// Shaped like `gh project field-list --format json` for a fresh project.
const fresh: ProjectField[] = [
  { id: 'F_title', name: 'Title', type: 'ProjectV2Field' },
  { id: 'F_status', name: 'Status', type: 'ProjectV2SingleSelectField',
    options: [{ id: 'o1', name: 'Todo' }, { id: 'o2', name: 'In Progress' }, { id: 'o3', name: 'Done' }] },
];
const done: ProjectField[] = [
  ...fresh.slice(0, 1),
  { id: 'F_status', name: 'Status', type: 'ProjectV2SingleSelectField',
    options: ['Backlog', 'Next', 'In progress', 'Blocked', 'Done'].map((name, i) => ({ id: `s${i}`, name })) },
  { id: 'F_type', name: 'Type', type: 'ProjectV2SingleSelectField', options: ['feature', 'bug', 'chore'].map((name, i) => ({ id: `t${i}`, name })) },
  { id: 'F_size', name: 'Size', type: 'ProjectV2SingleSelectField', options: ['S', 'M', 'L'].map((name, i) => ({ id: `z${i}`, name })) },
  { id: 'F_want', name: 'Want', type: 'ProjectV2Field' },
  { id: 'F_sev', name: 'Severity', type: 'ProjectV2Field' },
  { id: 'F_ship', name: 'Shipped', type: 'ProjectV2Field' },
];

describe('backlog-setup', () => {
  it('lists only labels that are missing', () => {
    expect(missingLabels(['bug', 'epic', 'groomed'])).toEqual(['type:feature', 'type:bug', 'type:chore', 'backfilled']);
    expect(missingLabels(LABELS)).toEqual([]);
  });
  it('fresh project: create five fields, rewrite built-in Status options', () => {
    const p = planFields(fresh);
    expect(p.create.map((f) => f.name)).toEqual(['Type', 'Size', 'Want', 'Severity', 'Shipped']);
    expect(p.setOptions).toHaveLength(1);
    expect(p.setOptions[0].field.id).toBe('F_status');
    expect(p.setOptions[0].options).toEqual(['Backlog', 'Next', 'In progress', 'Blocked', 'Done']);
  });
  it('finished project: nothing to do', () => {
    expect(planFields(done)).toEqual({ create: [], setOptions: [] });
  });
  it('builds the id map', () => {
    const m = buildIdMap(done);
    expect(m.Status).toEqual({ id: 'F_status', options: { Backlog: 's0', Next: 's1', 'In progress': 's2', Blocked: 's3', Done: 's4' } });
    expect(m.Want).toEqual({ id: 'F_want' });
    expect(m.Title).toBeUndefined();
  });
  it('builds the update mutation', () => {
    const q = updateFieldMutation('F_status', ['A', 'In progress']);
    expect(q).toContain('fieldId: "F_status"');
    expect(q).toContain('{name: "In progress", color: GRAY, description: ""}');
  });
});
