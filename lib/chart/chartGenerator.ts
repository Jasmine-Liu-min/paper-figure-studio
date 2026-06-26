import { runLlmText } from "../providers/llmProviders";
import { resolvePalette } from "../palettes";
import { chartTypeMeta } from "./chartTypes";

export { isChartType } from "./chartTypes";

export type ChartLibrary = "seaborn" | "ggplot2";

export type ChartInput = {
  data: string;
  chartType: string;
  library: ChartLibrary;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  palette?: string;
  notes?: string;
};

export type ChartResult = {
  ok: boolean;
  provider: string;
  language: "python" | "r";
  library: ChartLibrary;
  code: string;
  message: string;
};

export async function generateChartCode(input: ChartInput): Promise<ChartResult> {
  const language: "python" | "r" = input.library === "ggplot2" ? "r" : "python";
  const prompt = buildChartPrompt(input);
  const result = await runLlmText(prompt, 0.2);
  if (!result.ok) {
    return { ok: false, provider: result.provider, language, library: input.library, code: fallbackCode(input), message: `${result.message} 已返回可直接修改的模板代码。` };
  }
  const code = extractCode(result.text, language);
  if (!code) {
    return { ok: false, provider: result.provider, language, library: input.library, code: fallbackCode(input), message: "模型未返回可用代码，已返回模板。" };
  }
  return { ok: true, provider: result.provider, language, library: input.library, code, message: `已用 ${result.provider} 生成${language === "r" ? " R/ggplot2" : " Python/seaborn"} 出版级绘图代码。` };
}

function buildChartPrompt(input: ChartInput) {
  const palette = resolvePalette(input.palette);
  const colors = palette.fills.join(", ");
  const meta = chartTypeMeta(input.chartType);
  const shared = `You generate PUBLICATION-GRADE statistical chart code for an academic paper (journal/conference figure). Output ONLY a single fenced code block, no prose before or after.

Chart type: ${input.chartType}
Chart use case: ${meta?.useCase ?? "infer from chart type and data"}
Expected data shape: ${meta?.dataHint ?? "infer from user data"}
Title: ${input.title || "(infer a concise title)"}
X label: ${input.xLabel || "(infer)"}
Y label: ${input.yLabel || "(infer)"}
Cohesive color palette to use (hex, in order): ${colors}

User data (parse it; if it is only a description, synthesize reasonable placeholder data and clearly mark it with a # TODO comment so the user can replace it):
${input.data.slice(0, 4000)}
${input.notes ? `\nExtra requirements: ${input.notes}` : ""}`;

  if (input.library === "ggplot2") {
    return `${shared}

Requirements (R / tidyverse + ggplot2, publication quality):
- Use library(tidyverse) (and scales/ggtext if helpful). Build the data with tibble()/tribble() inline from the parsed data.
- Choose the correct ggplot geometry for the requested chart type. Examples: geom_col for bars, geom_line for curves, geom_point for scatter/PCA/UMAP, geom_tile for heatmaps/confusion matrices, geom_errorbarh or geom_pointrange for forest/errorbar plots, geom_ribbon for uncertainty bands, geom_density/geom_histogram for distributions. If a specialized package is truly needed (e.g. ggrepel for labels), include the install note as a comment but keep the code runnable with core tidyverse when possible.
- For statistical inference charts, show uncertainty honestly: confidence intervals, reference lines, or thresholds must be labeled and not invented.
- For model evaluation charts (ROC/PR/calibration/lift/learning curves), keep axes in valid ranges and add no-skill baselines where appropriate.
- For bioinformatics charts (volcano/Manhattan/enrichment), label only a few top hits and state thresholds as variables at the top.
- Use theme_minimal(base_size = 12) refined: no panel grid minor, thin major grid, no chart junk, clear axis titles. Put the legend on the right (legend.position = "right") so it never overlaps the data; drop the legend if there is no grouping.
- Apply the given palette via scale_fill_manual()/scale_color_manual() with the exact hex values above.
- PROPORTION: balanced aspect, not overly wide/flat; sensible bar width (e.g. geom_col(width = 0.7)); for few categories keep width≈5, height≈4 inches.
- Readable fonts, balanced spacing; title via labs(); use a clean classic look suitable for a journal.
- End with ggsave() exporting BOTH a 300-dpi PNG and a vector PDF (e.g. "figure.pdf"/"figure.png", width≈5.5, height≈4 inches).
- Code must run as-is after the user edits the data. Comment key steps in English.
Return ONLY one \`\`\`r code block.`;
  }

  return `${shared}

Requirements (Python: pandas + seaborn + matplotlib, publication quality):
- import pandas as pd, seaborn as sns, matplotlib.pyplot as plt. Build a DataFrame inline from the parsed data.
- Choose the correct seaborn/matplotlib geometry for the requested chart type. Examples: barplot/catplot for bars, lineplot for curves, scatterplot for scatter/PCA/UMAP, heatmap for matrices/confusion matrices, histplot/kdeplot/boxplot/violinplot for distributions, errorbar or hlines for forest/errorbar plots. If a specialized package would be ideal (e.g. lifelines for Kaplan-Meier, shap for SHAP beeswarm), include a clear fallback implementation using pandas/matplotlib and a TODO comment.
- For statistical inference charts, show uncertainty honestly: confidence intervals, reference lines, or thresholds must be labeled and not invented.
- For model evaluation charts (ROC/PR/calibration/lift/learning curves), keep axes in valid ranges and add no-skill baselines where appropriate.
- For bioinformatics charts (volcano/Manhattan/enrichment), label only a few top hits and state thresholds as variables at the top.
- sns.set_theme(style="whitegrid", context="paper") then refine: sns.despine(), thin grid, no chart junk, readable label/tick fontsizes (11-13), dpi=300.
- PROPORTION: choose a balanced figure size, NOT overly wide/flat. For few categories (<=4) use about (5, 4); for many use up to (7, 4.2). Keep bars a sensible width so they are not fat with big empty gaps.
- LEGEND: if there is a hue/grouping, place the legend OUTSIDE the plotting area so it NEVER overlaps bars/points — e.g. ax.legend(title=..., bbox_to_anchor=(1.02, 1), loc="upper left", frameon=False, borderaxespad=0). If there is no grouping, do not add a legend.
- Use the EXACT palette hex list above via sns.set_palette([...]) or the palette= argument so colors are cohesive.
- Clear title (ax.set_title), axis labels; call plt.tight_layout() AFTER moving the legend.
- End by saving BOTH a 300-dpi PNG and a vector PDF with bbox_inches="tight" so the external legend is included: plt.savefig("figure.png", dpi=300, bbox_inches="tight"); plt.savefig("figure.pdf", bbox_inches="tight").
- Code must run as-is after the user edits the data. Comment key steps in English.
Return ONLY one \`\`\`python code block.`;
}

function extractCode(text: string, language: "python" | "r") {
  const fence = language === "r" ? /```(?:r|R)\s*([\s\S]*?)```/ : /```(?:python|py)\s*([\s\S]*?)```/;
  const matched = text.match(fence) || text.match(/```\s*([\s\S]*?)```/);
  const code = (matched ? matched[1] : text).trim();
  return code.length > 20 ? code : "";
}

function fallbackCode(input: ChartInput) {
  const palette = resolvePalette(input.palette).fills;
  if (input.library === "ggplot2") {
    return fallbackR(input, palette);
  }
  return fallbackPython(input, palette);
}

function fallbackPython(input: ChartInput, palette: string[]) {
  const title = input.title || chartTypeMeta(input.chartType)?.label || "Figure";
  if (["roc", "pr-curve", "line", "learning-curve", "calibration"].includes(input.chartType)) {
    const x = input.chartType === "pr-curve" ? "Recall" : input.chartType === "roc" ? "FPR" : "Step";
    const y = input.chartType === "pr-curve" ? "Precision" : input.chartType === "roc" ? "TPR" : "Score";
    return `import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# TODO: replace with your real curve data
df = pd.DataFrame({
    "${x}": [0.0, 0.1, 0.3, 0.6, 1.0, 0.0, 0.08, 0.25, 0.55, 1.0],
    "${y}": [0.0, 0.42, 0.68, 0.86, 1.0, 0.0, 0.58, 0.82, 0.93, 1.0],
    "Model": ["Baseline"] * 5 + ["Ours"] * 5
})

palette = ["${palette.slice(0, 4).join('", "')}"]
sns.set_theme(style="whitegrid", context="paper")
fig, ax = plt.subplots(figsize=(5.5, 4.2))
sns.lineplot(data=df, x="${x}", y="${y}", hue="Model", marker="o", palette=palette, ax=ax)
${input.chartType === "roc" ? 'ax.plot([0, 1], [0, 1], linestyle="--", color="#9aa3ad", linewidth=1, label="No skill")' : ""}
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
sns.despine()
ax.set_title("${title}")
ax.set_xlabel("${input.xLabel || x}")
ax.set_ylabel("${input.yLabel || y}")
ax.legend(bbox_to_anchor=(1.02, 1), loc="upper left", frameon=False, borderaxespad=0)
plt.tight_layout()
plt.savefig("figure.png", dpi=300, bbox_inches="tight")
plt.savefig("figure.pdf", bbox_inches="tight")`;
  }

  if (input.chartType === "confusion-matrix" || input.chartType === "heatmap" || input.chartType === "correlation") {
    return `import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# TODO: replace with your real matrix data
df = pd.DataFrame({
    "True": ["Class A", "Class A", "Class B", "Class B"],
    "Predicted": ["Class A", "Class B", "Class A", "Class B"],
    "Count": [86, 14, 9, 91]
})
matrix = df.pivot(index="True", columns="Predicted", values="Count")

sns.set_theme(style="white", context="paper")
fig, ax = plt.subplots(figsize=(5, 4.5))
sns.heatmap(matrix, annot=True, fmt=".0f", cmap="Blues", linewidths=0.5, linecolor="white", cbar_kws={"label": "Count"}, ax=ax)
ax.set_title("${title}")
ax.set_xlabel("${input.xLabel || "Predicted label"}")
ax.set_ylabel("${input.yLabel || "True label"}")
plt.tight_layout()
plt.savefig("figure.png", dpi=300, bbox_inches="tight")
plt.savefig("figure.pdf", bbox_inches="tight")`;
  }

  if (input.chartType === "forest" || input.chartType === "errorbar") {
    return `import pandas as pd
import matplotlib.pyplot as plt

# TODO: replace with your real effect estimates and confidence intervals
df = pd.DataFrame({
    "Study": ["Group A", "Group B", "Group C", "Overall"],
    "Effect": [0.22, 0.15, 0.31, 0.24],
    "Lower": [0.08, -0.02, 0.18, 0.14],
    "Upper": [0.36, 0.31, 0.44, 0.34]
})
df = df.iloc[::-1].reset_index(drop=True)

fig, ax = plt.subplots(figsize=(5.8, 3.8))
y = range(len(df))
ax.errorbar(df["Effect"], y, xerr=[df["Effect"] - df["Lower"], df["Upper"] - df["Effect"]], fmt="o", color="${palette[0]}", ecolor="#6b7280", capsize=3)
ax.axvline(0, color="#9aa3ad", linestyle="--", linewidth=1)
ax.set_yticks(list(y))
ax.set_yticklabels(df["Study"])
ax.set_title("${title}")
ax.set_xlabel("${input.xLabel || "Effect size"}")
ax.set_ylabel("")
ax.grid(axis="x", alpha=0.25)
for spine in ["top", "right", "left"]:
    ax.spines[spine].set_visible(False)
plt.tight_layout()
plt.savefig("figure.png", dpi=300, bbox_inches="tight")
plt.savefig("figure.pdf", bbox_inches="tight")`;
  }

  if (input.chartType === "volcano") {
    return `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# TODO: replace with your real differential analysis results
df = pd.DataFrame({
    "Gene": ["GeneA", "GeneB", "GeneC", "GeneD", "GeneE", "GeneF"],
    "log2FC": [1.8, -1.4, 0.4, 2.2, -0.9, 0.2],
    "pValue": [0.0004, 0.002, 0.18, 0.00008, 0.04, 0.63]
})
fc_threshold = 1.0
p_threshold = 0.05
df["neg_log10_p"] = -np.log10(df["pValue"])
df["Status"] = np.where((df["log2FC"] >= fc_threshold) & (df["pValue"] < p_threshold), "Up",
                np.where((df["log2FC"] <= -fc_threshold) & (df["pValue"] < p_threshold), "Down", "Not significant"))

colors = {"Up": "${palette[0]}", "Down": "${palette[1]}", "Not significant": "#b8c0c8"}
fig, ax = plt.subplots(figsize=(5.5, 4.2))
for status, group in df.groupby("Status"):
    ax.scatter(group["log2FC"], group["neg_log10_p"], s=42, label=status, color=colors[status], alpha=0.86)
ax.axvline(fc_threshold, linestyle="--", color="#9aa3ad", linewidth=1)
ax.axvline(-fc_threshold, linestyle="--", color="#9aa3ad", linewidth=1)
ax.axhline(-np.log10(p_threshold), linestyle="--", color="#9aa3ad", linewidth=1)
for _, row in df.nsmallest(3, "pValue").iterrows():
    ax.text(row["log2FC"], row["neg_log10_p"] + 0.08, row["Gene"], fontsize=9, ha="center")
ax.set_title("${title}")
ax.set_xlabel("${input.xLabel || "log2 fold change"}")
ax.set_ylabel("${input.yLabel || "-log10(p-value)"}")
ax.legend(bbox_to_anchor=(1.02, 1), loc="upper left", frameon=False, borderaxespad=0)
plt.tight_layout()
plt.savefig("figure.png", dpi=300, bbox_inches="tight")
plt.savefig("figure.pdf", bbox_inches="tight")`;
  }

  if (input.chartType === "feature-importance" || input.chartType === "shap-summary") {
    return `import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# TODO: replace with your real model explanation values
df = pd.DataFrame({
    "Feature": ["User activity", "Query intent", "Item popularity", "Price feature", "Freshness"],
    "Importance": [0.28, 0.22, 0.18, 0.13, 0.10]
}).sort_values("Importance", ascending=True)

sns.set_theme(style="whitegrid", context="paper")
fig, ax = plt.subplots(figsize=(5.6, 3.8))
sns.barplot(data=df, x="Importance", y="Feature", color="${palette[0]}", ax=ax)
sns.despine(left=True)
ax.set_title("${title}")
ax.set_xlabel("${input.xLabel || "Predictive contribution"}")
ax.set_ylabel("")
plt.tight_layout()
plt.savefig("figure.png", dpi=300, bbox_inches="tight")
plt.savefig("figure.pdf", bbox_inches="tight")`;
  }

  return `import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# TODO: replace with your real data
df = pd.DataFrame({"group": ["A", "B", "C", "D"], "value": [12, 19, 8, 15]})

palette = ["${palette.slice(0, 4).join('", "')}"]
sns.set_theme(style="whitegrid", context="paper")

fig, ax = plt.subplots(figsize=(6.5, 4))
sns.barplot(data=df, x="group", y="value", palette=palette, ax=ax)
sns.despine()
ax.set_title("${title}")
ax.set_xlabel("${input.xLabel || "Group"}")
ax.set_ylabel("${input.yLabel || "Value"}")
plt.tight_layout()
plt.savefig("figure.png", dpi=300, bbox_inches="tight")
plt.savefig("figure.pdf", bbox_inches="tight")`;
}

function fallbackR(input: ChartInput, palette: string[]) {
  const title = input.title || chartTypeMeta(input.chartType)?.label || "Figure";
  if (["roc", "pr-curve", "line", "learning-curve", "calibration"].includes(input.chartType)) {
    const x = input.chartType === "pr-curve" ? "Recall" : input.chartType === "roc" ? "FPR" : "Step";
    const y = input.chartType === "pr-curve" ? "Precision" : input.chartType === "roc" ? "TPR" : "Score";
    return `library(tidyverse)

# TODO: replace with your real curve data
df <- tribble(
  ~${x}, ~${y}, ~Model,
  0.00, 0.00, "Baseline",
  0.10, 0.42, "Baseline",
  0.30, 0.68, "Baseline",
  0.60, 0.86, "Baseline",
  1.00, 1.00, "Baseline",
  0.00, 0.00, "Ours",
  0.08, 0.58, "Ours",
  0.25, 0.82, "Ours",
  0.55, 0.93, "Ours",
  1.00, 1.00, "Ours"
)

palette <- c("${palette.slice(0, 4).join('", "')}")

p <- ggplot(df, aes(x = ${x}, y = ${y}, color = Model)) +
  geom_line(linewidth = 0.9) +
  geom_point(size = 2) +
  ${input.chartType === "roc" ? 'geom_abline(slope = 1, intercept = 0, linetype = "dashed", color = "#9aa3ad") +' : ""}
  scale_color_manual(values = palette) +
  coord_cartesian(xlim = c(0, 1), ylim = c(0, 1)) +
  labs(title = "${title}", x = "${input.xLabel || x}", y = "${input.yLabel || y}") +
  theme_minimal(base_size = 12) +
  theme(panel.grid.minor = element_blank(), legend.position = "right")

ggsave("figure.pdf", p, width = 5.8, height = 4)
ggsave("figure.png", p, width = 5.8, height = 4, dpi = 300)`;
  }

  if (input.chartType === "confusion-matrix" || input.chartType === "heatmap" || input.chartType === "correlation") {
    return `library(tidyverse)

# TODO: replace with your real data
df <- tribble(
  ~True, ~Predicted, ~Count,
  "Class A", "Class A", 86,
  "Class A", "Class B", 14,
  "Class B", "Class A", 9,
  "Class B", "Class B", 91
)

p <- ggplot(df, aes(x = Predicted, y = True, fill = Count)) +
  geom_tile(color = "white", linewidth = 0.5) +
  geom_text(aes(label = Count), size = 3.5) +
  scale_fill_gradient(low = "#eef4fb", high = "${palette[0]}") +
  labs(title = "${title}", x = "${input.xLabel || "Predicted label"}", y = "${input.yLabel || "True label"}", fill = "Count") +
  theme_minimal(base_size = 12) +
  theme(panel.grid = element_blank(), legend.position = "right")

ggsave("figure.pdf", p, width = 5, height = 4.5)
ggsave("figure.png", p, width = 5, height = 4.5, dpi = 300)`;
  }

  if (input.chartType === "forest" || input.chartType === "errorbar") {
    return `library(tidyverse)

# TODO: replace with your real effect estimates and confidence intervals
df <- tribble(
  ~Study, ~Effect, ~Lower, ~Upper,
  "Group A", 0.22, 0.08, 0.36,
  "Group B", 0.15, -0.02, 0.31,
  "Group C", 0.31, 0.18, 0.44,
  "Overall", 0.24, 0.14, 0.34
) |> mutate(Study = fct_rev(factor(Study, levels = Study)))

p <- ggplot(df, aes(x = Effect, y = Study)) +
  geom_vline(xintercept = 0, linetype = "dashed", color = "#9aa3ad") +
  geom_errorbarh(aes(xmin = Lower, xmax = Upper), height = 0.18, color = "#6b7280") +
  geom_point(size = 2.8, color = "${palette[0]}") +
  labs(title = "${title}", x = "${input.xLabel || "Effect size"}", y = NULL) +
  theme_minimal(base_size = 12) +
  theme(panel.grid.minor = element_blank())

ggsave("figure.pdf", p, width = 5.8, height = 3.8)
ggsave("figure.png", p, width = 5.8, height = 3.8, dpi = 300)`;
  }

  if (input.chartType === "volcano") {
    return `library(tidyverse)

# TODO: replace with your real differential analysis results
df <- tribble(
  ~Gene, ~log2FC, ~pValue,
  "GeneA", 1.8, 0.0004,
  "GeneB", -1.4, 0.002,
  "GeneC", 0.4, 0.18,
  "GeneD", 2.2, 0.00008,
  "GeneE", -0.9, 0.04,
  "GeneF", 0.2, 0.63
) |>
  mutate(
    neg_log10_p = -log10(pValue),
    Status = case_when(
      log2FC >= 1 & pValue < 0.05 ~ "Up",
      log2FC <= -1 & pValue < 0.05 ~ "Down",
      TRUE ~ "Not significant"
    )
  )

p <- ggplot(df, aes(x = log2FC, y = neg_log10_p, color = Status)) +
  geom_point(size = 2.6, alpha = 0.86) +
  geom_vline(xintercept = c(-1, 1), linetype = "dashed", color = "#9aa3ad") +
  geom_hline(yintercept = -log10(0.05), linetype = "dashed", color = "#9aa3ad") +
  geom_text(data = slice_min(df, pValue, n = 3), aes(label = Gene), vjust = -0.8, size = 3, show.legend = FALSE) +
  scale_color_manual(values = c("Up" = "${palette[0]}", "Down" = "${palette[1]}", "Not significant" = "#b8c0c8")) +
  labs(title = "${title}", x = "${input.xLabel || "log2 fold change"}", y = "${input.yLabel || "-log10(p-value)"}") +
  theme_minimal(base_size = 12) +
  theme(panel.grid.minor = element_blank(), legend.position = "right")

ggsave("figure.pdf", p, width = 5.8, height = 4.2)
ggsave("figure.png", p, width = 5.8, height = 4.2, dpi = 300)`;
  }

  if (input.chartType === "feature-importance" || input.chartType === "shap-summary") {
    return `library(tidyverse)

# TODO: replace with your real model explanation values
df <- tribble(
  ~Feature, ~Importance,
  "User activity", 0.28,
  "Query intent", 0.22,
  "Item popularity", 0.18,
  "Price feature", 0.13,
  "Freshness", 0.10
) |> mutate(Feature = fct_reorder(Feature, Importance))

p <- ggplot(df, aes(x = Importance, y = Feature)) +
  geom_col(fill = "${palette[0]}", width = 0.72) +
  labs(title = "${title}", x = "${input.xLabel || "Predictive contribution"}", y = NULL) +
  theme_minimal(base_size = 12) +
  theme(panel.grid.minor = element_blank())

ggsave("figure.pdf", p, width = 5.6, height = 3.8)
ggsave("figure.png", p, width = 5.6, height = 3.8, dpi = 300)`;
  }

  return `library(tidyverse)

# TODO: replace with your real data
df <- tribble(
  ~group, ~value,
  "A", 12, "B", 19, "C", 8, "D", 15
)

palette <- c("${palette.slice(0, 4).join('", "')}")

p <- ggplot(df, aes(x = group, y = value, fill = group)) +
  geom_col(width = 0.7) +
  scale_fill_manual(values = palette) +
  labs(title = "${title}", x = "${input.xLabel || "Group"}", y = "${input.yLabel || "Value"}") +
  theme_minimal(base_size = 12) +
  theme(panel.grid.minor = element_blank(), legend.position = "none")

ggsave("figure.pdf", p, width = 6.5, height = 4)
ggsave("figure.png", p, width = 6.5, height = 4, dpi = 300)`;
}
