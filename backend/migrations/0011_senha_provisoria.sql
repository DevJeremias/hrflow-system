-- Conta criada ou redefinida por outra pessoa nasce com senha provisória: o titular a troca no
-- primeiro acesso. A coluna marca essas contas; trocar a própria senha a limpa.
ALTER TABLE usuarios ADD COLUMN senha_provisoria BOOLEAN NOT NULL DEFAULT FALSE AFTER sessao_versao;
