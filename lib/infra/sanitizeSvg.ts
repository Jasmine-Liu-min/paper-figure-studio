// Defense-in-depth sanitizer for SVG markup injected via dangerouslySetInnerHTML.
//
// Our renderers already escape text content (see escapeHtml usage in
// figureRenderer / mindmapGenerator / architectureRenderer), so labels derived
// from user/LLM input can't break out of <text> nodes. This is the second layer:
// it strips the few constructs that could execute script if a future renderer
// path ever interpolated untrusted data into markup — without pulling in a heavy
// DOM dependency (works identically on the server and in the browser).
export function sanitizeSvgMarkup(svg: string): string {
  if (!svg) return "";
  return (
    svg
      // Drop <script>…</script> and <foreignObject>…</foreignObject> (can embed HTML/JS).
      .replace(/<\s*script\b[\s\S]*?<\s*\/\s*script\s*>/gi, "")
      .replace(/<\s*script\b[^>]*\/?>/gi, "")
      .replace(/<\s*foreignObject\b[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, "")
      // Strip inline event handlers: on*="…" / on*='…' / on*=value.
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
      // Neutralize javascript: in href / xlink:href.
      .replace(/((?:xlink:)?href)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
      .replace(/((?:xlink:)?href)\s*=\s*'javascript:[^']*'/gi, "$1='#'")
  );
}
