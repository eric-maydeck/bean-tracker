// Compact backlog listing for agents. Usage: node scripts/backlog.ts [next|all|<id>]  (<id>: 142 public, p12 private)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { discoverRepos } from './backlog-setup.ts';

export type Item = { id: string; title: string; status: string; type?: string; size?: string; want?: number; severity?: number; parent?: string };

export function parseId(arg: string): { repo: 'public' | 'private'; number: number } | null {
  const m = /^#?(p?)(\d+)$/.exec(arg.trim());
  return m ? { repo: m[1] ? 'private' : 'public', number: Number(m[2]) } : null;
}

const ORDER = ['In progress', 'Next', 'Blocked'];
const SIZE = ['S', 'M', 'L'];
const rank = (s: string) => (ORDER.includes(s) ? ORDER.indexOf(s) : ORDER.length); // Backlog after the active ones
const num = (id: string) => (id.startsWith('p') ? `p#${id.slice(1)}` : `#${id}`);
const sizeRank = (s?: string) => (s && SIZE.includes(s) ? SIZE.indexOf(s) : SIZE.length);
const bySort = (a: Item, b: Item) =>
  rank(a.status) - rank(b.status) || (b.want ?? 0) - (a.want ?? 0) || sizeRank(a.size) - sizeRank(b.size);

const line = (i: Item, indent = '') =>
  [indent + (i.type === 'epic' ? 'epic ' : '') + num(i.id), i.size, i.want != null && `W${i.want}`, i.title, `[${i.status}]`]
    .filter(Boolean).join('  ');

export function formatItems(items: Item[], mode: 'next' | 'all'): string {
  const shown = items.filter((i) => (mode === 'next' ? ORDER.includes(i.status) : i.status !== 'Done')).sort(bySort);
  const ids = new Set(shown.map((i) => i.id));
  const kids = (id: string) => shown.filter((i) => i.parent === id);
  const out: string[] = [];
  for (const i of shown) {
    if (i.parent && ids.has(i.parent)) continue; // printed under its parent
    out.push(line(i));
    for (const k of kids(i.id)) out.push(line(k, '  '));
  }
  return out.join('\n');
}

// Shape of `gh project item-list --format json`: field values are lowercased top-level keys, plus content{number,repository}.
type RawItem = { title?: string; status?: string; type?: string; size?: string; want?: number; severity?: number; labels?: string[];
  content?: { type?: string; number?: number; repository?: string } };
export function toItems(raw: { items: RawItem[] }, [pub]: string[], parents: Record<string, string> = {}): Item[] {
  const out: Item[] = [];
  for (const r of raw.items) {
    const c = r.content;
    if (!c?.number || !c.repository) continue; // drafts
    const id = (c.repository === pub ? '' : 'p') + c.number;
    out.push({ id, title: r.title ?? '', status: r.status ?? 'Backlog', size: r.size, want: r.want, severity: r.severity,
      type: r.labels?.includes('epic') ? 'epic' : r.type, parent: parents[id] });
  }
  return out;
}

export function trimIssueView(v: { title: string; body: string; comments: { body: string }[] }): string {
  const status = v.comments.filter((c) => c.body.startsWith('Status (resume here')).at(-1);
  const docs = [...new Set(v.body.match(/docs\/superpowers\/[\w./-]+\.md/g) ?? [])];
  const parts = [`${v.title}\n\n${v.body}`];
  if (status) parts.push(`--- latest status comment ---\n${status.body}`);
  if (docs.length) parts.push(`linked: ${docs.join(', ')}`);
  return parts.join('\n\n');
}

// ---- thin CLI ----
const gh = (...a: string[]) => {
  try { return execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) {
    const stderr = String((e as { stderr?: string }).stderr ?? '');
    throw Object.assign(new Error(stderr.trim() || String(e)), { stderr });
  }
};

// ponytail: first 100 open issues per repo for parents; paginate if a repo ever has more.
function parentMap(repos: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  repos.forEach((r, n) => {
    const [owner, name] = r.split('/');
    const q = `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { issues(states: OPEN, first: 100) { nodes { number parent { number repository { nameWithOwner } } } } } }`;
    const nodes = JSON.parse(gh('api', 'graphql', '-f', `query=${q}`)).data.repository.issues.nodes;
    for (const x of nodes) if (x.parent) out[(n ? 'p' : '') + x.number] = (x.parent.repository.nameWithOwner === repos[0] ? '' : 'p') + x.parent.number;
  });
  return out;
}

function main() {
  const arg = process.argv[2] ?? 'next';
  const repos = discoverRepos();
  if (arg === 'next' || arg === 'all') {
    let n: number;
    try { n = JSON.parse(readFileSync('.claude/work/project.json', 'utf8')).projectNumber; } catch {
      throw new Error('no project yet: run node scripts/backlog-setup.ts');
    }
    let raw;
    try { raw = JSON.parse(gh('project', 'item-list', String(n), '--owner', '@me', '--format', 'json', '--limit', '500')); } catch (e) {
      throw new Error(/scope|permission/i.test(String((e as { stderr?: string }).stderr)) ? 'needs: gh auth refresh -s project' : String((e as Error).message).split('\n')[0]);
    }
    console.log(formatItems(toItems(raw, repos, parentMap(repos)), arg));
    return;
  }
  const id = parseId(arg);
  if (!id) throw new Error('usage: node scripts/backlog.ts [next|all|<id>]   (<id>: 142 public, p12 private)');
  const view = JSON.parse(gh('issue', 'view', String(id.number), '-R', repos[id.repo === 'public' ? 0 : 1], '--json', 'title,body,comments'));
  console.log(trimIssueView(view));
}

if (process.argv[1]?.endsWith('backlog.ts')) {
  try { main(); } catch (e) { console.error((e as Error).message.split('\n')[0]); process.exit(1); }
}
