import { spawn } from "node:child_process";
import { coverageVerdict, skippedCounts } from "./test-summary.mjs";

// Gate único do que a equipe considera obrigatório: lint, typecheck, build e testes contra um MySQL
// real e migrado, com piso de cobertura de linhas no backend. Roda todas as etapas ao mesmo tempo, mostra
// a saída de cada uma quando ela termina e falha se qualquer uma falhar.
const PISO_COBERTURA_LINHAS = 90;

const isBun = process.env.npm_config_user_agent?.startsWith("bun/");
const execPath = process.env.npm_execpath ?? (isBun ? "bun" : "npm");

// Roda um comando guardando a saída: com as etapas em paralelo, a saída direta se misturaria.
const executar = (comando, args) => new Promise((resolve) => {
  const filho = spawn(comando, args, { stdio: ["inherit", "pipe", "pipe"] });
  let saida = "";
  filho.stdout.on("data", (parte) => { saida += parte; });
  filho.stderr.on("data", (parte) => { saida += parte; });
  filho.on("error", (erro) => resolve({ ok: false, saida: `${saida}${erro.message}\n` }));
  filho.on("close", (status) => resolve({ ok: status === 0, saida }));
});

const script = (nome) => executar(execPath, ["run", nome]);
const doWorkspace = (workspace, nome) => executar(process.execPath, ["scripts/run-workspace.mjs", workspace, nome]);

// Teste ignorado não prova nada: sem MySQL a etapa falha em vez de passar em silêncio.
const semIgnorados = (saida) => {
  const resumos = skippedCounts(saida);
  if (resumos.length > 0 && resumos.every((ignorados) => ignorados === 0)) return null;
  return `Os testes ignoraram ${resumos.length === 0 ? "um número desconhecido de" : resumos.join(", ")} casos: verify não aceita testes ignorados.`;
};

const testarBackend = async () => {
  if (!process.env.HRFLOW_TEST_DB_HOST) {
    return { ok: false, saida: "HRFLOW_TEST_DB_HOST não definido: os testes de backend precisam de um MySQL real (veja README, 'Testes do back-end').\n" };
  }
  // A cobertura vale só para o backend (app.ts, server.ts, modules/ e shared/): abaixo do piso, ou sem relatório, a etapa falha.
  const resultado = await doWorkspace("backend", "test:cobertura");
  if (!resultado.ok) return resultado;
  const ignorados = semIgnorados(resultado.saida);
  if (ignorados) return { ok: false, saida: `${resultado.saida}${ignorados}\n` };
  const cobertura = coverageVerdict(resultado.saida, PISO_COBERTURA_LINHAS);
  return { ok: cobertura.ok, saida: `${resultado.saida}${cobertura.message}\n` };
};

const testarFrontend = async () => {
  const resultado = await doWorkspace("frontend", "test");
  if (!resultado.ok) return resultado;
  const ignorados = semIgnorados(resultado.saida);
  return ignorados ? { ok: false, saida: `${resultado.saida}${ignorados}\n` } : resultado;
};

const etapas = [
  ["lint", () => script("lint")],
  ["typecheck", () => script("typecheck")],
  ["build", () => script("build")],
  ["test backend", testarBackend],
  ["test frontend", testarFrontend],
];

const resultados = await Promise.all(etapas.map(async ([nome, etapa]) => {
  const resultado = await etapa();
  console.log(`\n=== verify: ${nome} ===`);
  process.stdout.write(resultado.saida);
  return [nome, resultado.ok];
}));

console.log("\n=== verify: resumo ===");
for (const [nome, ok] of resultados) console.log(`${ok ? "ok    " : "FALHOU"} ${nome}`);
process.exit(resultados.every(([, ok]) => ok) ? 0 : 1);
