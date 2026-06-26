import { FigurePlan } from "@/lib/types";

export const sampleText =
  "摘要：本文提出一种面向多模态科研数据分析的框架，通过文献语义抽取、实验流程建模和结果证据对齐，将复杂研究过程转化为可解释的结构化图示。方法部分包含数据预处理、特征融合、模型推理、消融验证和专家反馈。实验结果表明，该框架能够提升科研汇报中的信息组织效率，并减少图示设计过程中的反复修改。";

export type ResearchPreset = {
  id: string;
  title: string;
  plainTitle: string;
  description: string;
  field: string;
  figureType: string;
  purpose: string;
  palette: string;
  style: string;
  sample: string;
  bestFor: string;
};

export type FigureChoiceAdvice = {
  recommendedType: string;
  confidence: "高" | "中" | "低";
  reason: string;
  avoid: string;
  missing: string[];
};

export const PRESETS: ResearchPreset[] = [
  {
    id: "stat-ml",
    title: "统计 / 机器学习",
    plainTitle: "我有数据和模型，想讲清楚建模流程",
    description: "适合统计学、数学学院、机器学习课程项目或论文方法图。",
    field: "Statistics / Machine Learning",
    figureType: "method-framework",
    purpose: "论文投稿 / 面试项目展示",
    palette: "journal-balanced",
    style: "clean vector academic style, evidence-grounded, readable labels",
    bestFor: "预测建模、回归/分类、特征工程、交叉验证、不确定性分析",
    sample:
      "本文面向统计学背景下的机器学习建模问题，研究如何从用户行为样本和统计特征中构建稳健预测模型。方法包括缺失值处理、变量标准化、特征交叉、正则化逻辑回归、梯度提升树和深度神经网络，并使用交叉验证、AUC、校准曲线和不确定性分析评估模型。结果不声称因果结论，只用于预测和辅助决策。"
  },
  {
    id: "search-rec",
    title: "搜索 / 推荐系统",
    plainTitle: "我想画一个召回、排序、反馈闭环系统",
    description: "适合推荐系统、搜索排序、广告 CTR、信息流项目展示。",
    field: "Search and Recommendation / Machine Learning",
    figureType: "method-framework",
    purpose: "面试项目展示 / 技术方案说明",
    palette: "journal-balanced",
    style: "clean system architecture figure, readable labels, evidence-grounded",
    bestFor: "用户画像、召回、双塔、向量检索、排序、重排、A/B test",
    sample:
      "项目设计一个搜索推荐系统：输入用户 query、用户画像、商品内容特征、曝光和点击日志。系统先通过双塔模型和向量检索召回候选 item，再使用深度排序模型预测 CTR 和相关性分数，之后通过多样性、去重和业务规则重排，输出 top-K 推荐结果。在线反馈包括点击、停留时长和 A/B test 指标，用于持续训练迭代。"
  },
  {
    id: "vision",
    title: "图像处理 / 深度学习",
    plainTitle: "我有图像输入、网络结构和视觉结果",
    description: "适合图像去噪、增强、检测、分割、视觉 backbone 方法图。",
    field: "Image Processing / Deep Learning",
    figureType: "neural-network",
    purpose: "论文投稿 / 面试项目展示",
    palette: "nature-muted",
    style: "clean vector deep learning architecture, readable labels, no fabricated metrics",
    bestFor: "CNN、ViT、U-Net、图像增强、检测/分割、PSNR/SSIM、可视化对比",
    sample:
      "本文提出一种图像处理深度学习框架，用于图像去噪和细节增强。输入低质量图像帧，先进行 resize、归一化和数据增强，再通过 CNN backbone 与注意力模块提取多尺度视觉特征，最后由 restoration head 输出增强图像和置信图。评估使用 PSNR、SSIM、可视化对比和失败案例分析，不伪造示例。"
  },
  {
    id: "paper-general",
    title: "通用论文方法图",
    plainTitle: "我只有摘要，想先快速生成一版草图",
    description: "适合刚开始整理想法、组会汇报或课程论文。",
    field: "AI for Science",
    figureType: "method-framework",
    purpose: "组会汇报 / 论文草稿",
    palette: "journal-balanced",
    style: "clean vector academic style, readable labels",
    bestFor: "摘要、方法、实验、贡献还没有完全成型的早期草稿",
    sample: sampleText
  }
];

export function inputChecks(text: string, presetId: string) {
  const value = text.toLowerCase();
  const checks = [
    { label: "说明研究问题或项目目标", ok: /研究|目标|问题|提出|project|task|predict|推荐|搜索|图像|模型/.test(value) },
    { label: "说明输入数据或样本来源", ok: /数据|样本|用户|query|日志|图像|文本|指标|dataset|sample|input|image|user/.test(value) },
    { label: "说明方法、模型或处理流程", ok: /方法|模型|框架|回归|分类|网络|cnn|transformer|双塔|召回|排序|预处理|feature|model|pipeline/.test(value) },
    { label: "说明输出结果或应用场景", ok: /输出|结果|预测|评分|top-k|推荐|增强|检测|分割|output|result|prediction|ranking/.test(value) },
    { label: "说明评价指标或验证方式", ok: /auc|f1|rmse|mse|psnr|ssim|交叉验证|校准|ablation|消融|a\/b|指标|评估|验证|metric|evaluation/.test(value) },
    { label: "说明限制，避免把图画得过度夸张", ok: /不声称|限制|局限|不能|仅用于|辅助|不伪造|human|verify|limitation|not claim/.test(value) }
  ];
  if (presetId === "search-rec") {
    checks.push({ label: "推荐/搜索最好写清召回、排序、重排或反馈闭环", ok: /召回|排序|重排|反馈|retrieval|ranking|rerank|feedback|ctr|cvr/.test(value) });
  }
  if (presetId === "vision") {
    checks.push({ label: "图像处理最好写清 backbone、任务 head 和视觉指标", ok: /cnn|vit|u-net|unet|backbone|head|psnr|ssim|iou|dice|检测|分割|去噪|增强/.test(value) });
  }
  return checks;
}

export function recommendFigureChoice(text: string, field: string, presetId: string): FigureChoiceAdvice {
  const value = `${text} ${field}`.toLowerCase();
  const missing: string[] = [];
  const hasMetric = /auc|f1|rmse|mse|psnr|ssim|iou|dice|指标|评估|验证|metric|evaluation|accuracy|recall|precision/.test(value);
  const hasData = /数据|样本|dataset|sample|日志|图像|文本|query|user|item|input/.test(value);
  const hasLimit = /限制|局限|不能|不声称|仅用于|不伪造|limitation|not claim|caution/.test(value);
  if (!hasData) missing.push("输入数据或样本来源");
  if (!hasMetric) missing.push("评价指标或验证方式");
  if (!hasLimit) missing.push("限制/边界条件，避免图里过度声称");

  if (/召回|排序|重排|推荐|搜索|query|ctr|cvr|top-k|retrieval|ranking|rerank|recommend/.test(value) || presetId === "search-rec") {
    return {
      recommendedType: "data-pipeline",
      confidence: hasData && hasMetric ? "高" : "中",
      reason: "你的内容像搜索/推荐系统，读者最关心信号输入、召回、排序、重排和在线反馈闭环。",
      avoid: "暂时不建议画机制图；除非你有明确因果机制证据，否则容易被误读成因果结论。",
      missing
    };
  }
  if (/图像|视频|cnn|vit|u-net|unet|backbone|检测|分割|去噪|增强|psnr|ssim|image|vision|segmentation|detection/.test(value) || presetId === "vision") {
    return {
      recommendedType: "neural-network",
      confidence: hasData && /backbone|cnn|vit|u-net|unet|head|网络|模型/.test(value) ? "高" : "中",
      reason: "你的内容包含视觉输入和网络模块，神经网络架构图更能讲清 backbone、head、输出和指标。",
      avoid: "不要直接用图片模型生成带密集标签的网络图；标签很容易错，优先用 SVG。",
      missing
    };
  }
  if (/消融|baseline|对比|ablation|compare|comparison|improve|提升|优于/.test(value)) {
    return {
      recommendedType: "comparison",
      confidence: hasMetric ? "高" : "中",
      reason: "文本里有对比或消融信号，适合把 Baseline、Ours、Evidence 和 Conclusion 分开画。",
      avoid: "如果没有真实指标或实验设置，不要把对比画成性能结论。",
      missing
    };
  }
  if (/时间|阶段|phase|timeline|version|迭代|流程阶段/.test(value)) {
    return {
      recommendedType: "timeline",
      confidence: "中",
      reason: "你的内容像按阶段展开，时间线能减少流程箭头拥挤。",
      avoid: "如果核心是模型结构而不是阶段推进，时间线会削弱方法重点。",
      missing
    };
  }
  if (/统计|回归|分类|预测|交叉验证|校准|不确定性|regression|classification|cross-validation|uncertainty/.test(value) || presetId === "stat-ml") {
    return {
      recommendedType: "method-framework",
      confidence: hasData && hasMetric ? "高" : "中",
      reason: "统计/机器学习项目通常先讲问题、数据、建模、验证和决策输出，方法框架图最稳。",
      avoid: "别把预测模型画成因果机制；如果只是预测/辅助决策，图里要保持保守措辞。",
      missing
    };
  }
  return {
    recommendedType: "method-framework",
    confidence: missing.length <= 1 ? "中" : "低",
    reason: "信息还比较通用，方法框架图容错最高，适合作为第一版草图。",
    avoid: "不建议一上来画 Graphical Abstract；内容证据不足时容易变成好看但空泛的插画。",
    missing
  };
}

export function figureTypeLabel(value: string) {
  const labels: Record<string, string> = {
    "method-framework": "方法框架",
    "experiment-flow": "实验流程",
    "graphical-abstract": "图文摘要",
    mechanism: "机制图",
    comparison: "对比图",
    timeline: "时间线",
    "neural-network": "网络架构",
    "data-pipeline": "数据流程"
  };
  return labels[value] ?? value;
}

export function rendererLabel(plan: FigurePlan) {
  const titles = plan.spec?.architecture?.blocks.map((block) => block.title).join(" ") ?? "";
  if (/Candidate retrieval|Ranking model|Served results|Online feedback/i.test(titles)) return "专用布局：搜索推荐系统";
  if (/Image \/ video input|CNN backbone|Vision Transformer|U-Net|Visual evidence|Restoration head|Segmentation head|Detection head/i.test(titles)) return "专用布局：图像处理 / 深度学习";
  if (/Statistical question|Evaluation and uncertainty|Decision output/i.test(titles)) return "专用布局：统计机器学习";
  if (/Input modalities|Clinical outputs|Validation and caution/i.test(titles)) return "专用布局：多模态方法架构";
  if (plan.spec?.architecture) return "专用布局：方法架构";
  return `通用布局：${figureTypeLabel(plan.template)}`;
}

export function scoreExplain(score: number) {
  if (score >= 88) return "适合作为主方案：结构、证据和可读性都比较稳。";
  if (score >= 78) return "可用草图：建议先看黄色风险提示，再优化标签。";
  return "需要谨慎：可能缺证据或结构不够清楚。";
}
