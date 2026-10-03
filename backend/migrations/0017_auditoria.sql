-- B-22: trilha de auditoria. Cada linha diz quem fez o quê, em qual registro, quando e de onde, com o
-- valor anterior e o novo (antes e depois, só dos campos que mudaram). A tabela só recebe linhas:
-- nenhum caminho do sistema as edita, salvo a anonimização de um ex-colaborador, que apaga o conteúdo
-- pessoal de antes e depois e mantém quem, quando e o quê (docs/lgpd.md).
-- empresa_id é NULL quando a tentativa de login não identifica nenhuma conta. usuario_id e funcionario_id
-- não têm chave estrangeira de propósito: a linha sobrevive à exclusão do cadastro, e usuario_nome e
-- perfil guardam quem era o autor na época. funcionario_id é de quem a ação trata, e é por ele que o RH
-- lê a trilha de um colaborador.
CREATE TABLE auditoria (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NULL,
    usuario_id INT NULL,
    usuario_nome VARCHAR(255) NULL,
    perfil VARCHAR(20) NULL,
    acao VARCHAR(60) NOT NULL,
    entidade VARCHAR(40) NOT NULL,
    entidade_id INT NULL,
    funcionario_id INT NULL,
    ip VARCHAR(45) NULL,
    antes JSON NULL,
    depois JSON NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_auditoria_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    INDEX idx_auditoria_empresa (empresa_id, id),
    INDEX idx_auditoria_entidade (empresa_id, entidade, entidade_id, id),
    INDEX idx_auditoria_funcionario (empresa_id, funcionario_id, id)
);
