// src/lib/server/beanConquerorJson.ts
// Bean Conqueror's regular export (Beanconqueror.zip, JSON) → ParsedBeanConquerorData.
// Spec: docs/superpowers/specs/2026-10-09-beanconqueror-json-import-design.md.
import type {
  ParsedBean, ParsedBeanConquerorData, ParsedBeanOrigin, ParsedBrew, ParsedGrinder, ParsedMethod, ParsedWater
} from './beanconqueror';

export interface BeanConquerorJsonFiles {
  main: unknown; // Beanconqueror.json: BEANS, PREPARATION, MILL, WATER, BREWS (first 500)
  brewFiles: unknown[]; // Beanconqueror_Brews_N.json: the remaining brews, any order
}

// The xlsx import stored Bean Conqueror's local wall clock with a 'Z' (its text
// timestamps were parsed as UTC), and stats bucket by date(bc_created_at). Measured on
// the 2026-10-09 export: America/Denver matched every bean and every already-imported
// brew. ponytail: fixed zone; make it a setting if the user ever logs brews elsewhere.
export const BC_TIME_ZONE = 'America/Denver';
const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: BC_TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});

export function bcTimestamp(unixSeconds: number): string {
  const p = Object.fromEntries(wallClock.formatToParts(new Date(unixSeconds * 1000)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000Z`;
}

// roastingDate is 'YYYY-MM-DD' or a full ISO instant; the xlsx gave the local date.
export function bcRoastDate(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : bcTimestamp(ms / 1000).slice(0, 10);
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
// Like excelHelpers' cellText: trimmed, '' → null; numbers become text ('150').
const text = (v: unknown): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const uuid = (e: Obj) => text(obj(e.config).uuid);
const created = (e: Obj) => {
  const t = num(obj(e.config).unix_timestamp);
  return t == null ? null : bcTimestamp(t);
};
// FILTER → Filter, SINGLE_ORIGIN → Single Origin: the xlsx export's labels.
const label = (v: unknown) =>
  text(v)?.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') ?? null;

export function parseBeanConquerorJson(files: BeanConquerorJsonFiles): ParsedBeanConquerorData {
  const main = obj(files.main);
  if (!Array.isArray(main.BEANS) || !Array.isArray(main.BREWS)) {
    throw new Error("That file doesn't look like a Bean Conqueror export (no BEANS or BREWS in Beanconqueror.json)");
  }
  const extraBrews = files.brewFiles.flatMap((f) => {
    if (!Array.isArray(f)) throw new Error('A Beanconqueror_Brews file is not a list of brews');
    return list(f);
  });

  const beans: ParsedBean[] = [];
  const beanOrigins: ParsedBeanOrigin[] = [];
  for (const b of list(main.BEANS)) {
    const id = uuid(b);
    const name = text(b.name);
    if (!id || !name) continue;
    beans.push({
      id, name, roaster: text(b.roaster), roastDate: bcRoastDate(b.roastingDate),
      roastType: label(b.bean_roasting_type), degreeOfRoast: num(b.roast_range),
      customDegreeOfRoast: text(b.roast_custom), blend: label(b.beanMix), weightG: num(b.weight),
      cost: num(b.cost), aromatics: text(b.aromatics), cuppingPoints: text(b.cupping_points),
      decaffeinated: b.decaffeinated === true, url: text(b.url), eanArticleNumber: text(b.ean_article_number),
      notes: text(b.note), rating: num(b.rating), bcCreatedAt: created(b), bcArchived: b.finished === true
    });
    list(b.bean_information).forEach((o, i) => {
      const origin = {
        country: text(o.country), region: text(o.region), farm: text(o.farm), farmer: text(o.farmer),
        elevation: text(o.elevation), variety: text(o.variety), processing: text(o.processing),
        certification: text(o.certification), harvested: text(o.harvest_time), percentage: num(o.percentage) || null
      };
      if (Object.values(origin).some((v) => v != null)) beanOrigins.push({ beanId: id, componentNumber: i + 1, ...origin });
    });
  }

  const toolNames = new Map<string, string>();
  const methods: ParsedMethod[] = list(main.PREPARATION).flatMap((m) => {
    const id = uuid(m);
    if (!id) return [];
    const tools = list(m.tools).flatMap((t) => {
      const name = text(t.name);
      const toolId = uuid(t);
      if (name && toolId) toolNames.set(toolId, name);
      return name ? [name] : [];
    });
    return [{
      id, preparationMethod: text(m.type), name: text(m.name), preparationStyle: text(m.style_type),
      preparationTools: tools.join(', ') || null, notes: text(m.note), bcArchived: m.finished === true,
      bcCreatedAt: created(m)
    }];
  });

  const grinders: ParsedGrinder[] = list(main.MILL).flatMap((g) => {
    const id = uuid(g);
    return id ? [{ id, name: text(g.name), notes: text(g.note), bcArchived: g.finished === true, bcCreatedAt: created(g) }] : [];
  });

  // Minerals' *_type is MG_L or UNKNOWN in every real profile: stored as plain mg/L.
  const waters: ParsedWater[] = list(main.WATER).flatMap((w) => {
    const id = uuid(w);
    const name = text(w.name);
    if (!id || !name) return [];
    return [{
      id, name, calcium: num(w.calcium), magnesium: num(w.magnesium), sodium: num(w.sodium),
      potassium: num(w.potassium), chloride: num(w.chloride), sulfate: num(w.sulfate), tds: num(w.tds),
      storedGh: num(w.general_hardness), storedGhType: text(w.general_hardness_type),
      storedKh: num(w.total_alkalinity), storedKhType: text(w.total_alkalinity_type),
      type: text(w.type), note: text(w.note), bcArchived: w.finished === true
    }];
  });

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const waterName = new Map(waters.map((w) => [w.id, w.name]));
  const brews: ParsedBrew[] = [...list(main.BREWS), ...extraBrews].flatMap((br) => {
    const bcUuid = uuid(br) ?? undefined; // blank → none (the import looks up by truthiness)
    const bcCreatedAt = created(br);
    if (!bcCreatedAt) return [];
    const beanId = text(br.bean);
    const bean = beanId ? beanById.get(beanId) : undefined;
    const dose = num(br.grind_weight);
    const waterAmount = num(br.brew_quantity);
    const beverage = num(br.brew_beverage_quantity);
    const tds = num(br.tds);
    const ratioWater = waterAmount || beverage; // espresso logs only the beverage
    const waterId = text(br.water);
    const knownWater = waterId && waterName.has(waterId) ? waterId : null;
    const toolIds = Array.isArray(br.method_of_preparation_tools) ? br.method_of_preparation_tools : [];
    return [{
      bcUuid, bcCreatedAt, beanId, preparationId: text(br.method_of_preparation), millId: text(br.mill),
      grindSetting: text(br.grind_size), groundCoffeeG: dose, brewTemperature: num(br.brew_temperature),
      beanType: bean?.name ?? null, grindSpeedRpm: num(br.mill_speed), grindTime: text(br.mill_timer),
      profile: text(br.pressure_profile),
      preparationTools: toolIds.flatMap((t) => toolNames.get(String(t)) ?? []).join(', ') || null,
      temperatureTime: text(br.brew_temperature_time), brewTime: text(br.brew_time),
      bloomTime: text(br.coffee_blooming_time), firstDripTime: text(br.coffee_first_drip_time),
      waterAmountG: waterAmount, coffeeType: text(br.coffee_type), coffeeConcentration: text(br.coffee_concentration),
      rating: num(br.rating), notes: text(br.note), beverageQuantity: beverage, tdsPercent: tds,
      extractionYieldPercent: dose && beverage && tds ? (beverage * tds) / dose : 0,
      brewRatio: dose && ratioWater ? `1 / ${(ratioWater / dose).toFixed(2)}` : null,
      beanAgeDays: bean?.roastDate
        ? Math.round((Date.parse(bcCreatedAt.slice(0, 10)) - Date.parse(bean.roastDate)) / 86_400_000)
        : null,
      bcArchived: bean?.bcArchived ?? false,
      water: knownWater ? waterName.get(knownWater)! : null, waterId: knownWater,
      bestBrew: br.best_brew === true, favourite: br.favourite === true, vesselName: text(br.vessel_name),
      hasFlowProfile: text(br.flow_profile) != null
    }];
  });

  return { beans, beanOrigins, methods, grinders, brews, waters };
}
