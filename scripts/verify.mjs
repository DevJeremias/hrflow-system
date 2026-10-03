import { spawnSync } from "node:child_process";
import { coverageVerdict, skippedCounts } from "./test-summary.mjs";

// Gate único do que a equipe considera obrigatório: lint, typecheck, build e testes contra um MySQL
// real e migrado, com piso de cobertura de linhas no backend. Roda todas as etapas e falha se qualquer uma falhar.
const PISO_COBERTURA_LINHAS = 90;

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

// Teste ignorado não prova nada: sem MySQL a etapa falha em vez de passar em silêncio. A cobertura vale
// só para o backend (app.ts, server.ts, modules/ e shared/): abaixo do piso, ou sem relatório, a etapa falha.
const testarBackend = () => {
  if (!process.env.HRFLOW_TEST_DB_HOST) {
    console.error("HRFLOW_TEST_DB_HOST não definido: os testes de backend precisam de um MySQL real (veja README, 'Testes do back-end').");
    return false;
  }
  const result = executar("test:cobertura", { capturar: true });
  if (result.error || result.status !== 0) return false;
  const resumos = skippedCounts(result.stdout);
  if (resumos.length === 0 || resumos.some((ignorados) => ignorados !== 0)) {
    console.error(`Os testes ignoraram ${resumos.length === 0 ? "um número desconhecido de" : resumos.join(", ")} casos: verify não aceita testes ignorados.`);
    return false;
  }
  const cobertura = coverageVerdict(result.stdout, PISO_COBERTURA_LINHAS);
  (cobertura.ok ? console.log : console.error)(cobertura.message);
  return cobertura.ok;
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
