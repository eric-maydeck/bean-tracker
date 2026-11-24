// Filter names from retailer pages, 2026-11-24. Used to guess whether a BQ tool is a coffee filter.
export interface CatalogFilter {
	brand: string;
	name: string;
	aliases: readonly string[];
	sizes: readonly string[];
}

export const FILTER_CATALOG: readonly CatalogFilter[] = [
	{ brand: "Cafec", name: "Abaca", aliases: ["Abaca","Cafec Abaca","Abaca red"], sizes: ["1 cup","2 cup","4 cup"] },
	{ brand: "Cafec", name: "Abaca+", aliases: ["Abaca+","Abaca Plus","Abaca Plus black"], sizes: ["1 cup","2 cup","4 cup"] },
	{ brand: "Cafec", name: "Deep 27 Abaca+", aliases: ["Deep 27","Deep27","Abaca+ Deep 27"], sizes: ["100 pack"] },
	{ brand: "Cafec", name: "Light Roast T-92", aliases: ["T92","T-92","Cafec Light"], sizes: ["1 cup","2 cup","4 cup"] },
	{ brand: "Cafec", name: "Medium(-Dark) Roast T-90", aliases: ["T90","T-90","TH-3","TH3","Cafec Medium"], sizes: ["1 cup","2 cup","4 cup"] },
	{ brand: "Cafec", name: "Dark Roast T-83", aliases: ["T83","T-83","TH-2","TH2","Cafec Dark"], sizes: ["1 cup","2 cup","4 cup"] },
	{ brand: "Cafec", name: "TH-1", aliases: ["TH1"], sizes: [] },
	{ brand: "Cafec", name: "TH-4", aliases: ["TH4"], sizes: [] },
	{ brand: "Cafec", name: "4P assortment", aliases: ["4P","assorted pack"], sizes: ["1 cup","4 cup"] },
	{ brand: "Cafec", name: "Flower Dripper paper", aliases: ["Flower filter"], sizes: ["Cup4 (2-4 cups)"] },
	{ brand: "Hario", name: "V60 paper white (bleached)", aliases: ["V60 paper","V60 01","V60 02","V60 03","VCF-01-100W"], sizes: ["01","02","03"] },
	{ brand: "Hario", name: "V60 paper natural (unbleached, Misarashi)", aliases: ["V60 brown","V60 natural","Misarashi"], sizes: ["01","02","03"] },
	{ brand: "Hario", name: "V60 paper untabbed", aliases: ["V60 untabbed"], sizes: ["01","02","03"] },
	{ brand: "Hario", name: "V60 paper tabbed", aliases: ["V60 tabbed"], sizes: ["01","02","03"] },
	{ brand: "Hario", name: "V60 Meteor (PLA)", aliases: ["V60 Meteor","VCF-50-MT"], sizes: ["02"] },
	{ brand: "Hario", name: "V60 Pegasus paper", aliases: [], sizes: ["02","03"] },
	{ brand: "Hario", name: "Syphon cloth filter", aliases: ["Hario cloth"], sizes: ["pack of 5"] },
	{ brand: "Hario", name: "Woodneck cloth", aliases: ["Woodneck"], sizes: [] },
	{ brand: "Sibarist", name: "Fast Cone", aliases: ["Sibarist Fast","Fast Cone S/M"], sizes: ["S (01)","M (02)"] },
	{ brand: "Sibarist", name: "Fast Flat", aliases: ["Fast Flat S","Fast Flat M"], sizes: ["S (155)","M (185)"] },
	{ brand: "Sibarist", name: "Fast Disc 63", aliases: ["Fast Disc"], sizes: ["63mm"] },
	{ brand: "Sibarist", name: "B3 Flat", aliases: ["B3 Flat","Sibarist B3","UFO B3 Flat","UFO filter"], sizes: ["S","M"] },
	{ brand: "Sibarist", name: "B3 Hybrid", aliases: ["Sibarist Hybrid"], sizes: ["S","M"] },
	{ brand: "Sibarist", name: "B3 Cone", aliases: ["B3 Cone"], sizes: ["S","M"] },
	{ brand: "Sibarist", name: "Orea Fast Flat 2 Narrow", aliases: ["Orea Flat 2"], sizes: ["Orea V3/V4 Narrow"] },
	{ brand: "Sibarist", name: "Orea B3 Cone Wide", aliases: ["Orea V4 Wide cone"], sizes: ["V4 Wide"] },
	{ brand: "Kalita", name: "Wave 155", aliases: ["Kalita Wave 155","Wave 155","Kalita 155"], sizes: ["155"] },
	{ brand: "Kalita", name: "Wave 185", aliases: ["Kalita Wave 185","Wave 185","KW185","Kalita 185"], sizes: ["185"] },
	{ brand: "Kalita", name: "102 / 103 cone", aliases: ["Kalita 102","Kalita 103"], sizes: ["102","103"] },
	{ brand: "xBloom", name: "Premium wave paper 155", aliases: ["xBloom 155","xBloom filter"], sizes: ["155"] },
	{ brand: "Timemore", name: "Paper filter V02", aliases: ["Timemore 155","Timemore V60","Timemore filter"], sizes: ["V02"] },
	{ brand: "Timemore", name: "Wave 155", aliases: ["Timemore 155"], sizes: ["155"] },
	{ brand: "Orea", name: "Wave filter paper", aliases: ["Orea wave"], sizes: ["V3/V4"] },
	{ brand: "Orea", name: "Flat filter paper", aliases: ["Orea flat"], sizes: [] },
	{ brand: "April", name: "April paper", aliases: ["April filter"], sizes: ["small ~155","large ~185"] },
	{ brand: "Origami", name: "Cone filter", aliases: ["Origami cone"], sizes: ["S 02","M 04"] },
	{ brand: "Origami", name: "Wave filter", aliases: ["Origami wave"], sizes: ["155 (S)","185 (M)"] },
	{ brand: "HiFlux", name: "Folding V", aliases: ["HiFlux","Hiflux V"], sizes: [] },
	{ brand: "HiFlux", name: "Wave 155", aliases: ["HiFlux 155","Purity Wave"], sizes: ["155"] },
	{ brand: "HiFlux", name: "Wave 185", aliases: ["HiFlux 185"], sizes: ["185"] },
	{ brand: "DragonFly", name: "Flat-bottom 220", aliases: ["DragonFly 220"], sizes: ["220"] },
	{ brand: "Melitta", name: "Cone 1x2", aliases: ["Melitta 1x2"], sizes: ["1x2"] },
	{ brand: "Melitta", name: "Cone 1x4", aliases: ["Melitta 1x4","Melitta Original 1x4"], sizes: ["1x4"] },
	{ brand: "Melitta", name: "Cone 1x6", aliases: ["Melitta 1x6"], sizes: ["1x6"] },
	{ brand: "Kono", name: "Meimon cone", aliases: ["Kono 1-2 cup"], sizes: ["1-2 cup"] },
	{ brand: "Chemex", name: "Bonded square FS-100", aliases: ["FS-100","Chemex square"], sizes: ["6+ cup"] },
	{ brand: "Chemex", name: "Bonded natural square FSU-100", aliases: ["FSU-100","Chemex natural"], sizes: ["6+ cup"] },
	{ brand: "Chemex", name: "Bonded circle FC-100", aliases: ["FC-100","Chemex circle"], sizes: ["6+ cup"] },
	{ brand: "Chemex", name: "Unfolded circle FP-1", aliases: ["FP-1"], sizes: [] },
	{ brand: "Chemex", name: "Half-moon FP-2 / natural FP-2N", aliases: ["FP-2","FP-2N","half moon"], sizes: ["1-3 cup"] },
	{ brand: "AeroPress", name: "Paper micro-filters", aliases: ["Aeropress","Aeropress paper","microfilter"], sizes: ["standard","Go"] },
	{ brand: "Able", name: "Disk (Standard / Fine)", aliases: ["Able Disk","Able Disc"], sizes: ["standard","fine (152 micron)"] },
	{ brand: "Able", name: "Kone", aliases: ["Able Kone"], sizes: [] },
	{ brand: "Fellow", name: "Prismo", aliases: ["Prismo"], sizes: [] },
	{ brand: "Fellow", name: "Stagg paper", aliases: ["Stagg filter"], sizes: [] },
	{ brand: "Espro", name: "Bloom paper filter", aliases: ["Espro Bloom"], sizes: ["50","100 pack"] },
	{ brand: "NextLevel", name: "Pulsar paper filter", aliases: ["Pulsar","Scott Rao Pulsar"], sizes: ["80mm"] },
	{ brand: "Tricolate", name: "Filter", aliases: ["Tricolate"], sizes: ["88mm"] },
	{ brand: "Clever", name: "Clever Dripper paper", aliases: ["Clever filter"], sizes: [] },
	{ brand: "Bee House", name: "Bee House paper", aliases: ["Beehouse"], sizes: [] },
	{ brand: "Walkure", name: "Walkure filter", aliases: ["Walkure"], sizes: [] },
];

/** Lowercase, trailing " filters" removed, spaces/hyphens/underscores dropped (keeps "+"). */
export function toolKey(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+filters$/, "")
		.replace(/[\s_-]+/g, "");
}

const catalogKeys = new Set(
	FILTER_CATALOG.flatMap((f) =>
		[f.name, ...f.aliases].flatMap((n) => [toolKey(n), toolKey(f.brand + n)]),
	),
);
const brandKeys = [...new Set(FILTER_CATALOG.map((f) => toolKey(f.brand)))];

export function isCatalogFilter(name: string): boolean {
	return catalogKeys.has(toolKey(name));
}

// Key with a leading catalog brand removed, or null when the name carries no brand.
function unbranded(key: string): string | null {
	const b = brandKeys.find((k) => key.startsWith(k) && key.length > k.length);
	return b ? key.slice(b.length) : null;
}

export function sameToolSpelling(a: string, b: string): boolean {
	const ka = toolKey(a);
	const kb = toolKey(b);
	if (ka === kb) return true;
	const ua = unbranded(ka);
	const ub = unbranded(kb);
	return (ua === null && ub === ka) || (ub === null && ua === kb);
}
