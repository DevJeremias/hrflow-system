-- B-15: a apuração do ponto precisa saber o que era esperado de cada colaborador. A jornada vive
-- no próprio colaborador: carga semanal (em horas, cumprida de segunda a sexta), horário de
-- entrada e de saída, e a tolerância de atraso em minutos. Os padrões são os de uma jornada
-- comercial de 40 horas (08:00 às 17:00 com uma hora de almoço), então quem já existe fica coberto.
ALTER TABLE funcionarios
    ADD COLUMN carga_horaria_semanal DECIMAL(4, 1) NOT NULL DEFAULT 40.0,
    ADD COLUMN hora_entrada TIME NOT NULL DEFAULT '08:00:00',
    ADD COLUMN hora_saida TIME NOT NULL DEFAULT '17:00:00',
    ADD COLUMN tolerancia_min SMALLINT UNSIGNED NOT NULL DEFAULT 10,
    ADD CONSTRAINT ck_funcionarios_carga_horaria CHECK (carga_horaria_semanal > 0 AND carga_horaria_semanal <= 80),
    ADD CONSTRAINT ck_funcionarios_tolerancia CHECK (tolerancia_min <= 60);
