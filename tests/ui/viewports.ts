// Every layout check runs at each of these: the widths the user's phones and
// desktop hit (480 is where a real grid-collapse bug once hid, HANDOFF
// gotcha), plus the user's own phone in both orientations, a standing
// requirement for all UI testing (test phone in Firefox, measured
// 2026-10-05: 480×909 portrait, 1003×333 landscape, CSS px at DPR 3).
export const VIEWPORTS = [
  ...[360, 390, 480, 768, 1280].map((width) => ({ name: `w${width}`, viewport: { width, height: 800 } })),
  { name: 'phone-portrait', viewport: { width: 480, height: 909 }, deviceScaleFactor: 3, hasTouch: true },
  { name: 'phone-landscape', viewport: { width: 1003, height: 333 }, deviceScaleFactor: 3, hasTouch: true }
];
