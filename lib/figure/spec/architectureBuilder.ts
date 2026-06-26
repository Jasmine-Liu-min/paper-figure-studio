import { ArchitectureDiagram, FigureObject, PaperInput, PaperStructure } from "../../types";

type ArchitectureBuilderHelpers = {
  uniqueLabels: (labels: string[]) => string[];
  shortenLabel: (value: string, max: number) => string;
  cleanFigureLabel: (value: string) => string;
  classifyLabelStage: (label: string) => number;
};

export function buildArchitectureDiagram(input: PaperInput, structure: PaperStructure, objects: FigureObject[], helpers: ArchitectureBuilderHelpers): ArchitectureDiagram | undefined {
  if (!["method-framework", "neural-network", "data-pipeline"].includes(input.figureType)) return undefined;
  const text = `${input.text}\n${structure.abstract}\n${structure.methods.map((section) => section.content).join("\n")}`.toLowerCase();
  if (isRecommenderSearch(text, objects)) return buildRecommenderSearchArchitecture(text, objects);
  if (isImageProcessing(text, objects)) return buildImageProcessingArchitecture(text, objects);
  if (isMedicalMultimodal(text, objects)) return buildMedicalMultimodalArchitecture(text, objects, helpers);
  if (isStatisticalMachineLearning(text, objects, input.field)) return buildStatMlArchitecture(text, objects, structure);
  if (input.figureType === "data-pipeline") return buildDataPipelineArchitecture(objects, structure, helpers);
  return buildGeneralModelArchitecture(objects, structure, input.figureType, helpers);
}

function buildMedicalMultimodalArchitecture(text: string, objects: FigureObject[], helpers: ArchitectureBuilderHelpers): ArchitectureDiagram {
  const label = (pattern: RegExp, fallback: string) => objects.find((object) => pattern.test(object.label))?.label ?? fallback;
  const includes = (pattern: RegExp) => pattern.test(text) || objects.some((object) => pattern.test(object.label));
  const inputSteps = [
    label(/ct|图像|影像|image/i, "Chest CT image"),
    label(/病历|电子病历|文本|record|text/i, "EHR text"),
    label(/实验室|指标|lab|indicator/i, "Lab indicators")
  ];
  const imageEncoder = label(/图像编码器|image encoder/i, "Image encoder");
  const textEncoder = label(/文本编码器|text encoder/i, "Text encoder");
  const fusion = label(/medfuse|跨模态|注意力|融合|fusion|attention/i, "Cross-modal attention fusion");
  const outputSteps = [
    label(/诊断|风险评分|risk|score/i, "Diagnostic risk score"),
    label(/热力图|heatmap/i, "Image heatmap"),
    label(/证据摘要|evidence summary/i, "Text evidence summary")
  ];
  const validationSteps = [
    includes(/auc/i) ? "AUC / F1 / recall" : "reported metrics",
    includes(/消融|ablation/i) ? "ablation evidence" : "module contribution check",
    includes(/辅助筛查|科研分析|not replace|替代医生/i) ? "auxiliary screening only" : "clinical use requires verification"
  ];

  return {
    blocks: [
      {
        title: "Input modalities",
        abbrev: "IN",
        category: "input",
        substeps: helpers.uniqueLabels(inputSteps).slice(0, 3)
      },
      {
        title: imageEncoder,
        abbrev: "IMG",
        category: "encoder",
        substeps: [includes(/病灶|lesion/i) ? "lesion-region features" : "image features", "image representation"]
      },
      {
        title: textEncoder,
        abbrev: "TXT",
        category: "encoder",
        substeps: [includes(/症状|symptom/i) ? "symptoms" : "clinical cues", includes(/病史|history/i) ? "history" : "context", includes(/用药|medication/i) ? "medication cues" : "text representation"]
      },
      {
        title: fusion,
        abbrev: /medfuse/i.test(fusion) ? "MF" : "FUS",
        category: "fusion",
        substeps: [includes(/跨模态|cross-modal/i) ? "cross-modal attention" : "feature fusion", "feature alignment", "fused representation"]
      },
      {
        title: "Clinical outputs",
        abbrev: "OUT",
        category: "output",
        substeps: helpers.uniqueLabels(outputSteps).slice(0, 3)
      },
      {
        title: "Validation and caution",
        abbrev: "CHK",
        category: "evidence",
        substeps: validationSteps
      }
    ],
    connections: [
      { from: "Input modalities", to: imageEncoder, label: "CT / image" },
      { from: "Input modalities", to: textEncoder, label: "clinical text" },
      { from: "Input modalities", to: fusion, label: "structured indicators" },
      { from: imageEncoder, to: fusion, label: "lesion features" },
      { from: textEncoder, to: fusion, label: "clinical evidence" },
      { from: fusion, to: "Clinical outputs", label: "interpretable prediction" },
      { from: "Clinical outputs", to: "Validation and caution", label: "supported claims" }
    ],
    legend: [
      { label: "Input evidence", category: "input" },
      { label: "Encoders", category: "encoder" },
      { label: "Fusion core", category: "fusion" },
      { label: "Outputs", category: "output" },
      { label: "Review checks", category: "evidence" }
    ]
  };
}

function buildGeneralModelArchitecture(objects: FigureObject[], structure: PaperStructure, figureType: PaperInput["figureType"], helpers: ArchitectureBuilderHelpers): ArchitectureDiagram | undefined {
  const groups = groupObjectsByStage(objects);
  const inputSteps = groups.inputs.map((object) => object.label).slice(0, 3);
  const encoderSteps = groups.encoders.map((object) => object.label).slice(0, 3);
  const fusionSteps = groups.fusion.map((object) => object.label).slice(0, 3);
  const outputSteps = groups.outputs.map((object) => object.label).slice(0, 3);
  if (inputSteps.length + encoderSteps.length + fusionSteps.length + outputSteps.length < 4) return undefined;
  const coreTitle = fusionSteps.find((item) => /framework|model|模型|框架|fusion|attention|融合|注意力/i.test(item)) ?? (figureType === "neural-network" ? "Core model" : "Method core");

  return {
    blocks: [
      {
        title: "Input evidence",
        abbrev: "IN",
        category: "input",
        substeps: inputSteps.length ? inputSteps : ["source data", "research context"]
      },
      {
        title: figureType === "neural-network" ? "Representation modules" : "Feature processing",
        abbrev: figureType === "neural-network" ? "REP" : "FEAT",
        category: "encoder",
        substeps: encoderSteps.length ? encoderSteps : ["preprocess", "feature extraction"]
      },
      {
        title: coreTitle,
        abbrev: "CORE",
        category: "fusion",
        substeps: fusionSteps.length ? fusionSteps : ["integration", "reasoning"]
      },
      {
        title: "Outputs / findings",
        abbrev: "OUT",
        category: "output",
        substeps: outputSteps.length ? outputSteps : ["supported output", "evaluation evidence"]
      },
      {
        title: "Evidence checks",
        abbrev: "CHK",
        category: "evidence",
        substeps: [
          structure.results[0]?.content ? helpers.shortenLabel(helpers.cleanFigureLabel(structure.results[0].content), 24) : "reported results",
          "no invented metrics",
          "human verification"
        ]
      }
    ],
    connections: [
      { from: "Input evidence", to: figureType === "neural-network" ? "Representation modules" : "Feature processing", label: "prepared evidence" },
      { from: figureType === "neural-network" ? "Representation modules" : "Feature processing", to: coreTitle, label: "features" },
      { from: coreTitle, to: "Outputs / findings", label: "prediction / result" },
      { from: coreTitle, to: "Evidence checks", label: "review" }
    ],
    legend: [
      { label: "Inputs", category: "input" },
      { label: "Processing", category: "encoder" },
      { label: "Core method", category: "fusion" },
      { label: "Outputs", category: "output" },
      { label: "Checks", category: "evidence" }
    ]
  };
}

function buildStatMlArchitecture(text: string, objects: FigureObject[], structure: PaperStructure): ArchitectureDiagram {
  const label = (pattern: RegExp, fallback: string) => objects.find((object) => pattern.test(object.label))?.label ?? fallback;
  const includes = (pattern: RegExp) => pattern.test(text) || objects.some((object) => pattern.test(object.label));
  const data = label(/样本|数据|dataset|sample|observation|用户|图像|特征/i, "Observed data");
  const model = label(/模型|回归|分类|树|boost|forest|xgboost|transformer|network|神经网络|深度/i, includes(/深度|神经|transformer|network|deep/i) ? "Deep learning model" : "Statistical learning model");
  return {
    blocks: [
      {
        title: "Statistical question",
        abbrev: "Q",
        category: "input",
        substeps: [includes(/因果|causal/i) ? "causal estimand" : "prediction target", includes(/假设|hypothesis/i) ? "hypothesis" : "research objective"]
      },
      {
        title: "Data and sampling",
        abbrev: "DATA",
        category: "input",
        substeps: [data, includes(/缺失|missing/i) ? "missingness pattern" : "train / validation split", includes(/偏差|bias/i) ? "bias check" : "data quality check"]
      },
      {
        title: "Feature design",
        abbrev: "FEAT",
        category: "encoder",
        substeps: [includes(/标准化|normalize|scale/i) ? "normalization" : "preprocessing", includes(/embedding|表征|representation/i) ? "representation learning" : "feature extraction", includes(/正则|regular/i) ? "regularization" : "variable control"]
      },
      {
        title: model,
        abbrev: includes(/深度|神经|transformer|network|deep/i) ? "DL" : "ML",
        category: "fusion",
        substeps: [includes(/交叉验证|cross-validation/i) ? "cross-validation" : "training objective", includes(/贝叶斯|bayes/i) ? "posterior inference" : "parameter learning", includes(/集成|ensemble|boost/i) ? "ensemble learning" : "model selection"]
      },
      {
        title: "Evaluation and uncertainty",
        abbrev: "EVAL",
        category: "evidence",
        substeps: [includes(/auc/i) ? "AUC" : includes(/rmse|mse/i) ? "RMSE / MSE" : "primary metric", includes(/置信|confidence|uncertainty/i) ? "uncertainty interval" : "robustness check", includes(/消融|ablation/i) ? "ablation" : "error analysis"]
      },
      {
        title: "Decision output",
        abbrev: "OUT",
        category: "output",
        substeps: [label(/预测|推荐|排序|分类|检测|分割|output|prediction|ranking/i, "prediction / ranking"), "interpretable evidence", "human review"]
      }
    ],
    connections: [
      { from: "Statistical question", to: "Data and sampling", label: "defines target" },
      { from: "Data and sampling", to: "Feature design", label: "clean samples" },
      { from: "Feature design", to: model, label: "features" },
      { from: model, to: "Evaluation and uncertainty", label: "validated estimates" },
      { from: "Evaluation and uncertainty", to: "Decision output", label: "supported use" }
    ],
    legend: [
      { label: "Problem", category: "input" },
      { label: "Features", category: "encoder" },
      { label: "Model", category: "fusion" },
      { label: "Validation", category: "evidence" },
      { label: "Output", category: "output" }
    ]
  };
}

function buildRecommenderSearchArchitecture(text: string, objects: FigureObject[]): ArchitectureDiagram {
  const label = (pattern: RegExp, fallback: string) => objects.find((object) => pattern.test(object.label))?.label ?? fallback;
  const includes = (pattern: RegExp) => pattern.test(text) || objects.some((object) => pattern.test(object.label));
  return {
    blocks: [
      {
        title: "User and item signals",
        abbrev: "SIG",
        category: "input",
        substeps: [
          label(/用户|user|query|查询|搜索/i, includes(/query|查询|搜索/i) ? "query / user intent" : "user profile"),
          label(/item|商品|内容|文档|image|图像/i, "item / document features"),
          includes(/点击|click|曝光|impression/i) ? "click / impression logs" : "interaction history"
        ]
      },
      {
        title: "Candidate retrieval",
        abbrev: "RET",
        category: "encoder",
        substeps: [includes(/双塔|two-tower/i) ? "two-tower embeddings" : "embedding recall", includes(/ann|faiss|向量/i) ? "ANN vector search" : "candidate generation", "recall diversity"]
      },
      {
        title: "Ranking model",
        abbrev: "RANK",
        category: "fusion",
        substeps: [includes(/deep|神经|transformer/i) ? "deep ranking network" : "learning-to-rank", includes(/ctr|点击率/i) ? "CTR / CVR score" : "relevance score", "feature crossing"]
      },
      {
        title: "Re-ranking constraints",
        abbrev: "RE",
        category: "evidence",
        substeps: [includes(/多样性|diversity/i) ? "diversity" : "business / safety rules", includes(/公平|fair/i) ? "fairness check" : "deduplication", "calibration"]
      },
      {
        title: "Served results",
        abbrev: "OUT",
        category: "output",
        substeps: [includes(/搜索|search/i) ? "search result page" : "recommendation feed", "top-K list", "explanation / reason"]
      },
      {
        title: "Online feedback",
        abbrev: "FB",
        category: "feedback",
        substeps: [includes(/ab|a\/b/i) ? "A/B test" : "online metrics", "click / dwell signals", "model iteration"]
      }
    ],
    connections: [
      { from: "User and item signals", to: "Candidate retrieval", label: "intent + features" },
      { from: "Candidate retrieval", to: "Ranking model", label: "hundreds of candidates" },
      { from: "Ranking model", to: "Re-ranking constraints", label: "scored list" },
      { from: "Re-ranking constraints", to: "Served results", label: "top-K" },
      { from: "Served results", to: "Online feedback", label: "behavior logs" },
      { from: "Online feedback", to: "User and item signals", label: "training data" }
    ],
    legend: [
      { label: "Signals", category: "input" },
      { label: "Retrieval", category: "encoder" },
      { label: "Ranking", category: "fusion" },
      { label: "Constraints", category: "evidence" },
      { label: "Results", category: "output" },
      { label: "Feedback", category: "feedback" }
    ]
  };
}

function buildImageProcessingArchitecture(text: string, objects: FigureObject[]): ArchitectureDiagram {
  const label = (pattern: RegExp, fallback: string) => objects.find((object) => pattern.test(object.label))?.label ?? fallback;
  const includes = (pattern: RegExp) => pattern.test(text) || objects.some((object) => pattern.test(object.label));
  const task = includes(/分割|segmentation/i) ? "Segmentation head" : includes(/检测|detection|目标/i) ? "Detection head" : includes(/超分|去噪|增强|restore|restoration|denoise/i) ? "Restoration head" : "Prediction head";
  const backbone = includes(/vit|transformer/i) ? "Vision Transformer backbone" : includes(/u-net|unet/i) ? "U-Net encoder-decoder" : includes(/cnn|卷积/i) ? "CNN backbone" : "Visual encoder";
  return {
    blocks: [
      {
        title: "Image / video input",
        abbrev: "IMG",
        category: "input",
        substeps: [label(/图像|image|video|视频|frame/i, "raw image frames"), includes(/mask|标注|label/i) ? "labels / masks" : "input resolution", includes(/噪声|noise/i) ? "noise profile" : "data source"]
      },
      {
        title: "Preprocessing",
        abbrev: "PRE",
        category: "encoder",
        substeps: [includes(/增强|augment/i) ? "augmentation" : "resize / crop", includes(/归一化|normalize/i) ? "normalization" : "color normalization", includes(/patch|窗口/i) ? "patch extraction" : "batching"]
      },
      {
        title: backbone,
        abbrev: includes(/vit|transformer/i) ? "ViT" : includes(/u-net|unet/i) ? "UNet" : "ENC",
        category: "fusion",
        substeps: [includes(/多尺度|multi-scale|pyramid/i) ? "multi-scale features" : "hierarchical features", includes(/attention|注意力/i) ? "attention module" : "convolution blocks", "latent representation"]
      },
      {
        title: task,
        abbrev: "HEAD",
        category: "output",
        substeps: [includes(/heatmap|热力图/i) ? "heatmap output" : "task-specific output", includes(/边缘|edge/i) ? "edge/detail branch" : "confidence map", "post-processing"]
      },
      {
        title: "Visual evidence",
        abbrev: "VIS",
        category: "evidence",
        substeps: [includes(/psnr/i) ? "PSNR / SSIM" : includes(/iou|dice/i) ? "IoU / Dice" : "quality metrics", includes(/可视化|visual/i) ? "qualitative examples" : "failure cases", "no fabricated examples"]
      }
    ],
    connections: [
      { from: "Image / video input", to: "Preprocessing", label: "frames" },
      { from: "Preprocessing", to: backbone, label: "normalized tensors" },
      { from: backbone, to: task, label: "visual features" },
      { from: task, to: "Visual evidence", label: "metrics + examples" }
    ],
    legend: [
      { label: "Visual data", category: "input" },
      { label: "Preprocess", category: "encoder" },
      { label: "Backbone", category: "fusion" },
      { label: "Output", category: "output" },
      { label: "Evidence", category: "evidence" }
    ]
  };
}

function buildDataPipelineArchitecture(objects: FigureObject[], structure: PaperStructure, helpers: ArchitectureBuilderHelpers): ArchitectureDiagram | undefined {
  const labels = objects.map((object) => object.label);
  const raw = labels.filter((label) => helpers.classifyLabelStage(label) === 0).slice(0, 3);
  const process = labels.filter((label) => helpers.classifyLabelStage(label) === 1).slice(0, 3);
  const analysis = labels.filter((label) => helpers.classifyLabelStage(label) === 2).slice(0, 3);
  const output = labels.filter((label) => helpers.classifyLabelStage(label) === 3).slice(0, 3);
  if (labels.length < 4) return undefined;
  return {
    blocks: [
      { title: "Raw sources", abbrev: "RAW", category: "input", substeps: raw.length ? raw : labels.slice(0, 2) },
      { title: "Curation and features", abbrev: "FEAT", category: "encoder", substeps: process.length ? process : ["cleaning", "feature extraction"] },
      { title: "Quality control", abbrev: "QC", category: "evidence", substeps: ["missingness check", "source alignment", "review checkpoint"] },
      { title: "Analysis core", abbrev: "ANA", category: "fusion", substeps: analysis.length ? analysis : [helpers.shortenLabel(helpers.cleanFigureLabel(structure.methods[0]?.content ?? "analysis"), 24)] },
      { title: "Outputs", abbrev: "OUT", category: "output", substeps: output.length ? output : ["supported finding", "exported artifact"] }
    ],
    connections: [
      { from: "Raw sources", to: "Curation and features", label: "cleaned data" },
      { from: "Curation and features", to: "Quality control", label: "checks" },
      { from: "Quality control", to: "Analysis core", label: "validated features" },
      { from: "Analysis core", to: "Outputs", label: "evidence" }
    ],
    legend: [
      { label: "Data", category: "input" },
      { label: "Transform", category: "encoder" },
      { label: "QC", category: "evidence" },
      { label: "Analysis", category: "fusion" },
      { label: "Output", category: "output" }
    ]
  };
}

function isMedicalMultimodal(text: string, objects: FigureObject[]) {
  const labels = objects.map((object) => object.label).join(" ").toLowerCase();
  const content = `${text} ${labels}`;
  const hasMedical = /医学|医疗|临床|诊断|肺炎|肺结节|慢阻肺|病历|medical|clinical|diagnos|\bct\b|胸部\s*ct|ct\s*(image|scan|影像|图像)/.test(content);
  const hasMultimodal = /多模态|跨模态|multimodal|cross-modal|图像.*文本|文本.*图像|ct.*病历|病历.*ct/.test(content);
  const hasArchitecture = /编码器|encoder|注意力|attention|融合|fusion|medfuse|框架|model/.test(content);
  return hasMedical && (hasMultimodal || hasArchitecture);
}

function isStatisticalMachineLearning(text: string, objects: FigureObject[], field: string) {
  const labels = objects.map((object) => object.label).join(" ").toLowerCase();
  const content = `${text} ${labels} ${field.toLowerCase()}`;
  return /统计|数学|statistic|statistical|machine learning|机器学习|深度学习|deep learning|regression|回归|classification|分类|bayes|贝叶斯|uncertainty|置信|xgboost|random forest|transformer|神经网络/.test(content);
}

function isRecommenderSearch(text: string, objects: FigureObject[]) {
  const labels = objects.map((object) => object.label).join(" ").toLowerCase();
  const content = `${text} ${labels}`;
  return /推荐|搜索|召回|排序|重排|query|ranking|ranker|retrieval|recommend|recommender|search|top-k|topk|ctr|cvr|点击率|双塔|two-tower|向量检索|ann|faiss/.test(content);
}

function isImageProcessing(text: string, objects: FigureObject[]) {
  const labels = objects.map((object) => object.label).join(" ").toLowerCase();
  const content = `${text} ${labels}`;
  return /图像处理|计算机视觉|视觉|image processing|computer vision|cv|segmentation|分割|detection|检测|去噪|denoise|超分|super-resolution|restore|restoration|u-net|unet|cnn|卷积|vit|vision transformer/.test(content);
}

function groupObjectsByStage(objects: FigureObject[]) {
  const inputs: FigureObject[] = [];
  const encoders: FigureObject[] = [];
  const fusion: FigureObject[] = [];
  const outputs: FigureObject[] = [];
  for (const object of objects) {
    const stage = classifyObjectStage(object);
    if (stage === 0) inputs.push(object);
    else if (stage === 1) encoders.push(object);
    else if (stage === 2) fusion.push(object);
    else outputs.push(object);
  }
  return { inputs, encoders, fusion, outputs };
}

function classifyObjectStage(object: FigureObject) {
  const label = object.label.toLowerCase();
  if (/输出|诊断|风险评分|热力图|证据摘要|auc|f1|召回|消融|output|score|heatmap/.test(label) || object.kind === "output" || object.kind === "metric" || object.kind === "finding") return 3;
  if (/编码器|encoder|特征|病灶|症状|病史|用药|feature/.test(label) || object.kind === "process") return 1;
  if (/MedFuse|跨模态|注意力|融合|attention|fusion|框架|模型|model/i.test(object.label) || object.kind === "model") return 2;
  if (/ct|图像|影像|病历|文本|实验室|指标|数据|input|data|sample/.test(label) || object.kind === "dataset") return 0;
  return 1;
}

export function architecturePromptLines(diagram: ArchitectureDiagram) {
  return [
    "Architecture blueprint to follow exactly:",
    ...diagram.blocks.map((block, index) => `${index + 1}. ${block.title}${block.abbrev ? ` (${block.abbrev})` : ""}: ${(block.substeps ?? []).join("; ")}.`),
    diagram.connections?.length
      ? `Required connections: ${diagram.connections.map((connection) => `${connection.from} -> ${connection.to}${connection.label ? ` [${connection.label}]` : ""}`).join(" | ")}.`
      : "Use only source-supported connections.",
    "Render this as grouped architecture blocks with internal sub-step chips, not as isolated generic cards."
  ];
}
