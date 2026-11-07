// Every layout check runs at each of these: the widths the user's phones and
// desktop hit (480 is where a real grid-collapse bug once hid), plus the user's own phone in both orientations, a standing
// requirement for all UI testing (test phone in Firefox, measured
// 2026-10-05: 480×909 portrait, 1003×333 landscape, CSS px at DPR 3).
export const ALL_VIEWPORTS = [
  ...[360, 390, 480, 768, 1280].map((width) => ({ name: `w${width}`, viewport: { width, height: 800 } })),
  { name: 'phone-portrait', viewport: { width: 480, height: 909 }, deviceScaleFactor: 3, hasTouch: true },
  { name: 'phone-landscape', viewport: { width: 1003, height: 333 }, deviceScaleFactor: 3, hasTouch: true }
];

// UI_VIEWPORTS=<comma list of names> narrows a run (iterating only); unset = all.
// The pre-push gate overrides it: all 7 on a release push, GATE_VIEWPORTS (scripts/pre-push.ts) otherwise.
export function pickViewports(list: string | undefined) {
  if (!list) return ALL_VIEWPORTS;
  const names = list.split(',').map((n) => n.trim()).filter(Boolean);
  const unknown = names.filter((n) => !ALL_VIEWPORTS.some((v) => v.name === n));
  if (unknown.length || !names.length) {
    throw new Error(`Unknown UI_VIEWPORTS "${list}": use ${ALL_VIEWPORTS.map((v) => v.name).join(',')}`);
  }
  return ALL_VIEWPORTS.filter((v) => names.includes(v.name));
}
export const VIEWPORTS = pickViewports(process.env.UI_VIEWPORTS);
// Where width-independent behavior states (tagged @two in layout.spec.ts) run: one touch phone, one desktop.
export const TWO_VIEWPORTS = ['phone-portrait', 'w1280'];
