// A stored roaster-recipe snippet as reading steps: numbered steps ("1. ...") or sentences, as a list when there are
// 3 or more, else null (the page shows a paragraph).
export function recipeSteps(snippet: string): string[] | null {
  const text = snippet.replace(/\s+/g, ' ').trim();
  const numbered = text.split(/\s(?=\d{1,2}[.)]\s)/).map((s) => s.replace(/^\d{1,2}[.)]\s*/, '').trim()).filter(Boolean);
  const parts = numbered.length >= 3 ? numbered : text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
  return parts.length >= 3 ? parts : null;
}
