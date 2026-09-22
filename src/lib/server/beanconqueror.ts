import type { DatabaseSync } from 'node:sqlite';
import type ExcelJS from 'exceljs';
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

function parseBeans(worksheet: ExcelJS.Worksheet | undefined): { beans: ParsedBean[]; beanOrigins: ParsedBeanOrigin[] } {
  const beans: ParsedBean[] = [];
  const beanOrigins: ParsedBeanOrigin[] = [];
  if (!worksheet) return { beans, beanOrigins };

  const maxComponents = Math.max(0, Math.floor((worksheet.columnCount - BEAN_FIXED_COLUMN_COUNT) / BEAN_ORIGIN_GROUP_SIZE));

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
         ON CONFLICT(bc_created_at, bean_id) DO UPDATE SET
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
