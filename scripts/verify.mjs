import { spawnSync } from "node:child_process";
import { skippedCounts } from "./test-summary.mjs";

// Gate único do que a equipe considera obrigatório: lint, typecheck, build e testes de backend
// contra um MySQL real e migrado. Roda todas as etapas e falha se qualquer uma falhar.
const isBun = process.env.npm_config_user_agent?.startsWith("bun/");
const execPath = process.env.npm_execpath ?? (isBun ? "bun" : "npm");

const executar = (script, { capturar = false } = {}) => {
  const result = spawnSync(execPath, ["run", script], {
    stdio: capturar ? ["inherit", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (capturar && result.stdout) process.stdout.write(result.stdout);
  return result;
};

// Teste ignorado não prova nada: sem MySQL a etapa falha em vez de passar em silêncio.
const testarBackend = () => {
  if (!process.env.HRFLOW_TEST_DB_HOST) {
    console.error("HRFLOW_TEST_DB_HOST não definido: os testes de backend precisam de um MySQL real (veja README, 'Testes do back-end').");
    return false;
  }
  const result = executar("test", { capturar: true });
  if (result.error || result.status !== 0) return false;
  const resumos = skippedCounts(result.stdout);
  if (resumos.length === 0 || resumos.some((ignorados) => ignorados !== 0)) {
    console.error(`Os testes de backend ignoraram ${resumos.length === 0 ? "um número desconhecido de" : resumos.join(", ")} casos: verify não aceita testes ignorados.`);
    return false;
  }
  return true;
};

const etapas = [
  ["lint", () => { const r = executar("lint"); return !r.error && r.status === 0; }],
  ["typecheck", () => { const r = executar("typecheck"); return !r.error && r.status === 0; }],
  ["build", () => { const r = executar("build"); return !r.error && r.status === 0; }],
  ["test", testarBackend],
];

const resultados = etapas.map(([nome, etapa]) => {
  console.log(`\n=== verify: ${nome} ===`);
  return [nome, etapa()];
});

console.log("\n=== verify: resumo ===");
for (const [nome, ok] of resultados) console.log(`${ok ? "ok    " : "FALHOU"} ${nome}`);
process.exit(resultados.every(([, ok]) => ok) ? 0 : 1);
