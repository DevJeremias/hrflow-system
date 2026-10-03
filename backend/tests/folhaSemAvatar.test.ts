// As consultas da folha só trazem o que o holerite usa: a foto (base64, até 2,7 MB por pessoa) ficava
// no SELECT f.* e viajava do banco para a API em toda linha de uma folha de milhares de pessoas.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ResultSetHeader } from 'mysql2/promise';
import * as banco from './support/bancoDeTeste.ts';
import db from '../shared/db/pool.ts';
import { funcionariosAtivos, funcionarioDoUsuario } from '../modules/folha/folha.repository.ts';
import { dataUrl } from './support/imagens.ts';

test('a folha não lê o avatar dos funcionários', { skip: banco.skip }, async (t) => {
    await banco.preparar();
    t.after(async () => {
        await db.end();
        await banco.encerrar();
    });

    const [{ insertId: empresa }] = await db.query<ResultSetHeader>('INSERT INTO empresas (nome) VALUES (?)', ['Empresa Fictícia']);
    const [{ insertId: funcionario }] = await db.query<ResultSetHeader>(
        'INSERT INTO funcionarios (nome, email, salario_base, status, avatar, empresa_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['Ana Teste', 'ana@exemplo.invalid', 3000, 'Ativo', dataUrl('png', 4096), empresa]
    );
    const [{ insertId: usuario }] = await db.query<ResultSetHeader>(
        'INSERT INTO usuarios (nome, email, senha, perfil, empresa_id, funcionario_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['Ana Usuária', 'ana.usuaria@exemplo.invalid', 'hash-ficticio', 'Colaborador', empresa, funcionario]
    );

    const [linha] = await funcionariosAtivos(empresa, 10, 0);
    assert.equal(linha.nome, 'Ana Teste');
    assert.deepEqual(Object.keys(linha).sort(), ['cargo_nome', 'departamento_nome', 'id', 'nome', 'salario_base']);

    const proprio = await funcionarioDoUsuario(usuario, empresa);
    assert.ok(proprio);
    assert.equal('avatar' in proprio, false);
});
