-- Versão da sessão do usuário. O token carrega a versão vigente no login e o middleware a compara
-- com esta coluna; incrementá-la (troca de senha, inativação do funcionário) derruba todos os
-- tokens emitidos antes. Tokens anteriores a esta migration não têm versão e deixam de valer.
ALTER TABLE usuarios ADD COLUMN sessao_versao INT NOT NULL DEFAULT 0 AFTER funcionario_id;
