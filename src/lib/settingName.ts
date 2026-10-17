// A setting's name inside a tip's text ("Always all brews: …", a row label "Confidence adj. (light)"): `setting(name)`
// marks it, and TipBody shows it bold in the link brown (.setting-name, as in prose and chart notes; user, 2026-10-17).
// `plainText` drops the marks wherever the text goes out as plain text (aria-label, title).
const MARK = /⟦([^⟧]*)⟧/g;
export const setting = (name: string): string => `⟦${name}⟧`;
export const plainText = (s: string): string => s.replace(MARK, '$1');
// The text's runs: [text, isSetting] pairs, for rendering.
export const settingRuns = (s: string): [string, boolean][] => s.split(/⟦|⟧/).map((t, i) => [t, i % 2 === 1] as [string, boolean]).filter(([t]) => t);
