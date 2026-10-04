import React, { useState } from 'react';
import { Cake } from 'lucide-react';
import { useAniversariantes } from '../../queries/relatorios';
import { queryDoRelatorio, type Birthday } from '../../services/relatoriosService';
import { mesAtualNoFuso, rotuloDaCompetencia } from '../../utils/competencia';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import Card from '../ui/Card';
import DataTable, { type Column } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Field, { Input } from '../ui/Field';
import CorpoDoRelatorio from './CorpoDoRelatorio';
import ExportarRelatorio from './ExportarRelatorio';

const colunas: Column<Birthday>[] = [
  { key: 'dia', header: 'Dia', cell: (aniversariante) => <span className="font-semibold text-ink">{aniversariante.dia}</span>, className: 'w-24' },
  { key: 'nome', header: 'Colaborador', cell: (aniversariante) => <span className="font-semibold text-ink">{aniversariante.nome}</span> },
  { key: 'departamento', header: 'Departamento', cell: (aniversariante) => aniversariante.departamento ?? '—' },
  { key: 'cargo', header: 'Cargo', cell: (aniversariante) => aniversariante.cargo ?? '—' },
];

// Quem faz aniversário no mês. Só o dia e o mês aparecem: o ano de nascimento fica no cadastro.
const RelatorioDeAniversariantes: React.FC = () => {
  const fuso = useFusoDaEmpresa();
  const [mes, setMes] = useState(() => mesAtualNoFuso(fuso));
  const { data, error, isPending, refetch } = useAniversariantes(mes);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Field label="Mês" name="mes">
          <Input type="month" autoComplete="off" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
        </Field>
        <ExportarRelatorio relatorio="aniversariantes" query={queryDoRelatorio.aniversariantes(mes)} />
      </div>

      <CorpoDoRelatorio carregando={isPending} erro={error} mensagemDeErroPadrao="Erro ao carregar os aniversariantes" aoTentarDeNovo={() => { void refetch(); }}>
        <Card as="section" padding="none">
          <DataTable
            caption={`Aniversariantes de ${rotuloDaCompetencia(mes)}`}
            columns={colunas}
            rows={data ?? []}
            rowKey={(aniversariante) => aniversariante.funcionarioId}
            empty={<EmptyState icon={<Cake size={28} />} title="Ninguém faz aniversário neste mês." />}
          />
        </Card>
      </CorpoDoRelatorio>
    </div>
  );
};

export default RelatorioDeAniversariantes;
