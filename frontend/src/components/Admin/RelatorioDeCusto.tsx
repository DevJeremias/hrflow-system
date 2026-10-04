import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { useCustoPorDepartamento } from '../../queries/relatorios';
import { HttpError } from '../../services/httpClient';
import { queryDoRelatorio } from '../../services/relatoriosService';
import type { LinhaDeCustoApi } from '../../types/api';
import { mesAtualNoFuso, rotuloDaCompetencia } from '../../utils/competencia';
import { formatarMoeda } from '../../utils/moeda';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Field, { Input } from '../ui/Field';
import CorpoDoRelatorio from './CorpoDoRelatorio';
import ExportarRelatorio from './ExportarRelatorio';

// O custo da folha de uma competência por departamento: a mesma folha da tela de folha, somada por setor.
const RelatorioDeCusto: React.FC = () => {
  const fuso = useFusoDaEmpresa();
  const [competencia, setCompetencia] = useState(() => mesAtualNoFuso(fuso));
  const { data, error, isPending, refetch } = useCustoPorDepartamento(competencia);

  const colunas: Column<LinhaDeCustoApi>[] = data ? [
    { key: 'departamento', header: 'Departamento', cell: (linha) => <span className="font-semibold text-ink">{linha.departamento}</span>, footer: 'Total' },
    { key: 'colaboradores', header: 'Colaboradores', align: 'right', cell: (linha) => linha.colaboradores, footer: data.total.colaboradores },
    { key: 'bruto', header: 'Bruto', align: 'right', cell: (linha) => formatarMoeda(linha.bruto), footer: formatarMoeda(data.total.bruto) },
    { key: 'descontos', header: 'Descontos', align: 'right', cell: (linha) => formatarMoeda(linha.descontos), footer: formatarMoeda(data.total.descontos) },
    { key: 'liquido', header: 'Líquido', align: 'right', cell: (linha) => formatarMoeda(linha.liquido), footer: formatarMoeda(data.total.liquido) },
    { key: 'encargos', header: 'Encargos', align: 'right', cell: (linha) => formatarMoeda(linha.encargos), footer: formatarMoeda(data.total.encargos) },
    { key: 'custoTotal', header: 'Custo total', align: 'right', cell: (linha) => <span className="font-semibold text-ink">{formatarMoeda(linha.custoTotal)}</span>, footer: formatarMoeda(data.total.custoTotal) },
  ] : [];

  // A folha que ainda não foi processada não é falha: é o que há para fazer antes do relatório.
  const folhaNaoProcessada = (erro: unknown) => (erro instanceof HttpError && erro.status === 404 ? (
    <Card as="section" padding="none">
      <EmptyState
        icon={<Landmark size={28} />}
        title={`A folha de ${rotuloDaCompetencia(competencia)} ainda não foi processada.`}
        description="O custo por departamento sai da folha de pagamento da competência."
        action={<Link to="/admin/folha" className="text-sm font-semibold text-brand underline underline-offset-4 hover:text-brand-hover">Ir para a folha de pagamento</Link>}
      />
    </Card>
  ) : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Field label="Competência" name="competencia">
          <Input type="month" autoComplete="off" value={competencia} max={mesAtualNoFuso(fuso)} onChange={(e) => e.target.value && setCompetencia(e.target.value)} />
        </Field>
        <ExportarRelatorio relatorio="custoPorDepartamento" query={queryDoRelatorio.custoPorDepartamento(competencia)} />
      </div>

      <CorpoDoRelatorio carregando={isPending} erro={error} mensagemDeErroPadrao="Erro ao carregar o custo por departamento" aoTentarDeNovo={() => { void refetch(); }} explicarErro={folhaNaoProcessada}>
        {data && (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              Competência {rotuloDaCompetencia(data.competencia)}
              <Badge tone={data.statusDaFolha === 'fechada' ? 'success' : 'warning'}>
                {data.statusDaFolha === 'fechada' ? 'Folha fechada' : 'Folha aberta (prévia)'}
              </Badge>
            </p>
            <Card as="section" padding="none">
              <DataTable
                caption="Custo da folha por departamento"
                columns={colunas}
                rows={data.departamentos}
                rowKey={(linha) => linha.departamento}
                stackBelow="xl"
                compact
                empty={<EmptyState icon={<Landmark size={28} />} title="A folha desta competência não tem colaboradores." />}
              />
            </Card>
            <p className="text-xs text-ink-muted">Custo total: bruto mais encargos. Os totais são os da folha da competência.</p>
          </>
        )}
      </CorpoDoRelatorio>
    </div>
  );
};

export default RelatorioDeCusto;
