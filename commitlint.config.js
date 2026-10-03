// Mensagens de commit seguem Conventional Commits (type(scope): subject), conferidas no CI.
// O corpo gerado pelo Dependabot traz linhas longas (changelogs colados), por isso o limite de
// linha do corpo e do rodapé fica desligado; o cabeçalho continua limitado.
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'body-max-line-length': [0],
        'footer-max-line-length': [0],
    },
};
