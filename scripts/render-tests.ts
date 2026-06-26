// Dependency-free unit checks for the deterministic renderers and helpers.
// Run with `npm test`. Mirrors scripts/golden-quality.ts (no test framework
// dependency to install) and focuses on the regression-prone, fiddly code:
// SVG escaping/sanitization, CJK handling, and the chart code generator.
import { renderMindmapSvg } from "../lib/mindmap/mindmapGenerator";
import { renderFigureSvg } from "../lib/figure/figureRenderer";
import { buildFigureSpec } from "../lib/figure/figureSpec";
import { generateChartCode } from "../lib/chart/chartGenerator";
import { sanitizeSvgMarkup } from "../lib/infra/sanitizeSvg";
import { clampTextWithFlag } from "../lib/utils";
import { selectReferences } from "../lib/figure/referenceGallery";
import { MindmapNode, PaperInput, PaperStructure } from "../lib/types";

let failures = 0;
function assert(group: string, label: string, condition: unknown) {
  if (condition) return;
  failures += 1;
  console.error(`[${group}] FAILED: ${label}`);
}

async function main() {
// 1) Mindmap SVG: valid root, CJK preserved, malicious title escaped (not executable).
{
  const outline: MindmapNode = {
    id: "root",
    title: "注意力机制 <script>alert(1)</script>",
    summary: "测试中文与转义",
    children: [
      { id: "a", title: "方法 Method", summary: "encoder", children: [] },
      { id: "b", title: "结果 Results", summary: "AUC", children: [] }
    ]
  };
  const svg = renderMindmapSvg(outline);
  assert("mindmap", "returns an <svg> root", svg.trim().startsWith("<svg"));
  assert("mindmap", "no executable <script> survives", !/<script/i.test(svg));
  assert("mindmap", "escapes the angle bracket", svg.includes("&lt;script"));
  assert("mindmap", "keeps CJK section title", svg.includes("方法"));
}

// 2) sanitizeSvgMarkup: strips script / handlers / javascript: urls.
{
  const dirty = `<svg onload="steal()"><script>alert(1)</script><a xlink:href="javascript:alert(2)"><text>x</text></a></svg>`;
  const clean = sanitizeSvgMarkup(dirty);
  assert("sanitize", "removes <script>", !/<script/i.test(clean));
  assert("sanitize", "removes onload handler", !/onload/i.test(clean));
  assert("sanitize", "neutralizes javascript: href", !/javascript:/i.test(clean));
  assert("sanitize", "keeps benign content", clean.includes("<text>x</text>"));
}

// 3) Figure SVG: a label containing markup must be escaped, never raw.
{
  const input: PaperInput = {
    field: "机器学习",
    figureType: "method-framework",
    text: "A workflow with a target, features, model training, and AUC evaluation.",
    purpose: "journal",
    aspectRatio: "16:9",
    palette: "journal",
    style: "clean academic vector"
  };
  const structure: PaperStructure = {
    title: "Workflow <b>x</b>",
    abstract: "A method workflow with target, features, training, and evaluation.",
    methods: [{ title: "Method", content: "feature design and model training" }],
    results: [{ title: "Result", content: "AUC with uncertainty" }],
    keywords: ["workflow", "model", "auc"],
    limitations: ["No fabricated metrics."]
  };
  const modules = ["Target <script>", "Features", "Model", "AUC"];
  const refs = selectReferences(input.figureType, input.field, structure.keywords, input.text);
  const spec = buildFigureSpec(input, structure, refs, "render-test", modules, "layout", 0);
  const svg = renderFigureSvg("render-test", modules, input.palette, input.aspectRatio, 0, input.figureType, spec);
  assert("figure", "returns an <svg> root", svg.trim().startsWith("<svg"));
  assert("figure", "no raw <script in output", !/<script/i.test(svg));
  assert("figure", "no #NaN colors", !/#nan/i.test(svg));
}

// 4) clampText flag.
{
  const short = clampTextWithFlag("hello");
  assert("clamp", "short text not truncated", short.truncated === false && short.text === "hello");
  const long = clampTextWithFlag("a".repeat(20), 10);
  assert("clamp", "long text flagged truncated", long.truncated === true && long.text.includes("[truncated]"));
}

// 5) Chart code generator: produces runnable-looking code offline (template fallback).
{
  const run = async () => {
    const result = await generateChartCode({
      data: "Method,Acc\nOurs,0.92\nBaseline,0.81",
      chartType: "bar",
      library: "seaborn",
      title: "Test",
      xLabel: "Method",
      yLabel: "Acc"
    });
    assert("chart", "returns non-empty code", typeof result.code === "string" && result.code.length > 20);
    assert("chart", "seaborn code imports matplotlib", /matplotlib|seaborn/i.test(result.code));
    assert("chart", "library echoed", result.library === "seaborn");
  };
  await run();
}

  if (failures) {
    console.error(`\n${failures} renderer test(s) failed.`);
    process.exit(1);
  }
  console.log("\nRenderer tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
