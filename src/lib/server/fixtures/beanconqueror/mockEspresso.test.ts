// Asserts the mock export holds every case of the coverage list (C1-C74, private docs
// 2026-11-25-espresso-mock-coverage.md section 8), that the full size keeps the real export's rates, and that the
// current reader runs on it.
import { describe, it, expect } from 'vitest';
import { mockEspressoDetailed, mockEspressoExport } from './mockEspresso';
import { zipOf } from './fixture';
import { bcTimestamp, parseBeanConquerorJson, readBeanConquerorZip } from '../../beanConquerorJson';
import { importBeanConquerorData } from '../../beanconqueror';
import { createDb } from '../../db';

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const share = <T,>(a: T[], f: (x: T) => boolean) => a.filter(f).length / Math.max(a.length, 1);
const dec = (n: number) => !Number.isInteger(n);
const num = (f: (b: R) => unknown) => (b: R) => typeof f(b) === 'number';

function load(size: 'small' | 'full') {
  const out = mockEspressoDetailed(size, 1);
  const parse = (name: string): any => JSON.parse(out.zipFiles[name]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const main = parse('Beanconqueror.json');
  const fileNames = (kind: string) => Object.keys(out.zipFiles).filter((n) => n.startsWith(`Beanconqueror_${kind}_`)).sort((a, b) => parseInt(a.replace(/\D+/g, '')) - parseInt(b.replace(/\D+/g, '')));
  const brewFiles: R[][] = fileNames('Brews').map(parse);
  const beanFiles: R[][] = fileNames('Beans').map(parse);
  const brews: R[] = [...main.BREWS, ...brewFiles.flat()];
  const beans: R[] = [...main.BEANS, ...beanFiles.flat()];
  const method = new Map<string, R>(main.PREPARATION.map((m: R) => [m.config.uuid, m]));
  const style = (b: R) => method.get(b.method_of_preparation)!.style_type as string;
  return { out, main, brewFiles, beanFiles, brews, beans, method, style, fileNames, esp: brews.filter((b) => style(b) === 'ESPRESSO') };
}

const small = load('small');
const flows = new Map<string, R>(Object.entries(small.out.flowFiles).map(([n, t]) => [n.replace('_flow_profile.json', ''), JSON.parse(t)]));
const brewByUuid = new Map(small.brews.map((b) => [b.config.uuid, b]));
const beanByUuid = new Map(small.beans.map((b) => [b.config.uuid, b]));
const tools = small.main.PREPARATION.flatMap((m: R) => m.tools.map((t: R) => ({ ...t, method: m })));
const usedBy = (toolId: string) => small.brews.filter((b) => b.method_of_preparation_tools.includes(toolId));
const methodBrews = (m: R) => small.brews.filter((b) => b.method_of_preparation === m.config.uuid);
const biggest = small.main.PREPARATION.slice().sort((a: R, b: R) => methodBrews(b).length - methodBrews(a).length)[0] as R;
const localDay = (b: R) => bcTimestamp(b.config.unix_timestamp).slice(0, 10);
const flowOf = (b: R) => flows.get(b.config.uuid);
const secs = (e: R) => e.brew_time.split('.').map(Number)[0] as number;
const clockMs = (t: string) => { const [h, m, s] = t.split(':'); return (+h * 3600 + +m * 60 + parseFloat(s)) * 1000; };
const pressureFiles = [...flows.entries()].filter(([, f]) => f.pressureFlow.length > 0);
const pCurve = (id: string) => (flows.get(id)!.pressureFlow as R[]).map((e) => ({ t: clockMs(e.timestamp) / 1000 - clockMs(flows.get(id)!.pressureFlow[0].timestamp) / 1000, p: e.actual_pressure as number }));
const peakOf = (c: { p: number }[]) => c.map((x) => x.p).sort((a, b) => a - b)[Math.floor(c.length * 0.95)];

const cases: [string, string, () => boolean][] = [
  ['C1', 'main file holds the first N brews and beans plus the gear', () => small.main.BREWS.length === 100 && small.main.BEANS.length === 100
    && ['MILL', 'PREPARATION', 'WATER', 'SETTINGS', 'VERSION'].every((k) => small.main[k].length > 0) && ['GRAPH', 'GREEN_BEANS', 'ROASTING_MACHINES'].every((k) => small.main[k].length === 0)
    && Math.max(...small.main.BEANS.map((b: R) => b.config.unix_timestamp)) <= Math.min(...small.beanFiles.flat().map((b) => b.config.unix_timestamp))
    && Math.max(...small.main.BREWS.map((b: R) => b.config.unix_timestamp)) <= median(small.brewFiles.flat().map((b) => b.config.unix_timestamp))],
  ['C2', 'Brews_N split files, the last one short', () => small.brewFiles.length >= 2 && small.brewFiles.slice(0, -1).every((f) => f.length === 100)
    && small.brewFiles.at(-1)!.length < 100 && Object.keys(small.out.zipFiles).includes('Beanconqueror_Brews_1.json')
    && median(small.brewFiles[0].map((b) => b.config.unix_timestamp)) < median(small.brewFiles[1].map((b) => b.config.unix_timestamp))],
  ['C3', 'a brew points at a bean that exists only in a Beans file', () => {
    const mainBeans = new Set(small.main.BEANS.map((b: R) => b.config.uuid));
    return small.beanFiles.length >= 1 && small.brews.some((b) => !mainBeans.has(b.bean) && beanByUuid.has(b.bean));
  }],
  ['C4', 'flow files by brew uuid; flow_profile is 60 chars and not the file name; visualizer_id on exactly those', () => {
    const withFlow = small.brews.filter((b) => b.flow_profile !== '');
    return withFlow.length > 20 && withFlow.every((b) => flows.has(b.config.uuid) && b.flow_profile.length === 60 && b.flow_profile.endsWith('_flow_profile.json')
      && !b.flow_profile.includes(b.config.uuid) && b.customInformation.visualizer_id !== '')
      && share(withFlow, (b) => style0(b) === 'ESPRESSO') > 0.9;
  }],
  ['C5', 'no flow file: flow_profile and visualizer_id are empty', () => small.brews.filter((b) => !flows.has(b.config.uuid)).every((b) => b.flow_profile === '' && b.customInformation.visualizer_id === '')],
  ['C6', 'a handful of orphan flow files, one with every array empty', () => {
    const orphans = [...flows.entries()].filter(([id]) => !brewByUuid.has(id));
    return orphans.length >= 3 && orphans.some(([, f]) => Object.values(f).every((v) => (Array.isArray(v) ? v.length === 0 : true)));
  }],
  ['C7', 'every reference resolves, a brew has water "", no duplicate uuids', () => {
    const ids = [...small.brews.map((b) => b.config.uuid), ...small.beans.map((b) => b.config.uuid), ...small.main.PREPARATION.map((m: R) => m.config.uuid),
      ...tools.map((t: R) => t.config.uuid), ...small.main.MILL.map((m: R) => m.config.uuid), ...small.main.WATER.map((w: R) => w.config.uuid)];
    const mills = new Set(small.main.MILL.map((m: R) => m.config.uuid)), waters = new Set(small.main.WATER.map((w: R) => w.config.uuid));
    return new Set(ids).size === ids.length && small.brews.every((b) => beanByUuid.has(b.bean) && small.method.has(b.method_of_preparation) && mills.has(b.mill) && (b.water === '' || waters.has(b.water)))
      && small.brews.some((b) => b.water === '');
  }],
  ['C8', 'epoch seconds, over a year, 2-8 a day with median 4', () => {
    const per = new Map<string, number>();
    for (const b of small.brews) per.set(localDay(b), (per.get(localDay(b)) ?? 0) + 1);
    const ts = small.brews.map((b) => b.config.unix_timestamp);
    return ts.every((t) => Number.isInteger(t) && t > 1.6e9 && t < 2e9) && Math.max(...ts) - Math.min(...ts) > 365 * 86400
      && median([...per.values()]) >= 3 && median([...per.values()]) <= 5 && Math.max(...per.values()) <= 9 && Math.min(...per.values()) >= 1
      && [...per.values()].filter((n) => n >= 2).length > per.size * 0.8;
  }],
  ['C9', 'out-of-order and duplicate timestamps; a brew before its bean was created', () => {
    const inFile = small.brewFiles.flatMap((f) => f.slice(1).map((b, i) => b.config.unix_timestamp < f[i].config.unix_timestamp));
    const all = small.brews.map((b) => b.config.unix_timestamp);
    return inFile.some(Boolean) && new Set(all).size < all.length && small.brews.some((b) => b.config.unix_timestamp < beanByUuid.get(b.bean)!.config.unix_timestamp);
  }],
  ['C10', 'numeric empties are 0', () => ['grind_weight', 'brew_beverage_quantity', 'brew_time', 'coffee_first_drip_time', 'brew_temperature', 'tds', 'rating', 'coffee_blooming_time', 'brew_quantity']
    .every((k) => small.brews.every((b) => typeof b[k] === 'number') && small.brews.some((b) => b[k] === 0))],
  ['C11', 'grind_size: number mostly, "" on some non-espresso, 0 on a few', () => share(small.brews, num((b) => b.grind_size)) > 0.9
    && small.brews.filter((b) => b.grind_size === '').every((b) => small.style(b) !== 'ESPRESSO') && small.brews.some((b) => b.grind_size === '') && small.brews.some((b) => b.grind_size === 0)],
  ['C12', 'dose 0 and 1 dp, yield mostly 1 dp, a dose of 0, an espresso yield of 0', () => small.esp.some((b) => b.grind_weight > 0 && !dec(b.grind_weight)) && small.esp.some((b) => dec(b.grind_weight))
    && share(small.esp.filter((b) => b.brew_beverage_quantity > 0), (b) => dec(b.brew_beverage_quantity)) > 0.75 && small.brews.some((b) => b.grind_weight === 0) && small.esp.some((b) => b.brew_beverage_quantity === 0)],
  ['C13', 'ratio: ~90% above 1:2.5, ~7% above 1:4, a shot below 1:1.5, median about 1:3', () => {
    const r = small.esp.filter((b) => b.grind_weight > 0 && b.brew_beverage_quantity > 0).map((b) => b.brew_beverage_quantity / b.grind_weight);
    return share(r, (x) => x > 2.5) > 0.8 && share(r, (x) => x > 2.5) < 0.97 && share(r, (x) => x > 4) > 0.01 && share(r, (x) => x > 4) < 0.15 && r.some((x) => x < 1.5) && median(r) > 2.8 && median(r) < 3.3;
  }],
  ['C14', 'espresso shot time: most 15-35 s, some under 15, 35-60, over 60, one over 100, one under 5', () => {
    const t = small.esp.map((b) => b.brew_time).filter((x) => x > 0);
    return share(t, (x) => x >= 15 && x <= 35) > 0.45 && t.some((x) => x < 15 && x >= 5) && t.some((x) => x > 35 && x <= 60) && t.some((x) => x > 60 && x <= 100) && t.some((x) => x > 100) && t.some((x) => x < 5);
  }],
  ['C15', 'shot with time 0 and drip 0; a timed shot without drip; drip at or past the time', () => small.esp.some((b) => b.brew_time === 0 && b.coffee_first_drip_time === 0)
    && small.esp.some((b) => b.brew_time > 0 && b.coffee_first_drip_time === 0 && !flows.has(b.config.uuid)) && small.esp.some((b) => b.brew_time > 0 && b.coffee_first_drip_time >= b.brew_time)],
  ['C16', 'espresso temperature in {88,90,95,96,99} or 0; a non-espresso 100; a percolation 200', () => small.esp.every((b) => [0, 88, 90, 95, 96, 99].includes(b.brew_temperature))
    && small.esp.some((b) => b.brew_temperature > 0) && small.brews.some((b) => small.style(b) !== 'ESPRESSO' && b.brew_temperature === 100) && small.brews.some((b) => small.style(b) === 'PERCOLATION' && b.brew_temperature === 200)],
  ['C17', 'mill_speed in steps of 100 on some grinders, 0 on others', () => {
    const per = new Map<string, number[]>();
    for (const b of small.brews) per.set(b.mill, [...(per.get(b.mill) ?? []), b.mill_speed]);
    const sp = [...per.values()];
    return sp.some((l) => l.some((x) => x > 0)) && sp.some((l) => l.every((x) => x === 0)) && small.brews.every((b) => b.mill_speed === 0 || (b.mill_speed % 100 === 0 && b.mill_speed >= 200 && b.mill_speed <= 2000));
  }],
  ['C18', 'three grind scales: 1 dp small, hundreds integer, none recorded', () => {
    const per = new Map<string, unknown[]>();
    for (const b of small.brews) per.set(b.mill, [...(per.get(b.mill) ?? []), b.grind_size]);
    const g = [...per.values()];
    return g.some((l) => l.every((x) => typeof x === 'number' && (x === 0 || (x >= 180 && x <= 820)) && Number.isInteger(x))) && g.some((l) => l.some((x) => typeof x === 'number' && dec(x) && x >= 1.2 && x <= 10))
      && g.some((l) => l.filter((x) => x === '').length >= l.length * 0.6);
  }],
  ['C19', 'TDS on a handful of espresso shots (0.5-3, mostly floats, one integer)', () => {
    const t = small.brews.filter((b) => b.tds > 0);
    return t.length >= 2 && t.length < 10 && t.every((b) => small.style(b) === 'ESPRESSO' && b.tds >= 0.5 && b.tds <= 3) && t.some((b) => dec(b.tds)) && t.some((b) => !dec(b.tds));
  }],
  ['C20', 'rating 0 on ~97%; whole and half steps 0.5-4.5', () => {
    const r = small.brews.filter((b) => b.rating > 0);
    return share(small.brews, (b) => b.rating === 0) > 0.94 && r.every((b) => b.rating >= 0.5 && b.rating <= 4.5 && b.rating * 2 === Math.round(b.rating * 2)) && r.some((b) => dec(b.rating)) && r.some((b) => !dec(b.rating));
  }],
  ['C21', 'espresso coffee_type "", espresso, and a capitalised or other value', () => {
    const v = new Set(small.esp.map((b) => b.coffee_type));
    return v.has('') && v.has('espresso') && (v.has('Cortado') || v.has('americano')) && small.brews.filter((b) => small.style(b) !== 'ESPRESSO').every((b) => b.coffee_type === '');
  }],
  ['C22', 'pre-infusion 5-10 s on espresso; non-espresso bloom 20-120 plus one absurd', () => small.esp.some((b) => b.coffee_blooming_time >= 5 && b.coffee_blooming_time <= 10)
    && small.esp.every((b) => b.coffee_blooming_time <= 10) && small.brews.some((b) => small.style(b) !== 'ESPRESSO' && b.coffee_blooming_time >= 20 && b.coffee_blooming_time <= 120)
    && small.brews.filter((b) => b.coffee_blooming_time > 1000).length === 1],
  ['C23', 'pressure_profile: "6bar Smooth" form, one word, bare integer, free text, ""', () => {
    const p = small.brews.map((b) => b.pressure_profile as string);
    return p.some((x) => /^\d+bar [A-Za-z]{6}$/.test(x)) && p.some((x) => /^[A-Za-z]{4}$/.test(x)) && p.some((x) => /^\d+$/.test(x)) && p.some((x) => /[-,+]/.test(x)) && p.includes('');
  }],
  ['C24', 'notes on ~3.6%: ASCII, newline, emoji, accented letter, up to ~160 chars', () => {
    const n = small.brews.map((b) => b.note as string).filter((x) => x !== '');
    return share(small.brews, (b) => b.note !== '') > 0.02 && share(small.brews, (b) => b.note !== '') < 0.09 && n.some((x) => /^[\x20-\x7e]+$/.test(x)) && n.some((x) => x.includes('\n'))
      && n.some((x) => /\p{Extended_Pictographic}/u.test(x)) && n.some((x) => /[à-ÿ]/.test(x)) && Math.max(...n.map((x) => x.length)) > 100 && Math.max(...n.map((x) => x.length)) <= 160;
  }],
  ['C25', 'constant filler keys on every brew', () => small.brews.every((b) => JSON.stringify([b.cupping, b.coordinates, b.reference_flow_profile, b.preparationDeviceBrew, b.coffee_concentration, b.brew_quantity_type, b.brew_beverage_quantity_type, b.bean_weight_in, b.mill_timer, b.brew_temperature_time])
    === JSON.stringify([{ body: 0, brightness: 0, clean_cup: 0, complexity: 0, cuppers_correction: 0, dry_fragrance: 0, finish: 0, flavor: 0, sweetness: 0, uniformity: 0, wet_aroma: 0, notes: '' },
      { accuracy: null, altitude: null, altitudeAccuracy: null, heading: null, latitude: null, longitude: null, speed: null }, { type: 'NONE', uuid: '' }, { type: 'NONE' }, '', 'GR', 'GR', 0, 0, 0])
    && ['mill_timer_milliseconds', 'brew_time_milliseconds', 'brew_temperature_time_milliseconds', 'coffee_first_drip_time_milliseconds', 'coffee_blooming_time_milliseconds'].every((k) => b[k] === 0))],
  ['C26', 'best_brew false everywhere, favourite on a couple', () => small.brews.every((b) => b.best_brew === false) && small.brews.filter((b) => b.favourite).length >= 2 && small.brews.filter((b) => b.favourite).length <= 5],
  ['C27', 'a vessel, an attachment, predefined_flavors', () => small.brews.some((b) => b.vessel_name !== '' && b.vessel_weight > 0) && small.brews.some((b) => b.attachments.length > 0)
    && small.brews.some((b) => Object.keys(b.cupped_flavor.predefined_flavors).length > 0)],
  ['C28', 'all four styles with their usual fill', () => {
    const by = (s: string) => small.brews.filter((b) => small.style(b) === s);
    return ['ESPRESSO', 'POUR OVER', 'PERCOLATION', 'FULL_IMMERSION'].every((s) => by(s).length > 0)
      && share(by('ESPRESSO'), (b) => b.brew_beverage_quantity > 0 && b.brew_quantity === 0) > 0.98
      && ['POUR OVER', 'PERCOLATION', 'FULL_IMMERSION'].every((s) => share(by(s), (b) => b.brew_quantity > 0) > 0.9 && share(by(s), (b) => b.coffee_first_drip_time === 0) === 1 && median(by(s).map((b) => b.brew_time)) >= 100);
  }],
  ['C29', 'a non-espresso brew with both water in and beverage out', () => small.brews.some((b) => small.style(b) !== 'ESPRESSO' && b.brew_quantity > 0 && b.brew_beverage_quantity > 0)],
  ['C30', 'six espresso methods (portafilter, hand lever, custom) and each other style', () => {
    const e = small.main.PREPARATION.filter((m: R) => m.style_type === 'ESPRESSO');
    return e.length >= 6 && e.filter((m: R) => m.type === 'PORTAFILTER').length >= 3 && e.some((m: R) => m.type === 'HAND_LEVER') && e.some((m: R) => m.type === 'CUSTOM_PREPARATION')
      && ['POUR OVER', 'PERCOLATION', 'FULL_IMMERSION'].every((s) => small.main.PREPARATION.some((m: R) => m.style_type === s));
  }],
  ['C31', 'CUSTOM_PREPARATION in each of the four styles', () => new Set(small.main.PREPARATION.filter((m: R) => m.type === 'CUSTOM_PREPARATION').map((m: R) => m.style_type)).size === 4],
  ['C32', 'one big espresso method, two more big, several tiny, one with no brews', () => {
    const n = small.main.PREPARATION.filter((m: R) => m.style_type === 'ESPRESSO').map((m: R) => methodBrews(m).length / small.brews.length).sort((a: number, b: number) => b - a);
    const counts = small.main.PREPARATION.map((m: R) => methodBrews(m).length);
    return n[0] > 0.3 && n[0] < 0.5 && n[1] > 0.2 && n[2] > 0.2 && counts.filter((c: number) => c >= 1 && c <= 5).length >= 3 && counts.filter((c: number) => c === 0).length === 1;
  }],
  ['C33', 'methods with 0 tools; tool lists of 1, 2, 3, 4 and 8-10', () => {
    const l = new Set(small.main.PREPARATION.map((m: R) => m.tools.length));
    return l.has(0) && [1, 2, 3, 4].every((k) => l.has(k)) && [8, 9, 10].some((k) => l.has(k));
  }],
  ['C34', 'two tools always ticked together on one method', () => {
    const b = methodBrews(biggest);
    const [a, c] = biggest.tools;
    return share(b, (x) => x.method_of_preparation_tools.includes(a.config.uuid)) > 0.97 && b.every((x) => x.method_of_preparation_tools.includes(a.config.uuid) === x.method_of_preparation_tools.includes(c.config.uuid));
  }],
  ['C35', 'an exclusive group of 3-4 tools ticked in interleaved stretches', () => {
    const b = methodBrews(biggest).sort((x, y) => x.config.unix_timestamp - y.config.unix_timestamp);
    const g = biggest.tools.slice(2, 6).map((t: R) => t.config.uuid);
    const seq = b.map((x) => g.find((id: string) => x.method_of_preparation_tools.includes(id))).filter(Boolean);
    const runs = seq.filter((x, i) => i === 0 || x !== seq[i - 1]).length;
    return g.every((id: string) => b.filter((x) => x.method_of_preparation_tools.includes(id)).length >= 5) && b.every((x) => g.filter((id: string) => x.method_of_preparation_tools.includes(id)).length <= 1) && runs >= 8;
  }],
  ['C36', 'an add-on tool ticked only together with group members', () => {
    const add = biggest.tools[6].config.uuid, g = biggest.tools.slice(2, 6).map((t: R) => t.config.uuid);
    const withAdd = usedBy(add);
    return withAdd.length >= 5 && withAdd.every((b) => g.some((id: string) => b.method_of_preparation_tools.includes(id))) && methodBrews(biggest).some((b) => !b.method_of_preparation_tools.includes(add) && g.some((id: string) => b.method_of_preparation_tools.includes(id)));
  }],
  ['C37', 'a shot with two tools of one kind (two papers)', () => {
    const p = biggest.tools.slice(7, 10).map((t: R) => t.config.uuid);
    return methodBrews(biggest).some((b) => p.filter((id: string) => b.method_of_preparation_tools.includes(id)).length === 2);
  }],
  ['C38', 'brews with 0, 1, 2, 3, 4 tools', () => {
    const c = new Set(small.brews.map((b) => b.method_of_preparation_tools.length));
    return [0, 1, 2, 3, 4].every((k) => c.has(k)) && Math.max(...c) <= 4;
  }],
  ['C39', 'a tool created after its first tick; a tool never ticked', () => tools.some((t: R) => {
    const u = usedBy(t.config.uuid);
    return u.length > 0 && t.config.unix_timestamp > Math.min(...u.map((b) => b.config.unix_timestamp));
  }) && tools.some((t: R) => usedBy(t.config.uuid).length === 0)],
  ['C40', 'a numeric tool name; the same tool name under two methods', () => {
    const names = tools.map((t: R) => t.name as string);
    return names.some((n: string) => /^\d+$/.test(n)) && tools.some((t: R, i: number) => tools.some((u: R, j: number) => i !== j && t.name === u.name && t.method !== u.method));
  }],
  ['C41', 'tools not archived, methods not finished', () => tools.every((t: R) => t.archived === false) && small.main.PREPARATION.every((m: R) => m.finished === false)],
  ['C42', 'a tool group tied to one grinder; a group spanning two', () => {
    const grinders = (ids: string[]) => new Set(ids.flatMap((id) => usedBy(id).map((b) => b.mill)));
    const e1 = biggest.tools.slice(2, 6).map((t: R) => t.config.uuid);
    const e3 = small.main.PREPARATION.find((m: R) => m.name === 'Kettle Soup').tools.slice(1, 4).map((t: R) => t.config.uuid);
    return grinders(e1).size === 1 && grinders(e3).size >= 2;
  }],
  ['C43', '8 grinders, unique names, one finished', () => small.main.MILL.length === 8 && new Set(small.main.MILL.map((m: R) => m.name)).size === 8 && small.main.MILL.filter((m: R) => m.finished).length === 1],
  ['C44', 'a grinder used by one method, a grinder used by several', () => {
    const per = new Map<string, Set<string>>();
    for (const b of small.brews) per.set(b.mill, (per.get(b.mill) ?? new Set()).add(b.method_of_preparation));
    return [...per.values()].some((s) => s.size === 1) && [...per.values()].some((s) => s.size >= 3);
  }],
  ['C45', '17 waters: custom and preset, integer minerals with zeros, sulfate 0, three unit types', () => {
    const w: R[] = small.main.WATER;
    const minerals = ['calcium', 'magnesium', 'sodium', 'potassium', 'chloride'];
    const types = new Set(w.flatMap((x) => Object.keys(x).filter((k) => k.endsWith('_type')).map((k) => x[k])));
    return w.length === 17 && w.some((x) => x.type === 'CUSTOM_WATER') && w.some((x) => x.type !== 'CUSTOM_WATER') && w.every((x) => x.sulfate === 0 && x.finished === false && minerals.every((k) => Number.isInteger(x[k])))
      && w.some((x) => minerals.some((k) => x[k] === 0)) && ['PPM', 'MG_L', 'UNKNOWN'].every((t) => types.has(t)) && w.some((x) => x.note !== '') && w.some((x) => x.note === '') && w.some((x) => x.attachments.length) && w.some((x) => !x.attachments.length);
  }],
  ['C46', 'buyDate, bestDate, openDate always ""', () => small.beans.every((b) => b.buyDate === '' && b.bestDate === '' && b.openDate === '')],
  ['C47', 'roastingDate: ms Z, no ms, midday UTC, one empty', () => {
    const d = small.beans.map((b) => b.roastingDate as string);
    return d.filter((x) => /\.\d{3}Z$/.test(x) && !x.endsWith('T12:00:00.000Z')).length > d.length * 0.7 && d.some((x) => /T\d\d:\d\d:\d\dZ$/.test(x)) && d.some((x) => x.endsWith('T12:00:00.000Z')) && d.filter((x) => x === '').length === 1;
  }],
  ['C48', 'bean rating 0 on ~37%, quarter and half steps up to 4.5', () => {
    const r = small.beans.map((b) => b.rating as number);
    return share(r, (x) => x === 0) > 0.2 && share(r, (x) => x === 0) < 0.5 && r.every((x) => x <= 4.5 && x * 4 === Math.round(x * 4)) && r.some((x) => x * 4 % 2 === 1) && r.some((x) => x * 2 === Math.round(x * 2) && x > 0);
  }],
  ['C49', 'finished ~75%; beans with no brews are all unfinished', () => {
    const used = new Set(small.brews.map((b) => b.bean));
    return share(small.beans, (b) => b.finished) > 0.55 && share(small.beans, (b) => b.finished) < 0.9 && small.beans.filter((b) => !used.has(b.config.uuid)).every((b) => b.finished === false);
  }],
  ['C50', 'bean weight with 0 and round values; cost with 0, integer, 1 dp, 2 dp', () => {
    const c = small.beans.map((b) => b.cost as number);
    return small.beans.some((b) => b.weight === 0) && small.beans.some((b) => b.weight === 60 || b.weight === 100) && c.some((x) => x === 0) && c.some((x) => x > 0 && Number.isInteger(x))
      && c.some((x) => Math.round(x * 10) === x * 10 && !Number.isInteger(x)) && c.some((x) => Math.round(x * 10) !== Math.round(x * 100) / 10);
  }],
  ['C51', 'SINGLE_ORIGIN and BLEND; blends of 1, 2, 3 parts; percentages sum to 100 or all 0; single-origin 100, 0, missing', () => {
    const bl = small.beans.filter((b) => b.beanMix === 'BLEND');
    const sums = bl.filter((b) => b.bean_information.length > 1).map((b) => b.bean_information.reduce((n: number, e: R) => n + (e.percentage ?? 0), 0));
    const so = small.beans.filter((b) => b.beanMix === 'SINGLE_ORIGIN').flatMap((b) => b.bean_information as R[]);
    return bl.length >= 3 && [1, 2, 3].every((k) => bl.some((b) => b.bean_information.length === k)) && sums.includes(100) && sums.includes(0)
      && so.some((e) => e.percentage === 100) && so.some((e) => e.percentage === 0) && so.some((e) => !('percentage' in e));
  }],
  ['C52', 'bean enums and roast_custom, roast_range 0 or half steps', () => {
    const v = (k: string) => new Set(small.beans.map((b) => b[k]));
    return ['FILTER', 'ESPRESSO', 'OMNI', 'UNKNOWN'].every((x) => v('bean_roasting_type').has(x)) && ['CUSTOM_ROAST', 'UNKNOWN', 'CINNAMON_ROAST', 'CITY_ROAST', 'MODERATE_LIGHT_ROAST'].every((x) => v('roast').has(x))
      && small.beans.some((b) => b.roast === 'CUSTOM_ROAST' && b.roast_custom !== '') && small.beans.every((b) => b.roast_range === 0 || (b.roast_range >= 0.5 && b.roast_range * 2 === Math.round(b.roast_range * 2))) && small.beans.some((b) => b.roast_range > 0);
  }],
  ['C53', 'bean_information: keys missing, {}, nulls, integer-like variety and harvest_time', () => {
    const e = small.beans.flatMap((b) => b.bean_information as R[]);
    return e.some((x) => Object.keys(x).length === 0) && e.some((x) => x.harvest_time === null) && e.some((x) => x.fob_price === null) && e.some((x) => x.purchasing_price === null)
      && e.some((x) => x.certification === null) && e.some((x) => x.percentage === null) && e.some((x) => /^\d+$/.test(x.variety ?? '')) && e.some((x) => /^\d+$/.test(x.harvest_time ?? ''))
      && e.some((x) => !('region' in x) || !('farm' in x));
  }],
  ['C54', 'bean note empty, null, long with newlines; url; ean; qr_code; share code', () => small.beans.some((b) => b.note === '') && small.beans.some((b) => b.note === null) && small.beans.some((b) => b.note && b.note.length >= 500 && b.note.includes('\n'))
    && share(small.beans, (b) => b.url !== '') > 0.7 && small.beans.some((b) => b.ean_article_number === '') && small.beans.some((b) => b.ean_article_number === null)
    && small.beans.some((b) => b.qr_code?.length === 8) && small.beans.some((b) => b.qr_code === '') && small.beans.some((b) => !('qr_code' in b)) && small.beans.some((b) => b.internal_share_code.length === 6)
    && small.beans.some((b) => b.internal_share_code === '')],
  ['C55', 'bean attachments: 0, 1, 2, 3, 10', () => [0, 1, 2, 3, 10].every((n) => small.beans.some((b) => b.attachments.length === n))],
  ['C56', 'non-ASCII leading symbols, accents, zero-width char, repeat names (same and other roast date), padded names', () => {
    const byName = new Map<string, R[]>();
    for (const b of small.beans) byName.set(b.name, [...(byName.get(b.name) ?? []), b]);
    const rep = [...byName.values()].filter((l) => l.length > 1);
    return share(small.beans, (b) => /^\P{ASCII}/u.test(b.name)) > 0.9 && share(small.beans, (b) => /^\P{ASCII}/u.test(b.roaster)) > 0.9 && share(small.beans.flatMap((b) => b.bean_information), (e: R) => /^\P{ASCII}/u.test(e.country ?? 'x')) > 0.8
      && small.beans.some((b) => /[à-ÿ]/.test(b.name)) && small.beans.some((b) => b.aromatics.includes('\u200B')) && rep.some((l) => l.some((x) => x.roastingDate === l[0].roastingDate && x !== l[0]))
      && rep.some((l) => l.some((x) => x.roastingDate !== l[0].roastingDate)) && small.beans.some((b) => b.name !== b.name.trim());
  }],
  ['C57', 'frozen portions: ~15%, storage types, 6-char ids, groups of 2+ with one name/roaster/roast date, mixed and fully frozen groups', () => {
    const fz = small.beans.filter((b) => b.frozenDate !== '');
    const groups = new Map<string, R[]>();
    for (const b of small.beans) if (b.frozenGroupId) groups.set(b.frozenGroupId, [...(groups.get(b.frozenGroupId) ?? []), b]);
    const multi = [...groups.values()].filter((g) => g.length > 1);
    return share(small.beans, (b) => b.frozenDate !== '') > 0.06 && share(small.beans, (b) => b.frozenDate !== '') < 0.3
      && ['TUBE', 'COFFEE_BAG', 'VACUUM_SEALED', 'UNKNOWN'].every((t) => small.beans.some((b) => b.frozenStorageType === t)) && fz.every((b) => b.frozenId.length === 6)
      && multi.length >= 3 && multi.every((g) => g.every((b) => b.name === g[0].name && b.roaster === g[0].roaster && b.roastingDate === g[0].roastingDate)) && multi.some((g) => new Set(g.map((b) => b.weight)).size > 1)
      && multi.some((g) => g.some((b) => b.frozenDate) && g.some((b) => !b.frozenDate)) && multi.some((g) => g.every((b) => b.frozenDate)) && Math.max(...multi.map((g) => g.length)) >= 3;
  }],
  ['C58', 'group id on an unfrozen bean; frozen id without a date; frozen bean without a group', () => small.beans.some((b) => b.frozenGroupId && !b.frozenDate) && small.beans.some((b) => b.frozenId && !b.frozenDate)
    && small.beans.some((b) => b.frozenDate && !b.frozenGroupId)],
  ['C59', 'unfrozenDate after frozenDate, one the same day', () => {
    const u = small.beans.filter((b) => b.unfrozenDate !== '');
    const days = u.map((b) => (Date.parse(b.unfrozenDate) - Date.parse(b.frozenDate)) / 86400000);
    return u.length >= 2 && days.every((d) => d >= 0) && days.some((d) => d === 0) && days.some((d) => d > 0);
  }],
  ['C60', 'beans with 1, 2, 3-9 and 10+ brews; ~19% with none; a brew on a frozen bean', () => {
    const n = new Map<string, number>();
    for (const b of small.brews) n.set(b.bean, (n.get(b.bean) ?? 0) + 1);
    const v = [...n.values()];
    const zero = share(small.beans, (b) => !n.has(b.config.uuid));
    return v.some((x) => x === 1) && v.some((x) => x === 2) && v.some((x) => x >= 3 && x <= 9) && v.some((x) => x >= 10) && zero > 0.08 && zero < 0.3
      && small.brews.some((b) => beanByUuid.get(b.bean)!.frozenDate !== '');
  }],
  ['C61', 'a brew on a bean older than 120 days; none before the roast date', () => {
    const age = small.brews.filter((b) => beanByUuid.get(b.bean)!.roastingDate !== '').map((b) => b.config.unix_timestamp - Date.parse(beanByUuid.get(b.bean)!.roastingDate) / 1000);
    return age.some((a) => a > 120 * 86400) && age.every((a) => a > 0);
  }],
  ['C62', 'flow files with the 8-key and the 12-key set', () => {
    const k = new Set([...flows.values()].map((f) => Object.keys(f).length));
    return k.has(8) && k.has(12) && [...flows.values()].filter((f) => 'customMetrics' in f).every((f) => JSON.stringify(f.customMetrics) === '{}');
  }],
  ['C63', 'weight, waterFlow, realtimeFlow filled and near equal; the other arrays empty', () => [...flows.entries()].filter(([id, f]) => brewByUuid.has(id) && f.weight.length > 0).every(([, f]) =>
    f.waterFlow.length === f.weight.length - 2 && f.realtimeFlow.length === f.weight.length && ['weightSecond', 'realtimeFlowSecond', 'temperatureFlow', 'brewbyweight'].every((k) => f[k].length === 0))],
  ['C64', 'element shapes: brew_time "s.k", wall-clock timestamps with ms', () => {
    const f = [...flows.values()].find((x) => x.pressureFlow.length > 0 && x.weight.length > 0)!;
    const keys = (o: R) => Object.keys(o).join(',');
    return keys(f.weight[0]) === 'timestamp,brew_time,actual_weight,old_weight,actual_smoothed_weight,old_smoothed_weight,not_mutated_weight' && keys(f.waterFlow[0]) === 'brew_time,timestamp,value'
      && keys(f.realtimeFlow[0]) === 'brew_time,timestamp,smoothed_weight,timestampdelta,flow_value' && keys(f.pressureFlow[0]) === 'timestamp,brew_time,actual_pressure,old_pressure'
      && [...f.weight, ...f.pressureFlow].every((e: R) => /^\d+\.\d+$/.test(e.brew_time) && /^\d\d:\d\d:\d\d\.\d{3}$/.test(e.timestamp));
  }],
  ['C65', 'irregular sampling; durations from seconds to over 100 s', () => {
    const w = [...flows.values()].filter((f) => f.weight.length > 5);
    const steps = w.flatMap((f) => f.weight.slice(1).map((e: R, i: number) => clockMs(e.timestamp) - clockMs(f.weight[i].timestamp)));
    const dur = w.map((f) => clockMs(f.weight.at(-1).timestamp) - clockMs(f.weight[0].timestamp));
    return median(steps) <= 250 && steps.some((s) => s >= 500) && steps.some((s) => s >= 2000) && Math.max(...dur) > 100000 && Math.min(...dur) < 15000;
  }],
  ['C66', 'weight ends at the yield; a negative dip; a drop over 2 g; one flow spike', () => {
    const shots = small.esp.filter((b) => flowOf(b)?.weight.length && b.brew_beverage_quantity > 20);
    const endsAtYield = share(shots, (b) => { const m = Math.max(...flowOf(b)!.weight.map((e: R) => e.actual_smoothed_weight)); return Math.abs(m - b.brew_beverage_quantity) <= b.brew_beverage_quantity * 0.02; });
    const ws = [...flows.values()].flatMap((f) => (f.weight as R[]).map((e) => e.actual_smoothed_weight as number));
    return endsAtYield > 0.9 && ws.some((x) => x < -1) && [...flows.values()].some((f) => (f.weight as R[]).some((e, i, a) => i > 0 && a[i - 1].actual_smoothed_weight - e.actual_smoothed_weight > 2))
      && [...flows.values()].some((f) => (f.realtimeFlow as R[]).some((e) => e.flow_value > 1000));
  }],
  ['C67', 'weight-only and weight+pressure files (~38%), pressure starting slightly after the weight', () => {
    const own = [...flows.entries()].filter(([id, f]) => brewByUuid.has(id) && f.weight.length > 0);
    const withP = own.filter(([, f]) => f.pressureFlow.length > 0);
    return withP.length > 0 && withP.length < own.length && withP.length / own.length > 0.2 && withP.length / own.length < 0.6
      && withP.every(([, f]) => clockMs(f.pressureFlow[0].timestamp) > clockMs(f.weight[0].timestamp));
  }],
  ['C68', 'pressure families: low steady/gentle/steep, high flat/gentle/steep, mid, slow start, pre-infusion, tail to 0, one over 100 s', () => {
    const fam = small.out.families;
    const names = new Set(Object.values(fam));
    const ofFam = (n: string) => Object.entries(fam).filter(([, f]) => f === n).map(([id]) => pCurve(id));
    const t50 = (c: { t: number; p: number }[]) => c.find((x) => x.p >= 0.5 * peakOf(c))!.t;
    return ['low-steady', 'low-gentle', 'low-steep', 'high-flat', 'high-gentle', 'high-steep', 'mid', 'slow-start', 'pre-infusion', 'long-flat'].every((n) => names.has(n))
      && ['low-steady', 'low-gentle', 'low-steep'].every((n) => ofFam(n).every((c) => peakOf(c) < 4))
      && ['high-flat', 'high-gentle', 'high-steep'].every((n) => ofFam(n).every((c) => peakOf(c) >= 9.5 && peakOf(c) <= 11.5))
      && ofFam('mid').every((c) => peakOf(c) >= 4 && peakOf(c) <= 8) && ofFam('slow-start').every((c) => t50(c) >= 5.5)
      && ofFam('pre-infusion').every((c) => c.filter((x) => x.t < 4).every((x) => x.p < 0.45 * peakOf(c)))
      && Object.keys(fam).every((id) => { const c = pCurve(id); return c.at(-1)!.p <= 1.5 || c.at(-1)!.p === -0.3; })
      && ofFam('long-flat').every((c) => c.at(-1)!.t > 100);
  }],
  ['C69', 'a brew_time reset inside a file; a negative pressure reading', () => [...flows.values()].some((f) => (f.weight as R[]).some((e, i, a) => i > 0 && secs(e) < secs(a[i - 1])))
    && [...flows.values()].some((f) => (f.pressureFlow as R[]).some((e) => e.actual_pressure < 0))],
  ['C70', 'an orphan file with all arrays empty', () => [...flows.entries()].some(([id, f]) => !brewByUuid.has(id) && f.weight.length === 0 && f.pressureFlow.length === 0 && f.realtimeFlow.length === 0)],
  ['C71', 'a bean referenced only from a Beans file', () => small.brews.some((b) => !small.main.BEANS.some((x: R) => x.config.uuid === b.bean) && small.beanFiles.flat().some((x) => x.config.uuid === b.bean))],
  ['C72', 'the flow link is the brew own uuid, never the flow_profile string', () => small.brews.filter((b) => b.flow_profile !== '').every((b) => flows.has(b.config.uuid) && !flows.has(b.flow_profile.slice(6, 42)))],
  ['C73', 'a water with a PPM unit', () => small.main.WATER.some((w: R) => Object.keys(w).some((k) => k.endsWith('_type') && w[k] === 'PPM'))],
  ['C74', 'no has_adjustable_speed on MILL', () => small.main.MILL.every((m: R) => Object.keys(m).sort().join() === 'attachments,config,finished,name,note')]
];
function style0(b: R) { return small.style(b); }

describe('mock espresso export, small: every coverage case', () => {
  for (const [id, text, check] of cases) it(`${id}: ${text}`, () => expect(check()).toBe(true));
  it('covers C1 to C74', () => expect(cases.map(([id]) => id).sort()).toEqual(Array.from({ length: 74 }, (_, i) => `C${i + 1}`).sort()));
});

describe('mock espresso export, full: the real export rates', () => {
  const full = load('full');
  const flowNames = Object.keys(full.out.flowFiles);
  const espBrews = full.esp;
  it('is the real export size', () => {
    expect(full.brews.length).toBe(2300);
    expect(full.beans.length).toBe(1530);
    expect(full.brewFiles.slice(0, -1).every((f) => f.length === 500)).toBe(true);
  });
  it('is about 90% espresso', () => expect(espBrews.length / full.brews.length).toBeGreaterThan(0.87));
  it('fills dose, yield, time, drip and temperature at the real rates', () => {
    const n = espBrews.length;
    const inRange = (x: number, lo: number, hi: number) => { expect(x).toBeGreaterThan(lo); expect(x).toBeLessThan(hi); };
    inRange(share(espBrews, (b) => b.grind_weight > 0), 0.99, 1.001);
    inRange(share(espBrews, (b) => b.brew_beverage_quantity > 0), 0.99, 1.001);
    inRange(share(espBrews, (b) => b.brew_time > 0), 0.58, 0.78);
    inRange(share(espBrews, (b) => b.coffee_first_drip_time > 0), 0.55, 0.75);
    inRange(share(espBrews, (b) => b.brew_temperature > 0), 0.46, 0.62);
    expect(n).toBeGreaterThan(2000);
  });
  it('has a median ratio near 1:3 and the real ratio shares', () => {
    const r = espBrews.filter((b) => b.grind_weight > 0 && b.brew_beverage_quantity > 0).map((b) => b.brew_beverage_quantity / b.grind_weight);
    expect(median(r)).toBeGreaterThan(2.85);
    expect(median(r)).toBeLessThan(3.25);
    expect(share(r, (x) => x > 2.5)).toBeGreaterThan(0.84);
    expect(share(r, (x) => x > 4)).toBeLessThan(0.12);
  });
  it('has flow files for 55-70% of espresso and pressure on 30-45% of flow files', () => {
    const flowShare = flowNames.length;
    const own = espBrews.filter((b) => b.flow_profile !== '');
    expect(own.length / espBrews.length).toBeGreaterThan(0.55);
    expect(own.length / espBrews.length).toBeLessThan(0.7);
    const withP = Object.values(full.out.families).length;
    expect(withP / flowShare).toBeGreaterThan(0.25);
    expect(withP / flowShare).toBeLessThan(0.45);
  });
  it('rates 55-72% of beans and freezes 10-20%', () => {
    expect(share(full.beans, (b) => b.rating > 0)).toBeGreaterThan(0.55);
    expect(share(full.beans, (b) => b.rating > 0)).toBeLessThan(0.72);
    expect(share(full.beans, (b) => b.frozenDate !== '')).toBeGreaterThan(0.1);
    expect(share(full.beans, (b) => b.frozenDate !== '')).toBeLessThan(0.2);
    expect(share(full.beans, (b) => b.finished)).toBeGreaterThan(0.68);
    expect(share(full.beans, (b) => b.finished)).toBeLessThan(0.82);
  });
  it('rates 1-4% of brews', () => {
    expect(share(full.brews, (b) => b.rating > 0)).toBeGreaterThan(0.01);
    expect(share(full.brews, (b) => b.rating > 0)).toBeLessThan(0.04);
  });
});

describe('mock espresso export, determinism and reader', () => {
  it('gives byte-identical output for one seed and a different one for another', () => {
    const a = mockEspressoExport({ size: 'small', seed: 7 }), b = mockEspressoExport({ size: 'small', seed: 7 }), c = mockEspressoExport({ size: 'small', seed: 8 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
  it('is read and imported by the current reader (Beans_N beans are #186)', async () => {
    const zip = await zipOf(small.out.zipFiles);
    const parsed = parseBeanConquerorJson(await readBeanConquerorZip(zip));
    expect(parsed.brews.length).toBe(330);
    expect(parsed.beans.length).toBe(100);
    const db = createDb(':memory:');
    importBeanConquerorData(db, parsed);
    expect((db.prepare('SELECT COUNT(*) n FROM beanconqueror_brews').get() as { n: number }).n).toBe(330);
  });
});
