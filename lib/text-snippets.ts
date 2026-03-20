/** First chunk of text for “at a glance” / skim (no AI). */
export function atAGlanceSummary(text: string, maxChars = 380): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t.length) return "";
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

/** Pull leading heading lines (## …) from markdown-ish plan for outline. */
export function extractSectionHeadings(text: string, max = 8): string[] {
  const lines = text.split(/\r?\n/);
  const heads: string[] = [];
  for (const line of lines) {
    const m = /^\s*#{1,3}\s+(.+)/.exec(line);
    if (m) {
      heads.push(m[1].trim());
      if (heads.length >= max) break;
    }
  }
  return heads;
}
