export type FigureType =
  | "method-framework"
  | "experiment-flow"
  | "graphical-abstract"
  | "mechanism"
  | "comparison"
  | "timeline"
  | "neural-network"
  | "data-pipeline";

export type AspectRatio = "1:1" | "4:3" | "16:9" | "3:2";

export type PaperInput = {
  text: string;
  fileName?: string;
  field: string;
  figureType: FigureType;
  purpose: string;
  aspectRatio: AspectRatio;
  palette: string;
  style: string;
};

export type PaperSection = {
  title: string;
  content: string;
};

export type PaperStructure = {
  title: string;
  abstract: string;
  methods: PaperSection[];
  results: PaperSection[];
  keywords: string[];
  limitations: string[];
};

export type ReferenceFigure = {
  id: string;
  title: string;
  figureType: FigureType;
  fieldTags: string[];
  useCase: string;
  layoutPattern: string;
  visualLanguage: string;
  components: string[];
  promptHints: string[];
  criticChecklist: string[];
};

export type FigurePanel = {
  id: string;
  title: string;
  role: "context" | "input" | "method" | "evidence" | "output" | "comparison" | "timeline" | "mechanism";
  summary: string;
};

export type FigureObject = {
  id: string;
  panelId: string;
  label: string;
  kind: "dataset" | "process" | "model" | "metric" | "finding" | "cell" | "molecule" | "concept" | "output";
  evidence?: string;
  confidence: number;
  position?: {
    x: number;
    y: number;
  };
  locked?: boolean;
};

export type FigureArrow = {
  id: string;
  from: string;
  to: string;
  label: string;
  relation: "flow" | "causal" | "feedback" | "contrast" | "supports";
};

export type EvidenceMapping = {
  targetId: string;
  claim: string;
  sourceExcerpt: string;
  risk: "low" | "medium" | "high";
};

export type ArchitectureBlock = {
  title: string;
  abbrev?: string;
  substeps?: string[];
  category?: string;
};

export type ArchitectureConnection = {
  from: string;
  to: string;
  label?: string;
};

export type ArchitectureLegendItem = {
  label: string;
  category: string;
};

export type ArchitectureDiagram = {
  blocks: ArchitectureBlock[];
  connections?: ArchitectureConnection[];
  legend?: ArchitectureLegendItem[];
};

export type FigureSpec = {
  title: string;
  figureType: FigureType;
  thesis: string;
  layoutIntent: string;
  panels: FigurePanel[];
  objects: FigureObject[];
  arrows: FigureArrow[];
  architecture?: ArchitectureDiagram;
  evidenceMapping: EvidenceMapping[];
  styleGuide: {
    palette: string;
    typography: string;
    labelPolicy: string;
    iconStyle: string;
    spacing: string;
  };
  riskNotes: string[];
};

export type CriticReview = {
  total: number;
  faithful: number;
  readable: number;
  concise: number;
  visual: number;
  reviewerRisk: number;
  verdict: string;
  issues: string[];
  suggestions: string[];
};

export type DesignIteration = {
  id: string;
  createdAt: string;
  action: string;
  beforeScore: number;
  afterScore: number;
  notes: string[];
};

export type FigurePlan = {
  id: string;
  name: string;
  score: number;
  rationale: string;
  layout: string;
  caption: string;
  modules: string[];
  relationships: string[];
  template: FigureType;
  visualNotes: string[];
  prompt: string;
  negativePrompt: string;
  mermaid: string;
  svg: string;
  spec?: FigureSpec;
  references?: ReferenceFigure[];
  critic?: CriticReview;
  iterations?: DesignIteration[];
};

export type AnalysisResult = {
  projectId: string;
  createdAt: string;
  input: PaperInput;
  structure: PaperStructure;
  plans: FigurePlan[];
  selectedPlanId: string;
  parser: {
    status: "text" | "mineru" | "fallback" | "failed";
    message: string;
  };
  planner: {
    status: "llm" | "fallback" | "failed";
    provider: string;
    message: string;
  };
};

export type ImageGenerationResult = {
  provider: string;
  status: "ready" | "blocked" | "failed";
  message: string;
  imageUrl?: string;
  baseImageUrl?: string;
  mode?: "standard" | "hybrid";
  prompt: string;
  model?: string;
  createdAt: string;
};

export type MindmapNode = {
  id: string;
  title: string;
  summary: string;
  children: MindmapNode[];
};

export type MindmapResult = {
  id: string;
  createdAt: string;
  sourceName?: string;
  parser: {
    status: "text" | "mineru" | "fallback" | "failed";
    message: string;
  };
  planner: {
    status: "llm" | "fallback" | "failed";
    provider: string;
    message: string;
  };
  title: string;
  outline: MindmapNode;
  markdown: string;
  mermaid: string;
  svg: string;
};

export type ConfigStatus = {
  llm: { provider: string; ready: boolean; model: string };
  image: { provider: string; ready: boolean; model: string };
  recommendations: Array<{ provider: string; label: string; cost: string }>;
};
