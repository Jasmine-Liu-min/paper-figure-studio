// Curated academic color palettes shared by the SVG renderer and the LLM/image
// prompt builders. Inspired by publication-grade palettes (Okabe-Ito,
// colorblind-safe, journal house styles). Each palette exposes:
//   - fills: 6 light card tints used by the SVG figure renderer
//   - promptDescription: a role-mapped instruction injected into image prompts
//
// Role convention used across prompts: primary = core method, secondary =
// outputs/highlights, tertiary = inputs/evidence, text = dark slate,
// fill = white, section_bg = very pale tints, border = light gray, arrow = dark slate.

export type AcademicPalette = {
  id: string;
  label: string;
  colorblindSafe: boolean;
  fills: [string, string, string, string, string, string];
  promptDescription: string;
};

export const PALETTES: AcademicPalette[] = [
  {
    id: "paper-pro",
    label: "论文协调色 (推荐)",
    colorblindSafe: false,
    fills: ["#d8e4f1", "#d7e7e0", "#f1e7d6", "#f1dcd8", "#e3ddee", "#dbe8ea"],
    promptDescription:
      "Use a cohesive, publication-grade palette of soft muted pastels at a uniform light tone: powder blue, sage green, warm cream, blush rose, lavender, and pale teal. Every category color shares the same lightness and gentle saturation so the figure looks unified and designed, never rainbow-like. White canvas, dark-slate text."
  },
  {
    id: "paper-warm",
    label: "暖色协调 (PMST 风)",
    colorblindSafe: false,
    fills: ["#f5ddd6", "#f2e4d7", "#eed3c7", "#ecdcd0", "#f6e1dc", "#ebd9cd"],
    promptDescription:
      "Use a warm, analogous palette of soft rose, peach, cream, blush and tan at a uniform light tone. Cohesive and elegant like a top-tier method figure; warm muted headers, very light fills, white canvas, dark-slate text."
  },
  {
    id: "paper-cool",
    label: "冷色协调 (蓝/薰衣草)",
    colorblindSafe: false,
    fills: ["#dbe4f4", "#dee7f1", "#e3ddf1", "#d6e6f2", "#e7e2f5", "#d3def0"],
    promptDescription:
      "Use a cool, analogous palette of powder blue, periwinkle, lavender and sky tints at a uniform light tone. Calm, cohesive and technical; muted blue/violet headers, very light fills, white canvas, dark-slate text."
  },
  {
    id: "journal-balanced",
    label: "期刊均衡 (蓝/珊瑚/绿)",
    colorblindSafe: false,
    fills: ["#d7ecd9", "#f5d1c3", "#d8e9f7", "#f8e7a2", "#e4dcf5", "#cfe1df"],
    promptDescription:
      "Use a balanced journal palette: primary clinical blue, secondary warm coral, tertiary muted green, with soft amber and lavender accents. Keep all fills as very light tints on a white canvas."
  },
  {
    id: "okabe-ito",
    label: "Okabe-Ito (色盲友好)",
    colorblindSafe: true,
    fills: ["#d6ecf8", "#f9e6c7", "#cfeee2", "#fbf4c4", "#cfe0f0", "#f7dac9"],
    promptDescription:
      "Use the colorblind-safe Okabe-Ito palette: sky blue (#56B4E9), orange (#E69F00), bluish green (#009E73), yellow (#F0E442), blue (#0072B2), vermillion (#D55E00). Apply saturated versions for strokes/accents and light tints for fills. Ensure all category colors stay distinguishable for deuteranopia and protanopia."
  },
  {
    id: "nature-muted",
    label: "Nature 低饱和",
    colorblindSafe: false,
    fills: ["#dce6e3", "#e8ddcf", "#d9e2ec", "#efe2dd", "#e3e7d8", "#e9e1ea"],
    promptDescription:
      "Use a Nature-style muted, desaturated palette: slate teal, sand, dusty blue and warm taupe. Low chroma, high elegance, gentle contrast suitable for a high-impact journal figure on a white background."
  },
  {
    id: "ieee-blue",
    label: "IEEE 蓝系",
    colorblindSafe: false,
    fills: ["#dbe7f3", "#c9d9ec", "#e2eef7", "#d2e0f0", "#eaf1f8", "#cfe1df"],
    promptDescription:
      "Use an IEEE-style blue-dominant technical palette: navy, cobalt and steel blue as primary/secondary, a single restrained teal accent for highlights. Crisp engineering look on a white canvas."
  },
  {
    id: "grayscale",
    label: "灰度 (打印安全)",
    colorblindSafe: true,
    fills: ["#eceff1", "#dfe3e6", "#cfd5da", "#f2f3f5", "#e3e7ea", "#d7dce0"],
    promptDescription:
      "Use a print-safe grayscale palette only: distinguish categories by tone (light to dark gray), line weight and hatching/texture rather than hue. Must remain legible when printed in black and white."
  },
  {
    id: "viridis-soft",
    label: "Viridis 渐变",
    colorblindSafe: true,
    fills: ["#e4e7c4", "#cfe3c0", "#bfe0cf", "#bdd9d6", "#c6cfe0", "#d8cae0"],
    promptDescription:
      "Use a perceptually-uniform viridis-derived sequence (deep purple → teal → green → yellow) for ordered/continuous categories. Light tints for fills, saturated steps for emphasis. Colorblind-safe and monotonic in luminance."
  },
  {
    id: "clinical-pastel",
    label: "医学柔和粉彩",
    colorblindSafe: false,
    fills: ["#dbeafe", "#fde2e4", "#dcfce7", "#fef9c3", "#ede9fe", "#cffafe"],
    promptDescription:
      "Use a soft clinical pastel palette: pale blue, blush pink, mint green, light amber and lavender. Friendly biomedical/graphical-abstract feel, gentle and airy on a white background."
  },
  {
    id: "warm-earth",
    label: "暖色大地",
    colorblindSafe: false,
    fills: ["#f1e3d3", "#e8d5c4", "#f3e7d8", "#efe0cf", "#e6d8c3", "#ece1d0"],
    promptDescription:
      "Use a warm earth-tone palette: terracotta, ochre, sand and olive. Cohesive, organic and low-glare; suitable for ecology, geoscience or humanities figures on an off-white canvas."
  }
];

const DEFAULT_PALETTE = PALETTES[0];

// Resolve a free-text or id palette value to a concrete palette definition.
// Matches by exact id first, then by known keyword aliases (incl. Chinese),
// then falls back to the journal-balanced default.
export function resolvePalette(value: string | undefined | null): AcademicPalette {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return DEFAULT_PALETTE;

  const byId = PALETTES.find((p) => p.id === raw);
  if (byId) return byId;

  if (/(okabe|ito|色盲|color\s*blind|colorblind)/.test(raw)) return byIdOrDefault("okabe-ito");
  if (/(gray|grey|mono|灰|黑白|black\s*and\s*white)/.test(raw)) return byIdOrDefault("grayscale");
  if (/(viridis|顺序|sequential|gradient|渐变)/.test(raw)) return byIdOrDefault("viridis-soft");
  if (/(ieee|engineering|工程)/.test(raw)) return byIdOrDefault("ieee-blue");
  if (/(nature|muted|低饱和|淡雅)/.test(raw)) return byIdOrDefault("nature-muted");
  if (/(clinic|medical|pastel|医|粉彩|柔和)/.test(raw)) return byIdOrDefault("clinical-pastel");
  if (/(warm|暖|pmst|rose|peach)/.test(raw)) return byIdOrDefault("paper-warm");
  if (/(cool|冷|periwinkle|蓝紫|薰衣草)/.test(raw)) return byIdOrDefault("paper-cool");
  if (/(earth|大地|terracotta)/.test(raw)) return byIdOrDefault("warm-earth");
  if (/(pro|协调|统一|cohesive)/.test(raw)) return byIdOrDefault("paper-pro");

  return DEFAULT_PALETTE;
}

function byIdOrDefault(id: string): AcademicPalette {
  return PALETTES.find((p) => p.id === id) ?? DEFAULT_PALETTE;
}

// 6 light card tints for the SVG renderer.
export function paletteFills(value: string | undefined | null): string[] {
  return resolvePalette(value).fills;
}

// Role-mapped color instruction injected into LLM/image prompts.
export function palettePromptText(value: string | undefined | null): string {
  const palette = resolvePalette(value);
  const roleMap =
    "Map colors into roles: primary for the core method, secondary for outputs/highlights, tertiary for inputs/evidence, text as dark slate, fill as white, section_bg as very pale tints, border as light gray, arrow as dark slate.";
  return `${palette.promptDescription} ${roleMap}`;
}
