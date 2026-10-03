-- B-22: o colaborador não reescreve sozinho o nome, o e-mail, o endereço nem os dados bancários: ele
-- pede, e quem pode gerir o cadastro aprova ou recusa. `alteracoes` é o que se quer gravar
-- ({campo: valor novo}) e `anteriores`, o que valia quando o pedido foi feito, para quem decide ver o
-- que muda. Quem pede é uma conta de acesso (funcionario_id é NULL para um RH sem cadastro de
-- colaborador). Um pedido novo cancela o pendente anterior da mesma conta.
CREATE TABLE solicitacoes_alteracao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    funcionario_id INT NULL,
    alteracoes JSON NOT NULL,
    anteriores JSON NOT NULL,
    status ENUM('pendente', 'aprovada', 'recusada', 'cancelada') NOT NULL DEFAULT 'pendente',
    resposta VARCHAR(500) NULL,
    decidido_por INT NULL,
    decidido_em TIMESTAMP NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_solicitacoes_alteracao_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_solicitacoes_alteracao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_solicitacoes_alteracao_funcionario
        FOREIGN KEY (funcionario_id, empresa_id) REFERENCES funcionarios (id, empresa_id) ON DELETE CASCADE,
    CONSTRAINT fk_solicitacoes_alteracao_decidido_por FOREIGN KEY (decidido_por) REFERENCES usuarios (id) ON DELETE SET NULL,
    INDEX idx_solicitacoes_alteracao_empresa (empresa_id, status, id),
    INDEX idx_solicitacoes_alteracao_usuario (usuario_id, id)
);
