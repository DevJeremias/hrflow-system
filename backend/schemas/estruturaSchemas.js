const { z, opcional, texto, textoLivre, inteiroPositivo, dinheiro, corpo } = require('./comum');

const idDaRota = z.object({ id: inteiroPositivo('Identificador') });

const dadosDoDepartamento = {
    nome: texto('Nome do departamento', 100),
    sigla: texto('Sigla', 10),
    descricao: opcional(textoLivre('Descrição', 1000)),
    gestor: opcional(texto('Gestor', 100)),
};

const dadosDoCargo = {
    nome: texto('Nome do cargo', 100),
    departamento_id: inteiroPositivo('Departamento'),
    nivel: opcional(texto('Nível', 50)),
    salario_base: opcional(dinheiro('Salário base')).transform((salario) => salario ?? 0),
};

module.exports = {
    idDaRota,
    departamento: corpo(dadosDoDepartamento),
    cargo: corpo(dadosDoCargo),
};
