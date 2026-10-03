import { createRequire } from "node:module";

import * as migrator from "../backend/shared/db/migrator.ts";
import { carregarFixtures } from "../backend/shared/db/fixtures.ts";

const require = createRequire(new URL("../backend/package.json", import.meta.url));
require("dotenv").config({ path: new URL("../backend/.env", import.meta.url).pathname, quiet: true });

const COMANDOS = {
  create: "cria o banco (DB_NAME) se ele não existir",
  migrate: "aplica as migrations pendentes",
  status: "lista as migrations e o estado de cada uma",
  audit: "procura dados que violariam as constraints novas, sem alterar nada",
  seed: "carrega as fixtures sintéticas de desenvolvimento",
  setup: "create + migrate + seed",
  reset: "apaga o banco e refaz o setup (exige --banco=<DB_NAME> e DB_HOST local)",
};

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "::1"]);

const [comando, ...flags] = process.argv.slice(2);
if (!COMANDOS[comando]) {
  console.error("Uso: node scripts/db.mjs <comando>\n");
  for (const [nome, descricao] of Object.entries(COMANDOS)) console.error(`  ${nome.padEnd(8)} ${descricao}`);
  process.exit(1);
}

const config = migrator.configDoAmbiente();
if (!config.user || !config.database) {
  console.error("Defina DB_USER, DB_PASS e DB_NAME em backend/.env (veja backend/.env.example).");
  process.exit(1);
}

const semear = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("As fixtures são só para desenvolvimento: recusado com NODE_ENV=production.");
  }
  const senha = process.env.HRFLOW_SEED_PASSWORD || "hrflow-dev-123";
  const conexao = await migrator.conectar(config);
  try {
    const carregou = await carregarFixtures(conexao, { senha });
    console.log(carregou
      ? `fixtures carregadas (senha dos usuários de teste: ${senha === "hrflow-dev-123" ? senha : "HRFLOW_SEED_PASSWORD"})`
      : "fixtures já estavam carregadas, nada a fazer");
  } finally {
    await conexao.end();
  }
};

const migrar = async () => {
  const aplicadas = await migrator.migrar(config, (linha) => console.log(linha));
  if (aplicadas.length === 0) console.log("nenhuma migration pendente");
};

try {
  if (comando === "create") {
    await migrator.criarBanco(config);
    console.log(`banco ${config.database} pronto`);
  } else if (comando === "migrate") {
    await migrar();
  } else if (comando === "status") {
    for (const { versao, nome, estado } of await migrator.status(config)) console.log(`${versao}_${nome}: ${estado}`);
  } else if (comando === "audit") {
    let violacoes = 0;
    for (const resultado of await migrator.auditarBanco(config)) {
      if (resultado.erro) {
        console.log(`${resultado.migracao}: não foi possível auditar (${resultado.erro})`);
        violacoes += 1;
      } else if (resultado.violacoes.length === 0) {
        console.log(`${resultado.migracao}: sem violações`);
      } else {
        violacoes += resultado.violacoes.length;
        console.log(`${resultado.migracao}: ${resultado.violacoes.length} violação(ões)`);
        for (const { violacao, registro_id } of resultado.violacoes) console.log(`  - ${violacao}: id ${registro_id}`);
      }
    }
    process.exitCode = violacoes > 0 ? 1 : 0;
  } else if (comando === "seed") {
    await semear();
  } else if (comando === "setup") {
    await migrator.criarBanco(config);
    await migrar();
    await semear();
  } else if (comando === "reset") {
    if (process.env.NODE_ENV === "production") throw new Error("reset recusado com NODE_ENV=production.");
    // Quem apaga o banco digita o nome dele: um DB_NAME herdado do ambiente errado não passa despercebido.
    if (!flags.includes(`--banco=${config.database}`)) {
      throw new Error(`reset apaga o banco ${config.database} inteiro. Rode com --banco=${config.database} se é isso mesmo.`);
    }
    if (!HOSTS_LOCAIS.has(config.host)) {
      throw new Error(`reset recusado: DB_HOST=${config.host} não é uma máquina local. Ele só roda contra o MySQL de desenvolvimento.`);
    }
    await migrator.removerBanco(config);
    await migrator.criarBanco(config);
    await migrar();
    await semear();
  }
} catch (erro) {
  console.error(erro.message);
  if (erro.code === "ER_BAD_DB_ERROR") console.error("O banco ainda não existe: rode `npm run db:create` (ou `npm run db:setup`).");
  if (erro.code === "ECONNREFUSED" || erro.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("Confira DB_HOST, DB_PORT, DB_USER e DB_PASS em backend/.env e se o MySQL está de pé.");
  }
  process.exitCode = 1;
}
