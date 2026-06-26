// Single source of truth for research-grade chart types shared by the UI,
// validation, and prompt hints. Keep this pure data so client components can
// import it safely.
export type ChartCategory =
  | "comparison"
  | "distribution"
  | "relationship"
  | "time"
  | "matrix"
  | "composition"
  | "model-evaluation"
  | "statistical-inference"
  | "bioinformatics"
  | "spatial";

export type ChartTypeMeta = {
  id: string;
  label: string;
  category: ChartCategory;
  useCase: string;
  dataHint: string;
};

export const CHART_TYPE_META: ChartTypeMeta[] = [
  { id: "bar", label: "柱状图", category: "comparison", useCase: "类别之间的单指标比较", dataHint: "category,value" },
  { id: "grouped-bar", label: "分组柱状图", category: "comparison", useCase: "方法 x 数据集 x 指标对比", dataHint: "method,dataset,metric" },
  { id: "stacked-bar", label: "堆叠柱状图", category: "comparison", useCase: "类别内部组成对比", dataHint: "category,subgroup,value" },
  { id: "lollipop", label: "棒棒糖图", category: "comparison", useCase: "类别很多时替代柱状图", dataHint: "category,value" },
  { id: "slope", label: "斜率图", category: "comparison", useCase: "两组/前后变化比较", dataHint: "item,before,after" },
  { id: "dumbbell", label: "哑铃图", category: "comparison", useCase: "两组数值差异和方向", dataHint: "item,group_a,group_b" },

  { id: "histogram", label: "直方图", category: "distribution", useCase: "单变量分布", dataHint: "value" },
  { id: "density", label: "密度图", category: "distribution", useCase: "连续变量平滑分布", dataHint: "value,group(optional)" },
  { id: "box", label: "箱线图", category: "distribution", useCase: "分组分布和离群点", dataHint: "group,value" },
  { id: "violin", label: "小提琴图", category: "distribution", useCase: "分组分布形态", dataHint: "group,value" },
  { id: "raincloud", label: "雨云图", category: "distribution", useCase: "分布+散点+箱线综合展示", dataHint: "group,value" },
  { id: "ridgeline", label: "山峦图", category: "distribution", useCase: "多组分布叠放比较", dataHint: "group,value" },
  { id: "ecdf", label: "ECDF 累积分布", category: "distribution", useCase: "样本分布的非参数比较", dataHint: "value,group(optional)" },

  { id: "scatter", label: "散点图", category: "relationship", useCase: "两个连续变量关系", dataHint: "x,y,group(optional)" },
  { id: "bubble", label: "气泡图", category: "relationship", useCase: "两个连续变量 + 第三变量大小", dataHint: "x,y,size,group(optional)" },
  { id: "regression", label: "回归散点图", category: "relationship", useCase: "趋势线和置信区间", dataHint: "x,y,group(optional)" },
  { id: "hexbin", label: "Hexbin 密度散点", category: "relationship", useCase: "大量散点的密度关系", dataHint: "x,y" },
  { id: "pairplot", label: "变量成对关系图", category: "relationship", useCase: "多变量探索性分析", dataHint: "multiple numeric columns" },
  { id: "jointplot", label: "联合分布图", category: "relationship", useCase: "散点 + 边际分布", dataHint: "x,y" },

  { id: "line", label: "折线图", category: "time", useCase: "时间、epoch 或 step 趋势", dataHint: "time,value,series(optional)" },
  { id: "area", label: "面积图", category: "time", useCase: "随时间累积或组成变化", dataHint: "time,value,series(optional)" },
  { id: "ribbon", label: "置信带折线图", category: "time", useCase: "趋势 + 不确定性区间", dataHint: "time,mean,lower,upper" },
  { id: "control-chart", label: "控制图", category: "time", useCase: "过程监控、异常点检测", dataHint: "time,value,center,upper,lower(optional)" },
  { id: "calendar-heatmap", label: "日历热力图", category: "time", useCase: "按日期展示强度/频率", dataHint: "date,value" },

  { id: "heatmap", label: "热力图", category: "matrix", useCase: "二维矩阵、相关系数、混淆矩阵", dataHint: "row,column,value" },
  { id: "clustermap", label: "聚类热力图", category: "matrix", useCase: "样本/特征聚类模式", dataHint: "matrix-like table" },
  { id: "correlation", label: "相关矩阵图", category: "matrix", useCase: "多变量相关系数", dataHint: "multiple numeric columns" },
  { id: "confusion-matrix", label: "混淆矩阵", category: "model-evaluation", useCase: "分类错误分析", dataHint: "true_label,predicted_label,count" },

  { id: "donut", label: "环形图", category: "composition", useCase: "少数类别占比", dataHint: "category,value" },
  { id: "pie", label: "饼图", category: "composition", useCase: "少数类别占比，不推荐复杂场景", dataHint: "category,value" },
  { id: "treemap", label: "矩形树图", category: "composition", useCase: "层级组成占比", dataHint: "category,subgroup,value" },
  { id: "sunburst", label: "旭日图", category: "composition", useCase: "多层级组成", dataHint: "level1,level2,value" },
  { id: "sankey", label: "桑基图", category: "composition", useCase: "流程流量/转化路径", dataHint: "source,target,value" },
  { id: "alluvial", label: "冲积图", category: "composition", useCase: "类别随阶段迁移", dataHint: "stage,category,value" },
  { id: "radar", label: "雷达图", category: "composition", useCase: "少量模型多指标概览", dataHint: "model,metric,value" },

  { id: "roc", label: "ROC 曲线", category: "model-evaluation", useCase: "二分类阈值评估", dataHint: "fpr,tpr,model(optional)" },
  { id: "pr-curve", label: "PR 曲线", category: "model-evaluation", useCase: "类别不平衡下模型评估", dataHint: "recall,precision,model(optional)" },
  { id: "calibration", label: "校准曲线", category: "model-evaluation", useCase: "预测概率可信度", dataHint: "predicted_probability,observed_rate" },
  { id: "lift-gain", label: "Lift/Gain 曲线", category: "model-evaluation", useCase: "推荐/营销/风控模型分层收益", dataHint: "quantile,lift/gain" },
  { id: "learning-curve", label: "学习曲线", category: "model-evaluation", useCase: "样本量与性能关系", dataHint: "train_size,score,split" },
  { id: "residual", label: "残差图", category: "model-evaluation", useCase: "回归模型误差诊断", dataHint: "fitted,residual" },
  { id: "qq", label: "Q-Q 图", category: "model-evaluation", useCase: "残差/样本正态性检查", dataHint: "sample_quantile,theoretical_quantile" },
  { id: "feature-importance", label: "特征重要性图", category: "model-evaluation", useCase: "模型解释和变量贡献", dataHint: "feature,importance" },
  { id: "shap-summary", label: "SHAP 总结图", category: "model-evaluation", useCase: "特征贡献方向与分布", dataHint: "feature,shap_value,feature_value" },
  { id: "partial-dependence", label: "部分依赖图", category: "model-evaluation", useCase: "特征变化对预测影响", dataHint: "feature_value,prediction" },

  { id: "errorbar", label: "误差棒图", category: "statistical-inference", useCase: "均值 + 标准差/置信区间", dataHint: "group,mean,lower,upper" },
  { id: "forest", label: "森林图", category: "statistical-inference", useCase: "效应量和置信区间", dataHint: "study,effect,lower,upper" },
  { id: "kaplan-meier", label: "Kaplan-Meier 生存曲线", category: "statistical-inference", useCase: "生存/留存时间比较", dataHint: "time,survival,group" },
  { id: "bland-altman", label: "Bland-Altman 图", category: "statistical-inference", useCase: "两种测量方法一致性", dataHint: "mean,difference" },
  { id: "pvalue-annotation", label: "显著性标注图", category: "statistical-inference", useCase: "分组比较 + p 值/星号", dataHint: "group,value,p(optional)" },

  { id: "volcano", label: "火山图", category: "bioinformatics", useCase: "差异表达/显著性筛选", dataHint: "log2_fold_change,p_value,gene" },
  { id: "manhattan", label: "Manhattan 图", category: "bioinformatics", useCase: "GWAS 位点显著性", dataHint: "chromosome,position,p_value" },
  { id: "pca", label: "PCA/降维散点", category: "bioinformatics", useCase: "样本聚类和批次差异", dataHint: "pc1,pc2,group" },
  { id: "umap", label: "UMAP/t-SNE 图", category: "bioinformatics", useCase: "高维嵌入可视化", dataHint: "dim1,dim2,cluster" },
  { id: "enrichment-dotplot", label: "富集气泡图", category: "bioinformatics", useCase: "通路富集结果", dataHint: "term,ratio,p_value,count" },

  { id: "choropleth", label: "分区地图", category: "spatial", useCase: "地区指标分布", dataHint: "region,value" },
  { id: "spatial-scatter", label: "空间散点图", category: "spatial", useCase: "坐标点、检测框中心、地理点", dataHint: "x,y,value/group(optional)" },
  { id: "contour", label: "等高线图", category: "spatial", useCase: "二维连续场/损失面", dataHint: "x,y,z" }
];

export const CHART_CATEGORIES: Record<ChartCategory, string> = {
  comparison: "实验对比",
  distribution: "统计分布",
  relationship: "关系/相关",
  time: "趋势/时间序列",
  matrix: "矩阵/热力",
  composition: "组成/流向",
  "model-evaluation": "模型评估",
  "statistical-inference": "统计推断",
  bioinformatics: "生信/组学",
  spatial: "空间/场"
};

export const CHART_TYPES: [string, string][] = CHART_TYPE_META.map((item) => [item.id, item.label]);

export const CHART_TYPE_IDS = CHART_TYPE_META.map((item) => item.id);

export function isChartType(value: string) {
  return CHART_TYPE_IDS.includes(value);
}

export function chartTypeMeta(value: string) {
  return CHART_TYPE_META.find((item) => item.id === value);
}
