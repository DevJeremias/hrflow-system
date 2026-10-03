# Folha: INSS, IRRF, FGTS e encargos

Como a folha calcula cada rubrica e de onde vêm os números. O código está em `backend/modules/folha/` (`folha.tabelas.ts` guarda as tabelas por vigência, `folha.regras.ts` calcula) e os testes que o conferem em `backend/tests/folhaIrrf.test.ts` e `backend/tests/folhaEventos.test.ts`.

## Fontes oficiais (conferidas em 03/10/2026)

* Receita Federal, [Tributação de 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026): tabela mensal do IRRF a partir de janeiro de 2026, dedução por dependente de R$ 189,59, limite do desconto simplificado de R$ 607,20 e a tabela de redução mensal.
* [Lei 15.270, de 26 de novembro de 2025](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm), art. 2º (que cria o art. 3º-A da Lei 9.250/1995): a redução do imposto sobre os rendimentos tributáveis sujeitos à incidência mensal.
* Receita Federal, [exemplos de aplicação da Lei 15.270/2025](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/exemplos-de-aplicacao-da-lei-15-270-2025): cinco casos resolvidos passo a passo, reproduzidos como testes.
* Portaria Interministerial MPS/MF nº 13/2026: tabela do INSS (já em uso desde B-01).

A Receita não oferece calculadora do IRRF da folha com saída anexável: o que ela publica é a tabela e os cinco exemplos oficiais acima. O exemplo de 6.800,00 abaixo segue os mesmos passos deles, e cada passo dos cinco exemplos oficiais é um teste (`exemplos da Receita Federal` em `folhaIrrf.test.ts`).

## IRRF do mês

1. **Rendimento tributável** = salário + horas extras − faltas. É o que a lei chama de "rendimentos tributáveis sujeitos à incidência mensal".
2. **Dedução**: o maior entre as deduções legais (INSS do mês + R$ 189,59 por dependente) e o desconto simplificado de R$ 607,20. O simplificado substitui as deduções legais, não se soma a elas.
3. **Base de cálculo** = rendimento − dedução (nunca negativa).
4. **Imposto da tabela** = base × alíquota − parcela a deduzir, na faixa da base (arredondado ao centavo):

| Base de cálculo | Alíquota | Parcela a deduzir |
| --- | --- | --- |
| até R$ 2.428,80 | isento | |
| de R$ 2.428,81 até R$ 2.826,65 | 7,5% | R$ 182,16 |
| de R$ 2.826,66 até R$ 3.751,05 | 15% | R$ 394,16 |
| de R$ 3.751,06 até R$ 4.664,68 | 22,5% | R$ 675,49 |
| acima de R$ 4.664,68 | 27,5% | R$ 908,73 |

5. **Redução** (Lei 15.270/2025), sobre o **rendimento tributável**, não sobre a base:
   * até R$ 5.000,00: redução de até R$ 312,89, limitada ao imposto (o imposto vai a zero);
   * de R$ 5.000,01 a R$ 7.350,00: R$ 978,62 − 0,133145 × rendimento, também limitada ao imposto;
   * acima de R$ 7.350,00: nenhuma.
6. **IRRF** = imposto da tabela − redução.

### Exemplo auditado: salário de R$ 6.800,00, sem dependentes

| Passo | Conta | Resultado |
| --- | --- | --- |
| INSS | 1.621,00 × 7,5% + 1.281,84 × 9% + 1.451,43 × 12% + 2.445,73 × 14% | **R$ 753,51** |
| Dedução | maior entre INSS (753,51) e simplificado (607,20) | 753,51 |
| Base de cálculo | 6.800,00 − 753,51 | 6.046,49 |
| Imposto da tabela | 6.046,49 × 27,5% − 908,73 | 754,05 |
| Redução | 978,62 − 0,133145 × 6.800,00 | 73,23 |
| **IRRF** | 754,05 − 73,23 | **R$ 680,82** |
| Líquido | 6.800,00 − 753,51 − 680,82 | R$ 5.365,67 |

Com **um dependente** a dedução legal passa a 753,51 + 189,59 = 943,10: base 5.856,90, imposto 701,92, mesma redução de 73,23, IRRF **R$ 628,69**.

A API devolve exatamente estes valores em `GET /api/folha/competencias/2026-10` (campos `inss`, `irrf`, `bases.irrf` e `dependents` de cada item), conferidos em `folhaEventos.test.ts`.

### Os cinco exemplos da Receita Federal (testes)

| Exemplo | Rendimento | INSS informado | Base | Imposto da tabela | Redução | IRRF |
| --- | --- | --- | --- | --- | --- | --- |
| 1, alíquota zero | 3.036,00 | 257,73 | 2.428,00 (simplificado) | 0,00 | | 0,00 |
| 2, até 5 mil | 4.000,00 | 373,41 | 3.392,80 (simplificado) | 114,76 | 114,76 | 0,00 |
| 3, 5 mil | 5.000,00 | 509,60 | 4.392,80 (simplificado) | 312,89 | 312,89 | 0,00 |
| 4, acima de 5 mil | 6.000,00 | 649,60 | 5.350,40 (legais) | 562,63 | 179,75 | 382,88 |
| 5, sem redução | 7.607,20 | 0,00 | 7.000,00 (simplificado) | 1.016,27 | 0,00 | 1.016,27 |

## FGTS

8% da remuneração (salário + horas extras − faltas), por vínculo CLT. É **encargo da empresa**: aparece no holerite como informação (FGTS do mês e base de cálculo) e na lista de encargos da folha, e **não** reduz o líquido do colaborador.

## Encargos por regime tributário

Lidos de `empresas.regime_tributario` e copiados para a folha no processamento (mudar o regime depois não reescreve um mês fechado). Além do FGTS:

| Regime | Contribuições patronais |
| --- | --- |
| Simples Nacional | nenhuma (o INSS patronal vai dentro do DAS) |
| Lucro Presumido, Lucro Real | CPP 20% + RAT 2% + terceiros 5,8% (27,8%) |
| não informado | a regra dos 27,8%, a mesma que a folha sempre estimou |

PJ e estágio não têm INSS, IRRF, FGTS, hora extra nem encargo. Os 27,8% pressupõem RAT de 2% (grau de risco médio, FAP 1,0) e terceiros de 5,8%: a composição exata por atividade da empresa precisa de parecer contábil.

## Eventos da folha

| Rubrica | Origem | Regra |
| --- | --- | --- |
| Horas extras 50% e 100% | ponto (B-15): minutos excedentes de cada dia | hora = salário ÷ (carga semanal × 5); dia útil e sábado a 50%, domingo a 100%; entram nas bases de INSS, FGTS e IRRF |
| Faltas | ponto (B-15): dias apurados como falta, sem justificativa aprovada | salário ÷ 30 por dia; reduzem as bases. Dia depois do desligamento não conta. Sem nenhuma marcação no mês nada é descontado: não há como saber se a pessoa faltou ou se a empresa não usa o ponto |
| Adiantamento, vale-refeição, plano de saúde | lançamento do RH | desconto do valor lançado; não reduzem as bases |
| Vale-transporte | lançamento do RH (custo do vale) | desconto do menor entre o custo e 6% do salário |

Fora do escopo desta entrega: DSR sobre horas extras, desconto de atraso e saída antecipada, férias, 13º salário, pensão alimentícia e a faixa de isenção de 65 anos.
