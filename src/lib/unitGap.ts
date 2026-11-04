// No space between a number and a symbol unit (30s, 18g, 91°C, 880mL, 45ppm, 1.2g/s); a word unit (days, bags) keeps one.
export const unitGap = (unit: string) => (/^(µm|mm|mg|kg|mL|[gsLWhd%°]|°[CF]|min|ppm|g\/s|g\/day|mg\/L|bar|psi|rpm)$/.test(unit) ? '' : ' ');
// Word-joiner after a hyphen/dash/slash so a name never breaks mid-word.
export const glue = (s: string) => s.replace(/([-–—/])(?=\S)/g, '$1\u2060');
export const withUnit = (v: string | number, unit: string) => `${v}${unitGap(unit)}${unit}`;
