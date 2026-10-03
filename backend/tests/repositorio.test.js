// Higiene do repositório: o que não pode voltar ao clone e o que a governança exige existir.
// Não precisa de banco. Os testes de git pulam fora de um checkout git (por exemplo, numa imagem).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..', '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const git = (...args) => spawnSync('git', args, { cwd: raiz, encoding: 'utf8' });
const emCheckoutGit = git('rev-parse', '--git-dir').status === 0;
const commitlint = (mensagem) => spawnSync(
    process.execPath, [path.join(raiz, 'node_modules', '@commitlint', 'cli', 'cli.js')],
    { cwd: raiz, input: mensagem, encoding: 'utf8' },
);

describe('arquivos rastreados', { skip: !emCheckoutGit && 'fora de um checkout git' }, () => {
    const rastreados = () => git('ls-files').stdout.split('\n').filter(Boolean);

    it('o único package-lock.json é o da raiz', () => {
        assert.deepEqual(rastreados().filter((f) => f.endsWith('package-lock.json')), ['package-lock.json']);
    });

    it('não há script de colaborador de teste, estado do Visual Studio nem código órfão', () => {
        const proibidos = [/^\.vs\//, /criarColaboradorTeste/, /^instrucoes-git\.txt$/,
            /^frontend\/public\/manifest\.json$/, /DashboardPunchForm/];
        const achados = rastreados().filter((f) => proibidos.some((regra) => regra.test(f)));
        assert.deepEqual(achados, []);
    });

    it('o .gitignore cobre .vs/, dist/, coverage/, *.log e bun.lock', () => {
        const ignorados = ['.vs/x', 'dist/x', 'coverage/x', 'servidor.log', 'bun.lock'];
        for (const arquivo of ignorados) {
            assert.equal(git('check-ignore', '-q', arquivo).status, 0, `${arquivo} deveria ser ignorado`);
        }
    });
});

describe('dependências', () => {
    it('bcryptjs não está declarado nem instalado; o hash usa o bcrypt nativo', () => {
        const pacote = JSON.parse(ler('backend/package.json'));
        assert.equal(pacote.dependencies.bcryptjs, undefined);
        assert.ok(pacote.dependencies.bcrypt);
        assert.ok(!/bcryptjs/.test(ler('package-lock.json')), 'package-lock.json ainda cita bcryptjs');
    });
});

describe('commitlint', () => {
    it('recusa mensagem fora do padrão e aceita Conventional Commits', () => {
        const ruim = commitlint('update stuff');
        assert.notEqual(ruim.status, 0, 'a mensagem "update stuff" deveria falhar');
        assert.match(ruim.stdout, /type may not be empty/);
        assert.equal(commitlint('feat(auth): accept legacy password hashes').status, 0);
    });
});

describe('governança do GitHub', () => {
    it('o repositório tem dono de código e Dependabot para npm e Actions', () => {
        assert.match(ler('.github/CODEOWNERS'), /^\* @DevJeremias$/m);
        const dependabot = ler('.github/dependabot.yml');
        assert.match(dependabot, /package-ecosystem: npm/);
        assert.match(dependabot, /package-ecosystem: github-actions/);
    });

    it('o CI roda verify, audit de produção e commitlint, com toda ação fixada por SHA', () => {
        const ci = ler('.github/workflows/ci.yml');
        for (const job of ['verify', 'audit', 'commitlint']) assert.match(ci, new RegExp(`^  ${job}:`, 'm'));
        assert.match(ci, /npm audit --omit=dev/);
        const acoes = [...ci.matchAll(/^\s*- uses: (\S+)/gm)].map((m) => m[1]);
        assert.ok(acoes.length > 0);
        for (const acao of acoes) assert.match(acao, /@[0-9a-f]{40}$/, `${acao} não está fixada por SHA`);
    });
});

describe('README.md', () => {
    const readme = ler('README.md');

    it('fecha todo bloco de código', () => {
        const cercas = readme.split('\n').filter((linha) => /^\s*```/.test(linha));
        assert.equal(cercas.length % 2, 0, 'há uma cerca ``` sem par');
    });

    it('está em português do Brasil, sem "utilizador"', () => {
        assert.ok(!/utilizador/i.test(readme));
    });
});
