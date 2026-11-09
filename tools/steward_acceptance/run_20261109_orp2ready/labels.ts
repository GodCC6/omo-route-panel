export function canonicalLabel(text: string): string {
  const label = text.trim().toLowerCase();
  if (label.length === 0) throw new Error("Label must contain non-whitespace characters.");
  return label.replace(/\s+/gu, "-");
}
