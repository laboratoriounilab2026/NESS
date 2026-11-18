// Windows: com cwd "c:\..." (drive minúsculo, comum no Git Bash/npm) o Vitest carrega o executor
// duas vezes e falha com "reading 'config'". Normaliza o drive e inicia o Vitest num processo filho.
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const bin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(r.status ?? 1);
