// Executa a suíte do back-end (npm test): migra uma vez o banco molde de que cada arquivo de teste tira
// sua cópia (bancoDeTeste.preparar), roda o `node --test` e apaga o molde no fim, passe ou falhe.
// O nome do molde viaja na variável de ambiente, que os processos de cada arquivo herdam.
// Faz o papel do --test-global-setup do Node, que só existe a partir do Node 24: o projeto roda no 22.
//   node tests/support/executar.ts [--cobertura] [arquivos de teste...]
import { spawn } from 'node:child_process';
import * as migrator from '../../shared/db/migrator.ts';
import { config, skip, VARIAVEL_DO_MOLDE } from './bancoDeTeste.ts';

const TODOS_OS_TESTES = 'tests/**/*.test.ts';

// A cobertura vale para o código da aplicação; os testes e o apoio deles ficam fora do relatório. O server.ts
// entra porque o teste que o executa como processo grava a cobertura do filho no mesmo relatório.
const COBERTURA = [
    '--experimental-test-coverage',
    '--test-coverage-include=app.ts',
    '--test-coverage-include=server.ts',
    '--test-coverage-include=modules/**/*.ts',
    '--test-coverage-include=shared/**/*.ts',
];

const argumentos = process.argv.slice(2);
const comCobertura = argumentos.includes('--cobertura');
const arquivos = argumentos.filter((argumento) => argumento !== '--cobertura');

const molde = { ...config, database: `hrflow_molde_${process.pid}` };

const rodar = () => new Promise<number>((resolve) => {
    const filho = spawn(
        process.execPath,
        ['--test', '--test-concurrency=4', ...(comCobertura ? COBERTURA : []), ...(arquivos.length > 0 ? arquivos : [TODOS_OS_TESTES])],
        { stdio: 'inherit', env: skip ? process.env : { ...process.env, [VARIAVEL_DO_MOLDE]: molde.database } },
    );
    for (const sinal of ['SIGINT', 'SIGTERM'] as const) process.on(sinal, () => filho.kill(sinal));
    filho.on('exit', (codigo, sinal) => resolve(codigo ?? (sinal ? 1 : 0)));
});

let codigo = 1;
try {
    if (!skip) {
        await migrator.removerBanco(molde);
        await migrator.criarBanco(molde);
        await migrator.migrar(molde);
    }
    codigo = await rodar();
} finally {
    if (!skip) await migrator.removerBanco(molde);
}
process.exit(codigo);
