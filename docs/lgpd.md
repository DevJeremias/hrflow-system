# LGPD no HRFlow

O que o sistema faz com dados pessoais, quem responde por quê, quanto tempo cada dado fica e como a empresa atende os pedidos dos titulares. Este documento descreve o que o código faz hoje e **propõe** a política de retenção; os prazos precisam ser validados pelo jurídico da empresa que usa o HRFlow, que é a controladora. O texto que os usuários leem está em `frontend/src/pages/Legal/Privacidade.tsx`.

## Quem é quem

* **Controladora:** a empresa que cria a conta. Ela decide quais dados de colaboradores cadastrar e para quê, e responde aos titulares.
* **Operadora:** o HRFlow, que guarda e processa os dados por conta da empresa.
* **Encarregado (art. 41):** indicado pela própria empresa. O Administrador preenche nome e e-mail em **Empresa** (`PUT /api/empresa`, campos `encarregado_nome` e `encarregado_email`, sempre juntos). O colaborador o vê em **Meu Perfil, aba Privacidade** (`GET /api/perfil/meus-dados`, campo `encarregado`). Sem indicação, a tela manda falar com o RH.

## O que é guardado, onde e por quê

| Dado | Tabela | Finalidade |
| --- | --- | --- |
| Nome, CPF, e-mail, telefone, nascimento, endereço, dados bancários | `funcionarios` | Cadastro do colaborador, folha e holerite |
| Salário, cargo, departamento, contrato, jornada | `funcionarios` e `historico_contratual` | Folha, apuração do ponto e histórico do vínculo |
| Conta de acesso (nome, e-mail, perfil, hash da senha) | `usuarios` | Autenticação. A senha só existe como hash (bcrypt) |
| Foto (original e miniatura de 128 px), em binário | `avatares` | Identificação visual. Nunca trafega em listas: as respostas trazem só o endereço da miniatura |
| Marcações de ponto, com latitude e longitude quando o colaborador autoriza | `registro_pontos` | Controle de jornada |
| Justificativas de ponto (texto livre) | `justificativas_ponto` | Abono ou recusa de faltas e atrasos |
| Holerites fechados (valores e rubricas) | `folha_itens` | Comprovante de pagamento |
| Pedidos de alteração de nome, e-mail, endereço e banco | `solicitacoes_alteracao` | Aprovação pelo RH |
| Trilha de auditoria (quem, o quê, quando, IP, antes e depois) | `auditoria` | Rastro de quem mexeu em dados e acessos |

A foto deixou de ficar em base64 em `usuarios.avatar` e `funcionarios.avatar` (migration `0019_lgpd`): `SELECT * FROM funcionarios` não traz imagem e `GET /api/funcionarios` nunca trouxe.

## Trilha de auditoria

Cada ação que muda dados ou acesso grava uma linha em `auditoria`, **na mesma transação** da mudança: se a mudança é desfeita, a linha também. `shared/utils/auditar.ts` é o único ponto de escrita.

Registrado: entrada e falha de entrada no sistema, criação, edição, alteração de salário, desligamento, reativação, redefinição de senha e exclusão de colaborador, processamento e fechamento da folha, envio e decisão de justificativa de ponto, troca de senha, criação e alteração de contas de acesso, atualização de dados pessoais, pedidos de alteração (criação, aprovação, recusa), exportação e anonimização de dados.

* Cada linha guarda o autor (`usuario_id`, e `usuario_nome` e `perfil` da época), a empresa, a entidade e o id afetados, o colaborador a quem a ação diz respeito (`funcionario_id`), o IP (`req.ip`, que respeita `TRUST_PROXY`), e `antes` e `depois` só com os campos que mudaram.
* A senha, o hash e a imagem da foto **nunca** entram. Uma tentativa de entrada com e-mail sem conta grava a falha sem empresa, sem usuário e sem o e-mail digitado.
* Quem lê: Administrador e RH, `GET /api/auditoria`, sempre só da própria empresa. `?entidade=funcionario&id=` lista tudo o que diz respeito àquele colaborador (inclusive o que se fez em torno dele, como justificativas e acessos); com outra entidade, `id` é o do próprio registro. Os registros só se leem: nenhuma rota os altera ou apaga.
* A tabela não tem chave estrangeira para usuário e colaborador de propósito: a linha sobrevive à exclusão do cadastro.

## Histórico contratual

`historico_contratual` guarda um período para cada combinação de salário, cargo e departamento, com `vigencia_inicio` e `vigencia_fim` (NULL no período em vigor). Mudar qualquer um dos três fecha o período aberto no dia anterior e abre outro a partir de hoje (dia de Belém); editar duas vezes no mesmo dia corrige o período aberto. O cargo e o departamento ficam também pelo nome da época. Quem já existia entrou com a situação de hoje, desde a admissão. `GET /api/funcionarios/:id/historico-contratual` (Administrador e RH).

## Direitos do titular

| Direito | Como a empresa atende |
| --- | --- |
| Acesso e portabilidade | `GET /api/funcionarios/:id/exportar` (Administrador e RH) devolve um JSON com cadastro, contas de acesso (sem senha), histórico contratual, marcações e justificativas, holerites, pedidos de alteração e a trilha daquele colaborador. A foto não vai (só `tem_avatar`). A exportação fica registrada na trilha |
| Correção | O colaborador altera telefone e foto na hora. Nome, e-mail, endereço e dados bancários viram um pedido (`POST /api/solicitacoes-alteracao`, ou `PUT /api/perfil/meus-dados`, que responde 403 e cria o pedido) que o RH aprova em **Aprovações**. O pedido de um RH vai ao Administrador. O Administrador altera os próprios dados direto |
| Eliminação | `POST /api/funcionarios/:id/anonimizar` (só o Administrador) |

Trocar o e-mail de login exige a senha atual e incrementa `sessao_versao`, que derruba as sessões abertas.

### Anonimização

Só vale para cadastro **já desligado** (status Inativo), nunca para o do próprio operador, e não tem volta. Numa transação:

* **Apagado ou trocado por valor neutro:** nome (`Colaborador anonimizado <id>`), e-mail (`anonimizado-<id>@anonimizado.invalid`), CPF, telefone, data de nascimento, endereço, banco, agência, conta e tipo de conta; nome e e-mail da conta de acesso, cuja senha vira o hash de um valor aleatório que ninguém conhece e cujas sessões caem; a foto; o nome impresso nos holerites; a latitude e a longitude das marcações; o texto livre das justificativas (que pode contar motivos de saúde ou família); o conteúdo dos pedidos de alteração (os pendentes viram cancelados); `antes`, `depois` e o IP da trilha do colaborador, e o nome de quem agiu quando era ele.
* **Mantido:** o cadastro com o mesmo `id`, o salário, o cargo, o departamento e a situação; as marcações de ponto, com o `id` do colaborador e sem localização; as decisões sobre justificativas; os valores dos holerites e as rubricas; o histórico contratual; na trilha, quem agiu, quando e qual ação, e os valores de salário (`funcionario.salario_alterado`), que são registro da folha.
* O cadastro anonimizado aparece na lista como **Anonimizado** e não pode mais ser editado, reativado nem ganhar senha. `funcionarios.anonimizado_em` marca o momento. A própria anonimização fica na trilha, sem o que foi apagado.

## Política de retenção (proposta)

O HRFlow **não apaga nada sozinho**: a retenção é uma decisão da empresa, executada por pessoas (a anonimização é uma ação do Administrador). Os prazos abaixo são uma proposta para a empresa validar com o jurídico dela; a base para guardar é o cumprimento de obrigação legal e o exercício regular de direitos (art. 7º, II e VI, e art. 16 da LGPD).

| Dado | Enquanto houver vínculo | Depois do desligamento |
| --- | --- | --- |
| Cadastro, conta de acesso, foto | Mantidos | Acesso desativado no desligamento. Foto, telefone e endereço podem ser anonimizados já a pedido do titular |
| Marcações de ponto e justificativas | Mantidas | Guardadas por **5 anos** (proposta, alinhada ao prazo prescricional trabalhista), depois anonimizadas. A localização das marcações é dado a mais: a empresa pode anonimizá-la antes |
| Holerites e folha fechada | Mantidos | Guardados por **5 anos** (proposta), depois anonimizados |
| Histórico contratual | Mantido | Segue o prazo da folha |
| Trilha de auditoria | Mantida | Guardada enquanto o cadastro existir. O conteúdo pessoal sai na anonimização do colaborador |
| Pedidos de alteração | Mantidos | Ficam sem conteúdo na anonimização |

Para cumprir a política, a empresa lista os desligados com mais de 5 anos (**Colaboradores**, situação Inativo, coluna de desligamento) e anonimiza cada cadastro. Automatizar isso é trabalho futuro e depende de a empresa aprovar os prazos.

## Limites conhecidos

* CPF, salário, dados bancários e endereço estão em texto no MySQL, sem criptografia por coluna. A proteção é o acesso restrito ao banco e ao disco.
* O armazenamento das fotos em S3 com URL assinada não foi feito: hoje elas são binário no próprio MySQL (`avatares`), atrás do mesmo controle de acesso. A tabela isola a foto do cadastro e deixa a troca de armazenamento para depois, sem mudar a API.
* A anonimização não alcança cópias que a empresa já baixou (a exportação, os backups do banco). Backups seguem o ciclo próprio de retenção da infraestrutura.
* Não há coleta de consentimento nem registro de base legal por finalidade. A base padrão é a execução do contrato de trabalho e a obrigação legal.
