// Idempotent setup of the backlog: labels in both repos, the private Project, its repo links and fields.
// Usage: node scripts/backlog-setup.ts [--dry-run] [--json-out path]
// --dry-run reads labels (repo scope) and, if the token has the project scope, the project; never writes.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const TITLE = 'Bean Tracker backlog';
export const LABELS = ['type:feature', 'type:bug', 'type:chore', 'groomed', 'backfilled', 'epic'];
export type FieldSpec = { name: string; dataType: 'SINGLE_SELECT' | 'NUMBER' | 'DATE'; options?: string[] };
export const FIELDS: FieldSpec[] = [
  { name: 'Type', dataType: 'SINGLE_SELECT', options: ['feature', 'bug', 'chore'] },
  { name: 'Size', dataType: 'SINGLE_SELECT', options: ['S', 'M', 'L'] },
  { name: 'Status', dataType: 'SINGLE_SELECT', options: ['Backlog', 'Next', 'In progress', 'Blocked', 'Done'] },
  { name: 'Want', dataType: 'NUMBER' },
  { name: 'Severity', dataType: 'NUMBER' },
  { name: 'Shipped', dataType: 'DATE' },
];

// Shape of `gh project field-list --format json` .fields[] (options only on single-select fields).
export type ProjectField = { id: string; name: string; type: string; options?: { id: string; name: string }[] };

// What GitHub gives a new project: Status exists already with its default options.
export const FRESH_PROJECT: ProjectField[] = [{ id: '(built-in)', name: 'Status', type: 'ProjectV2SingleSelectField',
  options: ['Todo', 'In Progress', 'Done'].map((name) => ({ id: '', name })) }];

export const missingLabels = (existing: string[], desired = LABELS) => desired.filter((l) => !existing.includes(l));

export type FieldPlan = { create: FieldSpec[]; setOptions: { field: ProjectField; options: string[] }[] };
// New fields to create; existing single-selects whose option names differ (the built-in Status) get rewritten.
export function planFields(existing: ProjectField[], desired = FIELDS): FieldPlan {
  const plan: FieldPlan = { create: [], setOptions: [] };
  for (const want of desired) {
    const have = existing.find((f) => f.name === want.name);
    if (!have) plan.create.push(want);
    else if (want.options && want.options.join('\n') !== (have.options ?? []).map((o) => o.name).join('\n'))
      plan.setOptions.push({ field: have, options: want.options });
  }
  return plan;
}

export type IdMap = Record<string, { id: string; options?: Record<string, string> }>;
export function buildIdMap(fields: ProjectField[], names = FIELDS.map((f) => f.name)): IdMap {
  const out: IdMap = {};
  for (const n of names) {
    const f = fields.find((x) => x.name === n);
    if (!f) continue;
    out[n] = { id: f.id, ...(f.options && { options: Object.fromEntries(f.options.map((o) => [o.name, o.id])) }) };
  }
  return out;
}

// GraphQL for updateProjectV2Field; option ids are regenerated, so the map is rebuilt afterwards.
export function updateFieldMutation(fieldId: string, options: string[]) {
  const opts = options.map((name) => `{name: ${JSON.stringify(name)}, color: GRAY, description: ""}`).join(', ');
  return `mutation { updateProjectV2Field(input: {fieldId: ${JSON.stringify(fieldId)}, singleSelectOptions: [${opts}]}) { projectV2Field { ... on ProjectV2SingleSelectField { id } } } }`;
}

// ---- thin CLI ----
const gh = (...a: string[]) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const json = (...a: string[]) => JSON.parse(gh(...a));
const NEEDS = 'needs: gh auth refresh -s project';
const projectCall = <T>(f: () => T): T => {
  try { return f(); } catch (e) {
    if (/scope|permission|resolve to a User|INSUFFICIENT/i.test(String((e as { stderr?: string }).stderr ?? e))) throw new Error(NEEDS);
    throw e;
  }
};

// [public, private] as owner/name: the checkout's gh repo and the private/ checkout's origin.
export function discoverRepos(): [string, string] {
  const pub = json('repo', 'view', '--json', 'nameWithOwner').nameWithOwner as string;
  const priv = execFileSync('git', ['-C', 'private', 'remote', 'get-url', 'origin'], { encoding: 'utf8' })
    .trim().replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
  return [pub, priv];
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const outPath = args.includes('--json-out') ? args[args.indexOf('--json-out') + 1] : undefined;
  const repos = discoverRepos();
  console.log(`repos: ${repos.join(', ')}`);

  for (const r of repos) {
    const have = json('label', 'list', '-R', r, '--limit', '200', '--json', 'name').map((l: { name: string }) => l.name);
    const miss = missingLabels(have);
    console.log(`${r} labels to create: ${miss.join(', ') || '(none)'}`);
    if (!dry) for (const l of miss) gh('label', 'create', l, '-R', r);
  }

  let project: { number: number; id: string } | undefined;
  try {
    const list = projectCall(() => json('project', 'list', '--owner', '@me', '--format', 'json', '-L', '100'));
    project = list.projects.find((p: { title: string }) => p.title === TITLE);
  } catch (e) {
    if (!dry) throw e;
    console.log(`project: ${(e as Error).message} (dry run: planned fields below assume a new project)`);
    console.log(JSON.stringify(planFields(FRESH_PROJECT), null, 2));
    return;
  }
  console.log(project ? `project #${project.number} exists` : `project to create: ${TITLE}`);
  if (dry && !project) { console.log(JSON.stringify(planFields(FRESH_PROJECT), null, 2)); return; }
  if (!project) project = json('project', 'create', '--owner', '@me', '--title', TITLE, '--format', 'json');
  const n = String(project!.number);
  const fieldsNow = () => json('project', 'field-list', n, '--owner', '@me', '--format', 'json', '-L', '100').fields as ProjectField[];

  const plan = planFields(fieldsNow());
  console.log(`fields to create: ${plan.create.map((f) => f.name).join(', ') || '(none)'}`);
  console.log(`fields to set options: ${plan.setOptions.map((s) => `${s.field.name} -> ${s.options.join('|')}`).join('; ') || '(none)'}`);
  if (dry) return;
  for (const r of repos) gh('project', 'link', n, '--owner', '@me', '-R', r); // re-linking is a no-op
  for (const f of plan.create) {
    const a = ['project', 'field-create', n, '--owner', '@me', '--name', f.name, '--data-type', f.dataType];
    if (f.options) a.push('--single-select-options', f.options.join(','));
    gh(...a);
  }
  for (const s of plan.setOptions) gh('api', 'graphql', '-f', `query=${updateFieldMutation(s.field.id, s.options)}`);
  const result = { projectNumber: project!.number, projectId: project!.id, fields: buildIdMap(fieldsNow()) };
  const text = JSON.stringify(result, null, 2);
  console.log(text);
  if (outPath) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, text + '\n'); }
}

if (process.argv[1]?.endsWith('backlog-setup.ts')) {
  try { main(); } catch (e) { console.error((e as Error).message); process.exit(1); }
}
