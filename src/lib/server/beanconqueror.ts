import type { DatabaseSync } from 'node:sqlite';
import type ExcelJS from 'exceljs';
import { autoLinkBeanConquerorBeans } from './beanConquerorLinks';
import { cellText, cellNumber, cellBoolean, excelSerialToISODate, excelSerialToISOTimestamp } from './excelHelpers';

export interface ParsedBean {
  id: string;
  name: string;
  roaster: string | null;
  roastDate: string | null;
  roastType: string | null;
  degreeOfRoast: number | null;
  customDegreeOfRoast: string | null;
  blend: string | null;
  weightG: number | null;
  cost: number | null;
  aromatics: string | null;
  cuppingPoints: string | null;
  decaffeinated: boolean;
  url: string | null;
  eanArticleNumber: string | null;
  notes: string | null;
  rating: number | null;
  bcCreatedAt: string | null;
  bcArchived: boolean;
}

export interface ParsedBeanOrigin {
  beanId: string;
  componentNumber: number;
  country: string | null;
  region: string | null;
  farm: string | null;
  farmer: string | null;
  elevation: string | null;
  variety: string | null;
  processing: string | null;
  certification: string | null;
  harvested: string | null;
  percentage: number | null;
}

export interface ParsedMethod {
  id: string;
  preparationMethod: string | null;
  name: string | null;
  preparationStyle: string | null;
  preparationTools: string | null;
  notes: string | null;
  bcArchived: boolean;
  bcCreatedAt: string | null;
}

export interface ParsedGrinder {
  id: string;
  name: string | null;
  notes: string | null;
  bcArchived: boolean;
  bcCreatedAt: string | null;
}

export interface ParsedBrew {
  bcCreatedAt: string;
  beanId: string | null;
  preparationId: string | null;
  millId: string | null;
  grindSetting: string | null;
  groundCoffeeG: number | null;
  brewTemperature: number | null;
  beanType: string | null;
  grindSpeedRpm: number | null;
  grindTime: string | null;
  profile: string | null;
  preparationTools: string | null;
  temperatureTime: string | null;
  brewTime: string | null;
  bloomTime: string | null;
  firstDripTime: string | null;
  waterAmountG: number | null;
  coffeeType: string | null;
  coffeeConcentration: string | null;
  rating: number | null;
  notes: string | null;
  beverageQuantity: number | null;
  tdsPercent: number | null;
  extractionYieldPercent: number | null;
  brewRatio: string | null;
  beanAgeDays: number | null;
  bcArchived: boolean;
  water: string | null;
}

export interface ParsedBeanConquerorData {
  beans: ParsedBean[];
  beanOrigins: ParsedBeanOrigin[];
  methods: ParsedMethod[];
  grinders: ParsedGrinder[];
  brews: ParsedBrew[];
}

const BEAN_FIXED_COLUMN_COUNT = 20;
const BEAN_ORIGIN_GROUP_SIZE = 10;

// Every parser below reads fixed column INDEXES (`get(19)` is the Bean Id,
// and so on). That's fast and simple, but it silently writes garbage into
// the wrong fields if Bean Conqueror ever inserts or reorders a column in
// their export — every field past the insertion point shifts by one and
// nothing errors. These arrays pin the expected header text at each of
// those fixed positions so a format change fails loudly, at import time,
// instead of quietly corrupting the database.
//
// Index 0 of each array is column 1, matching the `get(N)` calls below.
// The Beans sheet's "Roast type" really does appear twice (columns 4 and
// 6) in the real export — that's upstream's doing, not a typo here.
const BEANS_EXPECTED_HEADERS = [
  'Name', 'Roaster', 'Roast date', 'Roast type', 'Degree of Roast',
  'Roast type', 'Custom degree of Roast', 'Blend', 'Weight', 'Cost',
  'Flavour profile', 'Cupping points', 'Decaffeinated', 'Website',
  'EAN / Articlenumber', 'Notes', 'Rating', 'Creation date',
  'Bean Id', 'Archived'
];

// Header labels for one blend component group (columns 21-30, 31-40, ...).
// Repeated as "N. <label>" for each component 1..maxComponents present in
// the sheet — see parseBeans's maxComponents computation below.
const BEAN_ORIGIN_GROUP_HEADERS = [
  'Country', 'Region', 'Farm', 'Farmer', 'Elevation', 'Variety',
  'Processing', 'Harvested', 'Percentage', 'Bean certification'
];

function maxBeanComponents(worksheet: ExcelJS.Worksheet): number {
  return Math.max(0, Math.floor((worksheet.columnCount - BEAN_FIXED_COLUMN_COUNT) / BEAN_ORIGIN_GROUP_SIZE));
}

// The Beans sheet's expected headers, extended with one "N. *" group per
// blend component actually present in this worksheet — so a renamed or
// reordered blend column aborts the import the same way a fixed-column
// mismatch does, instead of silently writing garbage into beanOrigins.
function beansExpectedHeaders(worksheet: ExcelJS.Worksheet): string[] {
  const expected = [...BEANS_EXPECTED_HEADERS];
  for (let n = 1; n <= maxBeanComponents(worksheet); n++) {
    for (const label of BEAN_ORIGIN_GROUP_HEADERS) expected.push(`${n}. ${label}`);
  }
  return expected;
}

const BREWS_EXPECTED_HEADERS = [
  'Grind Setting', 'Ground Coffee (gr)', 'Brew Temperature', 'Preparation method',
  'Bean Type', 'Grinder', 'Grind Speed (rpm)', 'Grind Time', 'Profile',
  'Preparation tools', 'Temperature Time', 'Time', 'Bloom Time / Pre-infusion',
  'First drip time', 'Amount of water', 'Coffee Type', 'Coffee Concentration',
  'Rating', 'Notes', 'Beverage quantity', 'Total dissolved solids %',
  'Extraction Yield %', 'Creation Date', 'Brew Ratio', 'Bean Age',
  'Archived', 'Bean Id', 'Preparation Id', 'Mill Id', 'Water'
];

const METHODS_EXPECTED_HEADERS = [
  'Preparation method', 'Name', 'Preparation style', 'Preparation tools',
  'Notes', 'Archived', 'Creation date', 'Preparation Id'
];

const GRINDERS_EXPECTED_HEADERS = ['Name', 'Notes', 'Archived', 'Creation date', 'Mill Id'];

// Whether this sheet has anything the parsers would actually read. A sheet
// with no data rows can't corrupt anything no matter what its header row
// says, so header validation skips it — that keeps a genuinely empty
// (or header-less placeholder) sheet from aborting an otherwise fine
// import. The row filter matches what the parsers themselves iterate.
function hasDataRows(worksheet: ExcelJS.Worksheet): boolean {
  let found = false;
  worksheet.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    if (rowNumber > 1) found = true;
  });
  return found;
}

function validateHeaders(
  worksheet: ExcelJS.Worksheet | undefined,
  sheetName: string,
  expected: string[]
): void {
  if (!worksheet || !hasDataRows(worksheet)) return;
  const headerRow = worksheet.getRow(1);
  for (let i = 0; i < expected.length; i++) {
    const column = i + 1;
    const actual = cellText(headerRow.getCell(column).value);
    // Compared case-insensitively and trimmed: upstream has been known to
    // adjust capitalization/spacing without changing the column's meaning,
    // and only a genuine rename or reorder should abort an import.
    if ((actual ?? '').toLowerCase() !== expected[i].toLowerCase()) {
      throw new Error(
        `Bean Conqueror export format has changed: expected column ${column} of the ${sheetName} sheet to be ` +
          `'${expected[i]}', found '${actual ?? ''}'. Import aborted — the parsing logic needs to be updated ` +
          `for the new format.`
      );
    }
  }
}

function parseBeans(worksheet: ExcelJS.Worksheet | undefined): { beans: ParsedBean[]; beanOrigins: ParsedBeanOrigin[] } {
  const beans: ParsedBean[] = [];
  const beanOrigins: ParsedBeanOrigin[] = [];
  if (!worksheet) return { beans, beanOrigins };

  const maxComponents = maxBeanComponents(worksheet);

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (col: number) => row.getCell(col).value;
    const id = cellText(get(19));
    const name = cellText(get(1));
    if (!id || !name) return;

    beans.push({
      id,
      name,
      roaster: cellText(get(2)),
      roastDate: excelSerialToISODate(get(3)),
      roastType: cellText(get(4)),
      degreeOfRoast: cellNumber(get(5)),
      customDegreeOfRoast: cellText(get(7)),
      blend: cellText(get(8)),
      weightG: cellNumber(get(9)),
      cost: cellNumber(get(10)),
      aromatics: cellText(get(11)),
      cuppingPoints: cellText(get(12)),
      decaffeinated: cellBoolean(get(13)),
      url: cellText(get(14)),
      eanArticleNumber: cellText(get(15)),
      notes: cellText(get(16)),
      rating: cellNumber(get(17)),
      bcCreatedAt: excelSerialToISOTimestamp(get(18)),
      bcArchived: cellBoolean(get(20))
    });

    for (let n = 1; n <= maxComponents; n++) {
      const base = BEAN_FIXED_COLUMN_COUNT + (n - 1) * BEAN_ORIGIN_GROUP_SIZE;
      const country = cellText(get(base + 1));
      const region = cellText(get(base + 2));
      const farm = cellText(get(base + 3));
      const farmer = cellText(get(base + 4));
      const elevation = cellText(get(base + 5));
      const variety = cellText(get(base + 6));
      const processing = cellText(get(base + 7));
      const harvested = cellText(get(base + 8));
      const percentage = cellNumber(get(base + 9));
      const certification = cellText(get(base + 10));
      const hasAny =
        country || region || farm || farmer || elevation || variety || processing || harvested || percentage != null || certification;
      if (!hasAny) continue;
      beanOrigins.push({
        beanId: id,
        componentNumber: n,
        country,
        region,
        farm,
        farmer,
        elevation,
        variety,
        processing,
        certification,
        harvested,
        percentage
      });
    }
  });

  return { beans, beanOrigins };
}

function parseBrews(worksheet: ExcelJS.Worksheet | undefined): ParsedBrew[] {
  const brews: ParsedBrew[] = [];
  if (!worksheet) return brews;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (col: number) => row.getCell(col).value;
    const bcCreatedAt = excelSerialToISOTimestamp(get(23));
    if (!bcCreatedAt) return;
    brews.push({
      bcCreatedAt,
      grindSetting: cellText(get(1)),
      groundCoffeeG: cellNumber(get(2)),
      brewTemperature: cellNumber(get(3)),
      beanType: cellText(get(5)),
      grindSpeedRpm: cellNumber(get(7)),
      grindTime: cellText(get(8)),
      profile: cellText(get(9)),
      preparationTools: cellText(get(10)),
      temperatureTime: cellText(get(11)),
      brewTime: cellText(get(12)),
      bloomTime: cellText(get(13)),
      firstDripTime: cellText(get(14)),
      waterAmountG: cellNumber(get(15)),
      coffeeType: cellText(get(16)),
      coffeeConcentration: cellText(get(17)),
      rating: cellNumber(get(18)),
      notes: cellText(get(19)),
      beverageQuantity: cellNumber(get(20)),
      tdsPercent: cellNumber(get(21)),
      extractionYieldPercent: cellNumber(get(22)),
      brewRatio: cellText(get(24)),
      beanAgeDays: cellNumber(get(25)),
      bcArchived: cellBoolean(get(26)),
      beanId: cellText(get(27)),
      preparationId: cellText(get(28)),
      millId: cellText(get(29)),
      water: cellText(get(30))
    });
  });
  return brews;
}

function parseMethods(worksheet: ExcelJS.Worksheet | undefined): ParsedMethod[] {
  const methods: ParsedMethod[] = [];
  if (!worksheet) return methods;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (col: number) => row.getCell(col).value;
    const id = cellText(get(8));
    if (!id) return;
    methods.push({
      id,
      preparationMethod: cellText(get(1)),
      name: cellText(get(2)),
      preparationStyle: cellText(get(3)),
      preparationTools: cellText(get(4)),
      notes: cellText(get(5)),
      bcArchived: cellBoolean(get(6)),
      bcCreatedAt: excelSerialToISOTimestamp(get(7))
    });
  });
  return methods;
}

function parseGrinders(worksheet: ExcelJS.Worksheet | undefined): ParsedGrinder[] {
  const grinders: ParsedGrinder[] = [];
  if (!worksheet) return grinders;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (col: number) => row.getCell(col).value;
    const id = cellText(get(5));
    if (!id) return;
    grinders.push({
      id,
      name: cellText(get(1)),
      notes: cellText(get(2)),
      bcArchived: cellBoolean(get(3)),
      bcCreatedAt: excelSerialToISOTimestamp(get(4))
    });
  });
  return grinders;
}

export function parseBeanConquerorWorkbook(workbook: ExcelJS.Workbook): ParsedBeanConquerorData {
  // Validate every sheet's headers before parsing a single data row, so a
  // changed export format aborts the whole import rather than half-writing
  // shifted values.
  const beansWorksheet = workbook.getWorksheet('Beans');
  // Every real export has a Beans sheet; without one this is some other
  // workbook, which would otherwise "import" nothing and report success.
  if (!beansWorksheet) {
    throw new Error("That file doesn't look like a Bean Conqueror export (no Beans sheet)");
  }
  validateHeaders(beansWorksheet, 'Beans', beansExpectedHeaders(beansWorksheet));
  validateHeaders(workbook.getWorksheet('Brews'), 'Brews', BREWS_EXPECTED_HEADERS);
  validateHeaders(workbook.getWorksheet('Methods'), 'Methods', METHODS_EXPECTED_HEADERS);
  validateHeaders(workbook.getWorksheet('Grinders'), 'Grinders', GRINDERS_EXPECTED_HEADERS);

  const { beans, beanOrigins } = parseBeans(workbook.getWorksheet('Beans'));
  return {
    beans,
    beanOrigins,
    methods: parseMethods(workbook.getWorksheet('Methods')),
    grinders: parseGrinders(workbook.getWorksheet('Grinders')),
    brews: parseBrews(workbook.getWorksheet('Brews'))
  };
}

export function importBeanConquerorData(db: DatabaseSync, parsed: ParsedBeanConquerorData): void {
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    // Auto-link only considers beans that are new in this import.
    const existingBeanIds = new Set(
      (db.prepare(`SELECT id FROM beanconqueror_beans`).all() as { id: string }[]).map((r) => r.id)
    );
    for (const b of parsed.beans) {
      db.prepare(
        `INSERT INTO beanconqueror_beans (
           id, name, roaster, roast_date, roast_type, degree_of_roast, custom_degree_of_roast,
           blend, weight_g, cost, aromatics, cupping_points, decaffeinated, url,
           ean_article_number, notes, rating, bc_created_at, bc_archived, imported_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, roaster = excluded.roaster, roast_date = excluded.roast_date,
           roast_type = excluded.roast_type, degree_of_roast = excluded.degree_of_roast,
           custom_degree_of_roast = excluded.custom_degree_of_roast, blend = excluded.blend,
           weight_g = excluded.weight_g, cost = excluded.cost, aromatics = excluded.aromatics,
           cupping_points = excluded.cupping_points, decaffeinated = excluded.decaffeinated,
           url = excluded.url, ean_article_number = excluded.ean_article_number,
           notes = excluded.notes, rating = excluded.rating, bc_created_at = excluded.bc_created_at,
           bc_archived = excluded.bc_archived, imported_at = excluded.imported_at`
      ).run(
        b.id, b.name, b.roaster, b.roastDate, b.roastType, b.degreeOfRoast, b.customDegreeOfRoast,
        b.blend, b.weightG, b.cost, b.aromatics, b.cuppingPoints, b.decaffeinated ? 1 : 0, b.url,
        b.eanArticleNumber, b.notes, b.rating, b.bcCreatedAt, b.bcArchived ? 1 : 0, now
      );
    }

    for (const o of parsed.beanOrigins) {
      db.prepare(
        `INSERT INTO beanconqueror_bean_origins (
           bean_id, component_number, country, region, farm, farmer, elevation,
           variety, processing, certification, harvested, percentage
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(bean_id, component_number) DO UPDATE SET
           country = excluded.country, region = excluded.region, farm = excluded.farm,
           farmer = excluded.farmer, elevation = excluded.elevation, variety = excluded.variety,
           processing = excluded.processing, certification = excluded.certification,
           harvested = excluded.harvested, percentage = excluded.percentage`
      ).run(
        o.beanId, o.componentNumber, o.country, o.region, o.farm, o.farmer, o.elevation,
        o.variety, o.processing, o.certification, o.harvested, o.percentage
      );
    }

    for (const m of parsed.methods) {
      db.prepare(
        `INSERT INTO beanconqueror_methods (
           id, preparation_method, name, preparation_style, preparation_tools, notes,
           bc_archived, bc_created_at, imported_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           preparation_method = excluded.preparation_method, name = excluded.name,
           preparation_style = excluded.preparation_style, preparation_tools = excluded.preparation_tools,
           notes = excluded.notes, bc_archived = excluded.bc_archived,
           bc_created_at = excluded.bc_created_at, imported_at = excluded.imported_at`
      ).run(m.id, m.preparationMethod, m.name, m.preparationStyle, m.preparationTools, m.notes, m.bcArchived ? 1 : 0, m.bcCreatedAt, now);
    }

    for (const g of parsed.grinders) {
      db.prepare(
        `INSERT INTO beanconqueror_grinders (id, name, notes, bc_archived, bc_created_at, imported_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, notes = excluded.notes, bc_archived = excluded.bc_archived,
           bc_created_at = excluded.bc_created_at, imported_at = excluded.imported_at`
      ).run(g.id, g.name, g.notes, g.bcArchived ? 1 : 0, g.bcCreatedAt, now);
    }

    for (const br of parsed.brews) {
      db.prepare(
        `INSERT INTO beanconqueror_brews (
           bc_created_at, bean_id, preparation_id, mill_id, grind_setting, ground_coffee_g,
           brew_temperature, bean_type, grind_speed_rpm, grind_time, profile, preparation_tools,
           temperature_time, brew_time, bloom_time, first_drip_time, water_amount_g, coffee_type,
           coffee_concentration, rating, notes, beverage_quantity, tds_percent,
           extraction_yield_percent, brew_ratio, bean_age_days, bc_archived, water, imported_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(bc_created_at, COALESCE(bean_id, '')) DO UPDATE SET
           preparation_id = excluded.preparation_id, mill_id = excluded.mill_id,
           grind_setting = excluded.grind_setting, ground_coffee_g = excluded.ground_coffee_g,
           brew_temperature = excluded.brew_temperature, bean_type = excluded.bean_type,
           grind_speed_rpm = excluded.grind_speed_rpm, grind_time = excluded.grind_time,
           profile = excluded.profile, preparation_tools = excluded.preparation_tools,
           temperature_time = excluded.temperature_time, brew_time = excluded.brew_time,
           bloom_time = excluded.bloom_time, first_drip_time = excluded.first_drip_time,
           water_amount_g = excluded.water_amount_g, coffee_type = excluded.coffee_type,
           coffee_concentration = excluded.coffee_concentration, rating = excluded.rating,
           notes = excluded.notes, beverage_quantity = excluded.beverage_quantity,
           tds_percent = excluded.tds_percent, extraction_yield_percent = excluded.extraction_yield_percent,
           brew_ratio = excluded.brew_ratio, bean_age_days = excluded.bean_age_days,
           bc_archived = excluded.bc_archived, water = excluded.water, imported_at = excluded.imported_at`
      ).run(
        br.bcCreatedAt, br.beanId, br.preparationId, br.millId, br.grindSetting, br.groundCoffeeG,
        br.brewTemperature, br.beanType, br.grindSpeedRpm, br.grindTime, br.profile, br.preparationTools,
        br.temperatureTime, br.brewTime, br.bloomTime, br.firstDripTime, br.waterAmountG, br.coffeeType,
        br.coffeeConcentration, br.rating, br.notes, br.beverageQuantity, br.tdsPercent,
        br.extractionYieldPercent, br.brewRatio, br.beanAgeDays, br.bcArchived ? 1 : 0, br.water, now
      );
    }

    // The bean upsert above never writes coffee_id, so existing links survive.
    autoLinkBeanConquerorBeans(db, parsed.beans.map((b) => b.id).filter((id) => !existingBeanIds.has(id)));

    db.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('beanconqueror_last_imported_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(now);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export interface LikelyMatch {
  slug: string;
  coffeeName: string;
  roastDate: string | null;
  status: string;
}

export interface UnmatchedBean extends ParsedBean {
  origin: string | null;
  processing: string | null;
  likelyMatch: LikelyMatch | null;
}

// Beyond this many days apart, two same-roaster same-ish-name entries are
// treated as separate purchases, not a formatting-only duplicate of the
// same bag — confirmed against real data: this user's genuine repurchases
// of the same coffee are always weeks-to-months apart (one case: the same
// coffee bought 3 separate times), while true duplicates caused by
// inconsistent recording between Bean Conqueror and this site are same-day
// or off by at most a couple of days.
const LIKELY_MATCH_DATE_WINDOW_DAYS = 7;

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics: "Corazón" -> "Corazon"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Small hand-rolled edit distance — no fuzzy-matching dependency justified
// for comparing a handful of short coffee names per import.
function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Exact-after-normalizing (accents/case/punctuation) or one name containing
// the other (a country/varietal prefix or suffix one side omits) catch most
// real duplicates outright; the similarity ratio on top only exists to
// catch a single-character typo ("Boquette"/"Boquete") that's neither.
// Deliberately does NOT try to bridge reordered/inserted words (e.g.
// "Mejorada #4732" vs "Natural Mejorada") — false negatives here just leave
// a candidate unflagged (same as today), while a looser rule risks flagging
// two genuinely different processing lots ("... Gesha Washed" vs "...
// Gesha Natural") as a likely match, which is the worse failure mode.
function namesLikelyMatch(a: string, b: string): boolean {
  const normA = normalizeForMatch(a);
  const normB = normalizeForMatch(b);
  if (!normA || !normB) return false;
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true;
  const distance = levenshteinDistance(normA, normB);
  const similarity = 1 - distance / Math.max(normA.length, normB.length);
  return similarity >= 0.9;
}

export interface LikelyMatchCandidate {
  slug: string;
  coffee_name: string;
  roaster: string;
  roast_date: string | null;
  status: string;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / msPerDay;
}

// Ranks a same-roaster, same-ish-name coffee with a real roast date within
// the window above the best real-date match found so far, but a missing
// roast date on either side (some older Bean Conqueror beans have none)
// still qualifies as a fallback — it's just outranked by any candidate we
// can actually confirm is close in time.
export function findLikelyMatch(
  bean: { name: string; roaster: string | null; roastDate: string | null },
  coffees: LikelyMatchCandidate[]
): LikelyMatchCandidate | null {
  if (!bean.roaster) return null;
  const normalizedRoaster = normalizeForMatch(bean.roaster);
  let best: LikelyMatchCandidate | null = null;
  let bestScore = Infinity;
  for (const coffee of coffees) {
    if (normalizeForMatch(coffee.roaster) !== normalizedRoaster) continue;
    if (!namesLikelyMatch(bean.name, coffee.coffee_name)) continue;
    let score: number;
    if (bean.roastDate && coffee.roast_date) {
      const diff = daysBetween(bean.roastDate, coffee.roast_date);
      if (diff > LIKELY_MATCH_DATE_WINDOW_DAYS) continue;
      score = diff;
    } else {
      score = LIKELY_MATCH_DATE_WINDOW_DAYS;
    }
    if (score < bestScore) {
      bestScore = score;
      best = coffee;
    }
  }
  return best;
}

// Shared by getUnmatchedBeanConquerorBeans and countUnmatchedBeanConquerorBeans.
// Tracked means linked (beanconqueror_beans.coffee_id); the exact text match
// only feeds the backfill and auto-link (beanConquerorLinks.ts).
const UNMATCHED_BEAN_WHERE = `WHERE b.dismissed_at IS NULL AND b.coffee_id IS NULL`;

export function countUnmatchedBeanConquerorBeans(db: DatabaseSync): number {
  const row = db.prepare(`SELECT COUNT(*) c FROM beanconqueror_beans b ${UNMATCHED_BEAN_WHERE}`).get() as { c: number };
  return row.c;
}

export function getUnmatchedBeanConquerorBeans(db: DatabaseSync, limit: number): UnmatchedBean[] {
  const rows = db
    .prepare(
      `SELECT b.* FROM beanconqueror_beans b
       ${UNMATCHED_BEAN_WHERE}
       -- Ordered by the bean's own Bean Conqueror creation timestamp, not
       -- by imported_at: every row from a single import shares one
       -- imported_at value (set once per importBeanConquerorData call), so
       -- ordering by it ties on every row and SQLite falls back to
       -- arbitrary rowid order. bc_created_at actually differs per bean,
       -- giving a genuine newest-bean-first list.
       ORDER BY b.bc_created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    name: string;
    roaster: string | null;
    roast_date: string | null;
    roast_type: string | null;
    degree_of_roast: number | null;
    custom_degree_of_roast: string | null;
    blend: string | null;
    weight_g: number | null;
    cost: number | null;
    aromatics: string | null;
    cupping_points: string | null;
    decaffeinated: number;
    url: string | null;
    ean_article_number: string | null;
    notes: string | null;
    rating: number | null;
    bc_created_at: string | null;
    bc_archived: number;
  }>;

  const coffees = db
    .prepare(`SELECT slug, roaster, coffee_name, roast_date, status FROM coffees`)
    .all() as unknown as LikelyMatchCandidate[];

  return rows.map((r) => {
    const origin = db
      .prepare(
        `SELECT country, processing FROM beanconqueror_bean_origins WHERE bean_id = ? ORDER BY component_number ASC LIMIT 1`
      )
      .get(r.id) as { country: string | null; processing: string | null } | undefined;
    const likelyMatch = findLikelyMatch({ name: r.name, roaster: r.roaster, roastDate: r.roast_date }, coffees);
    return {
      id: r.id,
      name: r.name,
      roaster: r.roaster,
      roastDate: r.roast_date,
      roastType: r.roast_type,
      degreeOfRoast: r.degree_of_roast,
      customDegreeOfRoast: r.custom_degree_of_roast,
      blend: r.blend,
      weightG: r.weight_g,
      cost: r.cost,
      aromatics: r.aromatics,
      cuppingPoints: r.cupping_points,
      decaffeinated: r.decaffeinated === 1,
      url: r.url,
      eanArticleNumber: r.ean_article_number,
      notes: r.notes,
      rating: r.rating,
      bcCreatedAt: r.bc_created_at,
      bcArchived: r.bc_archived === 1,
      origin: origin?.country ?? null,
      processing: origin?.processing ?? null,
      likelyMatch: likelyMatch
        ? {
            slug: likelyMatch.slug,
            coffeeName: likelyMatch.coffee_name,
            roastDate: likelyMatch.roast_date,
            status: likelyMatch.status
          }
        : null
    };
  });
}

export function dismissBeanConquerorBean(db: DatabaseSync, id: string): void {
  db.prepare(`UPDATE beanconqueror_beans SET dismissed_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}
