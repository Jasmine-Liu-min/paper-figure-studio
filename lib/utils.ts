export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function clampTextWithFlag(value: string, max = 9000): { text: string; truncated: boolean } {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length > max) {
    return { text: `${normalized.slice(0, max)}\n\n[truncated]`, truncated: true };
  }
  return { text: normalized, truncated: false };
}

export function clampText(value: string, max = 9000) {
  return clampTextWithFlag(value, max).text;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hashId(prefix = "pf") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
