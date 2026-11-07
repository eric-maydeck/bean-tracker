import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

export type HostConfig = { domain: string; contactName?: string; contactEmail?: string };
export type SiteConfig = { hosts: HostConfig[]; imageSuggest: { providers?: string }; tavily: { monthlyLimit?: number } };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseSiteConfig(text: string, source: string): SiteConfig {
  const bad = (path: string, why: string): never => {
    throw new Error(`${source}: ${path} ${why}`);
  };
  const noExtra = (o: Record<string, unknown>, allowed: string[], prefix: string) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) bad(prefix + k, 'is not a known key');
  };
  const str = (v: unknown, path: string, required = false): string | undefined => {
    if (v === undefined && !required) return undefined;
    if (typeof v !== 'string' || !v.trim()) bad(path, 'must be a non-empty string');
    return v as string;
  };

  let raw: unknown;
  try {
    raw = parse(text);
  } catch (e) {
    throw new Error(`${source}: ${(e as Error).message}`);
  }
  raw ??= {};
  if (!isObj(raw)) return bad('(root)', 'must be a mapping');
  noExtra(raw, ['hosts', 'imageSuggest', 'tavily'], '');

  const rawHosts = raw.hosts ?? [];
  if (!Array.isArray(rawHosts)) bad('hosts', 'must be a list');
  const hosts = (rawHosts as unknown[]).map((h, i): HostConfig => {
    const p = `hosts[${i}]`;
    if (!isObj(h)) return bad(p, 'must be a mapping');
    noExtra(h, ['domain', 'contactName', 'contactEmail'], `${p}.`);
    const out: HostConfig = { domain: str(h.domain, `${p}.domain`, true)! };
    const contactName = str(h.contactName, `${p}.contactName`);
    const contactEmail = str(h.contactEmail, `${p}.contactEmail`);
    if (contactName) out.contactName = contactName;
    if (contactEmail) out.contactEmail = contactEmail;
    return out;
  });

  const imageSuggest = raw.imageSuggest ?? {};
  if (!isObj(imageSuggest)) bad('imageSuggest', 'must be a mapping');
  noExtra(imageSuggest as Record<string, unknown>, ['providers'], 'imageSuggest.');
  const providers = str((imageSuggest as Record<string, unknown>).providers, 'imageSuggest.providers');

  const tavily = raw.tavily ?? {};
  if (!isObj(tavily)) bad('tavily', 'must be a mapping');
  noExtra(tavily as Record<string, unknown>, ['monthlyLimit'], 'tavily.');
  const ml = (tavily as Record<string, unknown>).monthlyLimit;
  if (ml !== undefined && !(Number.isInteger(ml) && (ml as number) > 0)) bad('tavily.monthlyLimit', 'must be a positive integer');

  return {
    hosts,
    imageSuggest: providers ? { providers } : {},
    tavily: ml === undefined ? {} : { monthlyLimit: ml as number }
  };
}

let cached: SiteConfig | null = null;
export const resetSiteConfig = () => {
  cached = null;
};

export function loadSiteConfig(env: Record<string, string | undefined> = process.env): SiteConfig {
  if (cached) return cached;
  const path = env.CONFIG_PATH ?? './config.yaml';
  if (!existsSync(path)) {
    if (env.CONFIG_PATH !== undefined) throw new Error(`CONFIG_PATH file not found: ${path}`);
    return (cached = { hosts: [], imageSuggest: {}, tavily: {} });
  }
  return (cached = parseSiteConfig(readFileSync(path, 'utf8'), path));
}

// Lowercase, drop [ipv6] brackets / :port / trailing dot.
function normHost(host: string): string {
  const h = host.toLowerCase().trim();
  const bracket = h.match(/^\[([^\]]*)\]/);
  return (bracket ? bracket[1] : h.replace(/:\d+$/, '')).replace(/\.$/, '');
}

export function siteFor(host: string, cfg: SiteConfig = loadSiteConfig()) {
  const h = normHost(host);
  const match = cfg.hosts.find((c) => {
    const d = normHost(c.domain);
    return h === d || h.endsWith('.' + d);
  });
  const site = match ?? cfg.hosts[0];
  return {
    contactName: site?.contactName ?? 'Bean Tracker',
    contactEmail: site?.contactEmail ?? null,
    canonical: cfg.hosts[0] ? `https://${cfg.hosts[0].domain}` : null
  };
}
