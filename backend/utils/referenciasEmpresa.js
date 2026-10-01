// Valida no servidor que cargo e departamento informados pertencem à empresa de quem opera.
// Os ids chegam do cliente e não carregam empresa: sem esta checagem, um id de outra empresa
// é aceito e os JOINs de listagem devolvem o nome dele.
// `executor` é o pool ou a conexão da transação em andamento.

const existeNaEmpresa = async (executor, tabela, id, empresa_id) => {
    const [rows] = await executor.query(`SELECT id FROM ${tabela} WHERE id = ? AND empresa_id = ?`, [id, empresa_id]);
    return rows.length > 0;
};

exports.departamentoDaEmpresa = (executor, id, empresa_id) => existeNaEmpresa(executor, 'departamentos', id, empresa_id);

exports.cargoDaEmpresa = (executor, id, empresa_id) => existeNaEmpresa(executor, 'cargos', id, empresa_id);
