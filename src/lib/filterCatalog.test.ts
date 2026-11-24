import { describe, expect, it } from "vitest";
import { isCatalogFilter, sameToolSpelling, toolKey } from "./filterCatalog";

describe("filterCatalog", () => {
	it.each([
		"Cafec Abaca",
		"Cafec Abaca+",
		"Cafec T-90",
		"Cafec T90",
		"Cafec TH-3",
		"Sibarist Fast",
		"Kalita Wave 155",
		"Timemore 155",
		"xBloom 155",
		"XBloom 155 filters",
		"Aeropress",
		"T90",
	])("recognises %s", (n) => expect(isCatalogFilter(n)).toBe(true));

	it.each(["Wave 185", "Kalita Wave 185", "KW185"])("recognises %s", (n) =>
		expect(isCatalogFilter(n)).toBe(true),
	);

	it.each([
		"Switch base",
		"155",
		"Neo",
		"Scale",
		"Prismo",
		"Pulsar",
		"Woodneck",
		"Kalita 102",
		"Filter",
	])("rejects %s", (n) =>
		expect(isCatalogFilter(n)).toBe(false),
	);

	it("keeps the plus", () => expect(toolKey("Cafec Abaca+")).not.toBe(toolKey("Cafec Abaca")));

	it("sameToolSpelling", () => {
		expect(sameToolSpelling("Cafec T90", "Cafec T-90")).toBe(true);
		expect(sameToolSpelling("T90", "Cafec T-90")).toBe(true);
		expect(sameToolSpelling("Kalita Wave 155", "Origami Wave 155")).toBe(false);
		expect(sameToolSpelling("Cafec T-90", "Cafec TH-3")).toBe(false);
	});
});
