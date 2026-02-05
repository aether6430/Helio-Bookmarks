import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./server";

const help = () => {
  const text = `\nHelio Bookmark Manager\n\nUsage:\n  helio tui            Run the TUI\n  helio gui            Serve the GUI (requires ./dist)\n  helio gui --dev      Run GUI with Vite dev server (requires repo)\n  helio api            Run API server only\n\nNotes:\n  Build the GUI assets with: bun run build\n  Default API port: 5174 (override with BM_PORT)\n`;
  process.stdout.write(text);
};

const fileExists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const getRootDir = () => {
  const envRoot = process.env.HELIO_ROOT;
  if (envRoot) return resolve(envRoot);
  if (Bun.isBundled) {
    return dirname(process.execPath);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
};

const run = async () => {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    help();
    return;
  }

  if (command === "tui") {
    await import("./tui");
    return;
  }

  if (command === "api") {
    startServer();
    return;
  }

  if (command === "gui") {
    const rootDir = getRootDir();
    const debugPaths = process.env.HELIO_DEBUG_PATHS;
    const isDev = args.includes("--dev");
    if (isDev) {
      startServer();
      const bunPath = process.execPath;
      const dev = Bun.spawn({
        cmd: [bunPath, "run", "dev"],
        cwd: rootDir,
        stdio: ["inherit", "inherit", "inherit"],
      });
      await dev.exited;
      return;
    }

    const distDirs = [resolve(process.cwd(), "dist"), resolve(rootDir, "dist")];
    let distDir: string | null = null;
    for (const candidate of distDirs) {
      const indexPath = resolve(candidate, "index.html");
      if (await fileExists(indexPath)) {
        distDir = candidate;
        break;
      }
    }
    const hasDist = Boolean(distDir);
    const hasEmbedded = (Bun.embeddedFiles?.length ?? 0) > 0;
    if (debugPaths) {
      console.log(
        [
          `cwd=${process.cwd()}`,
          `rootDir=${rootDir}`,
          `distDir=${distDir ?? "none"}`,
          `hasDist=${hasDist}`,
          `hasEmbedded=${hasEmbedded}`,
          `embeddedCount=${Bun.embeddedFiles?.length ?? 0}`,
        ].join(" ")
      );
    }
    if (!hasDist && !hasEmbedded) {
      process.stdout.write(
        "GUI assets missing. Run `bun run build` first to create ./dist.\n"
      );
      process.exitCode = 1;
      return;
    }

    startServer({
      staticDir: hasDist ? distDir ?? undefined : undefined,
      embedded: !hasDist,
    });
    return;
  }

  process.stdout.write(`Unknown command: ${command}\n`);
  help();
  process.exitCode = 1;
};

await run();
