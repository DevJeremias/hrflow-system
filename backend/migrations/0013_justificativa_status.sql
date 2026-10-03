-- B-15: a justificativa passa a ter destino. O RH a aprova ou recusa e o colaborador vê a resposta.
-- As que já existem ficam pendentes, que é o que elas eram: ninguém as tinha decidido.
-- decidido_por aponta para o usuário que decidiu; se a conta sumir, a decisão fica registrada.
ALTER TABLE justificativas_ponto
    ADD COLUMN status ENUM('pendente', 'aprovada', 'recusada') NOT NULL DEFAULT 'pendente',
    ADD COLUMN decidido_por INT NULL,
    ADD COLUMN decidido_em TIMESTAMP NULL,
    ADD COLUMN resposta VARCHAR(500) NULL,
    ADD CONSTRAINT fk_justificativas_ponto_decidido_por FOREIGN KEY (decidido_por) REFERENCES usuarios (id) ON DELETE SET NULL;

CREATE INDEX idx_justificativas_ponto_empresa_status ON justificativas_ponto (empresa_id, status, data_referencia);
