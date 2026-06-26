import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { AnalysisResult, ImageGenerationResult } from "../types";
import { ChartCriticReview } from "../chart/chartCritic";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const CHART_PROJECTS_FILE = path.join(DATA_DIR, "chart-projects.json");

// Cap how much raw text we persist per chart project so a multi-MB paste
// can't bloat chart-projects.json (every read/write re-serializes the whole file).
const MAX_STORED_FIELD = 20000;

type StoredProject = AnalysisResult & {
  images: ImageGenerationResult[];
};

export type StoredChartProject = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  input: {
    data: string;
    chartType: string;
    library: "seaborn" | "ggplot2";
    title: string;
    xLabel: string;
    yLabel: string;
    palette: string;
    notes: string;
  };
  result: {
    ok: boolean;
    provider: string;
    language: "python" | "r";
    library: "seaborn" | "ggplot2";
    code: string;
    message: string;
  };
  critic?: ChartCriticReview;
};

// Per-file write serialization. Next.js route handlers run concurrently, so two
// requests that read-modify-write the same JSON file can clobber each other.
// We chain every mutation of a given file through a promise so they run in order.
const writeLocks = new Map<string, Promise<unknown>>();

function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(file) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  // Keep the chain alive regardless of success/failure, but don't leak rejections.
  writeLocks.set(
    file,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJsonArray<T>(file: string): Promise<T[]> {
  await ensureDataDir();
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    // Missing file is the normal "no history yet" case → empty list.
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    console.error(`[storage] failed to read ${file}:`, error);
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    // Guard against a corrupted/half-written file holding a non-array.
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    // Corrupt JSON: keep a backup instead of silently overwriting it later.
    console.error(`[storage] ${file} is corrupted, backing up and starting fresh:`, error);
    try {
      await rename(file, `${file}.corrupt-${Date.now().toString(36)}`);
    } catch {
      /* best effort */
    }
    return [];
  }
}

async function writeJsonArrayAtomic<T>(file: string, value: T[]) {
  await ensureDataDir();
  // Write to a temp file then rename — rename is atomic, so a crash mid-write
  // can never leave a truncated JSON file that wipes existing history on next read.
  const tmp = `${file}.tmp-${Date.now().toString(36)}`;
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, file);
}

function clip(value: string) {
  return value.length > MAX_STORED_FIELD ? value.slice(0, MAX_STORED_FIELD) : value;
}

export async function saveAnalysis(result: AnalysisResult) {
  return withFileLock(PROJECTS_FILE, async () => {
    const projects = await readJsonArray<StoredProject>(PROJECTS_FILE);
    const stored: StoredProject = { ...result, images: [] };
    await writeJsonArrayAtomic(PROJECTS_FILE, [stored, ...projects.filter((item) => item.projectId !== result.projectId)].slice(0, 80));
    return stored;
  });
}

export async function listProjects() {
  return readJsonArray<StoredProject>(PROJECTS_FILE);
}

export async function appendImageResult(projectId: string, image: ImageGenerationResult) {
  return withFileLock(PROJECTS_FILE, async () => {
    const projects = await readJsonArray<StoredProject>(PROJECTS_FILE);
    if (!projects.some((project) => project.projectId === projectId)) {
      // Unknown projectId → nothing to update; skip the write to avoid a needless rewrite.
      return undefined;
    }
    const next = projects.map((project) =>
      project.projectId === projectId ? { ...project, images: [image, ...project.images].slice(0, 20) } : project
    );
    await writeJsonArrayAtomic(PROJECTS_FILE, next);
    return next.find((project) => project.projectId === projectId);
  });
}

export async function listChartProjects() {
  return readJsonArray<StoredChartProject>(CHART_PROJECTS_FILE);
}

export async function saveChartProject(project: Omit<StoredChartProject, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return withFileLock(CHART_PROJECTS_FILE, async () => {
    const projects = await readJsonArray<StoredChartProject>(CHART_PROJECTS_FILE);
    const now = new Date().toISOString();
    const existing = project.id ? projects.find((item) => item.id === project.id) : undefined;
    const stored: StoredChartProject = {
      ...project,
      input: { ...project.input, data: clip(project.input.data), notes: clip(project.input.notes) },
      result: { ...project.result, code: clip(project.result.code) },
      id: project.id ?? `chart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    await writeJsonArrayAtomic(CHART_PROJECTS_FILE, [stored, ...projects.filter((item) => item.id !== stored.id)].slice(0, 120));
    return stored;
  });
}

export async function deleteChartProject(id: string) {
  return withFileLock(CHART_PROJECTS_FILE, async () => {
    const projects = await readJsonArray<StoredChartProject>(CHART_PROJECTS_FILE);
    const next = projects.filter((project) => project.id !== id);
    await writeJsonArrayAtomic(CHART_PROJECTS_FILE, next);
    return next.length !== projects.length;
  });
}
