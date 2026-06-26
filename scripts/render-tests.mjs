import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Module from "node:module";

const root = new URL("../", import.meta.url);
const outDir = join(tmpdir(), "paper-figure-studio-tests");
process.env.NODE_PATH = join(process.cwd(), "node_modules");
Module._initPaths();

execFileSync("npx", ["tsc", "--strict", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", "--outDir", outDir, "--skipLibCheck", "scripts/render-tests.ts"], {
  cwd: new URL(".", root),
  stdio: "inherit"
});

const outputPath = join(outDir, "scripts/render-tests.js");
await import(pathToFileURL(outputPath).href);
