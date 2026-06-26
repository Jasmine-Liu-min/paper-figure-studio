import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Module from "node:module";

const root = new URL("../", import.meta.url);
const outDir = join(tmpdir(), "paper-figure-studio-quality");
process.env.NODE_PATH = join(process.cwd(), "node_modules");
Module._initPaths();

execFileSync("npx", ["tsc", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", "--outDir", outDir, "--skipLibCheck", "scripts/golden-quality.ts"], {
  cwd: new URL(".", root),
  stdio: "inherit"
});

const outputPath = join(outDir, "scripts/golden-quality.js");
await import(pathToFileURL(outputPath).href);
