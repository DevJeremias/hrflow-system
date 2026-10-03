import { useEffect, useState } from 'react';
import { Clock, Search, Calendar as CalendarIcon, Users } from 'lucide-react';
import type { CompanyPointRecord } from '../../services/pontoService';
import { usePontoDaEmpresa } from '../../queries/ponto';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable, { type Column } from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import Field, { Input } from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import Tabs, { TabPanel, type TabItem } from '../../components/ui/Tabs';
import JustificativasPonto from '../../components/Admin/JustificativasPonto';
import { mensagemDeErro } from '../../utils/erros';
import { formatarDataIso, formatarHoraSemSegundos } from '../../utils/ponto';
import { mesAtualNoFuso } from '../../utils/competencia';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import { usePageTitle } from '../../hooks/usePageTitle';

type Aba = 'marcacoes' | 'justificativas';

const ABAS: readonly TabItem<Aba>[] = [
  { id: 'marcacoes', label: 'Marcações' },
  { id: 'justificativas', label: 'Justificativas' },
];

const ID_DAS_ABAS = 'gestao-ponto';

const TAMANHO_DA_PAGINA = 50;
const ATRASO_DA_BUSCA_MS = 300;

export default function TimeTracking() {
  usePageTitle('Gestão de ponto');
  const fuso = useFusoDaEmpresa();
  const [aba, setAba] = useState<Aba>('marcacoes');
  const [searchTerm, setSearchTerm] = useState('');
  const [busca, setBusca] = useState('');
  const [monthFilter, setMonthFilter] = useState(() => mesAtualNoFuso(fuso));
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const termo = searchTerm.trim();
    if (termo === busca) return undefined;
    const timer = setTimeout(() => {
      setBusca(termo);
      setPagina(1);
    }, ATRASO_DA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [searchTerm, busca]);

  // A página anterior fica na tela (esmaecida) enquanto a nova chega: só o primeiro carregamento mostra o indicador.
  const { data, error, isPending, isPlaceholderData, refetch } = usePontoDaEmpresa({
    mes: monthFilter, pagina, limite: TAMANHO_DA_PAGINA, busca,
  });

  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar os registros de ponto') : null;
  const registros = data?.registros ?? [];
  const total = data?.total ?? 0;
  const totalDePaginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA));

  const colaboradores = new Set(registros.map((registro) => registro.funcionario_id)).size;
  const diasMonitorados = new Set(registros.map((registro) => registro.date)).size;
  const retry = () => { refetch(); };
  const trocarMes = (mes: string) => {
    setMonthFilter(mes);
    setPagina(1);
  };

  const columns: Column<CompanyPointRecord>[] = [
    { key: 'colaborador', header: 'Colaborador', cell: (registro) => <span className="font-semibold text-ink">{registro.nome_funcionario}</span> },
    { key: 'data', header: 'Data', cell: (registro) => <span className="text-ink-muted">{formatarDataIso(registro.date)}</span> },
    { key: 'marcacao', header: 'Marcação', cell: (registro) => <span className="text-ink-muted">{registro.tipo_registro}</span> },
    { key: 'horario', header: 'Horário', cell: (registro) => <span className="font-semibold text-ink">{formatarHoraSemSegundos(registro.time)}</span> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Gestão de Ponto"
        description="Consulte as marcações de ponto dos colaboradores e decida as justificativas."
        actions={(
          <Field label="Mês de referência" name="mes">
            <Input type="month" autoComplete="off" value={monthFilter} onChange={(event) => event.target.value && trocarMes(event.target.value)} />
          </Field>
        )}
      />

      <Tabs tabs={ABAS} value={aba} onChange={setAba} label="Seções da gestão de ponto" idPrefix={ID_DAS_ABAS} />

      {aba === 'justificativas' ? (
        <TabPanel idPrefix={ID_DAS_ABAS} id="justificativas">
          <JustificativasPonto mes={monthFilter} />
        </TabPanel>
      ) : (
        <TabPanel idPrefix={ID_DAS_ABAS} id="marcacoes" className="space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard label="Marcações no mês" value={loading || loadError ? '—' : total} icon={<Clock size={24} />} tone="brand" />
          <StatCard label="Colaboradores nesta página" value={loading || loadError ? '—' : colaboradores} icon={<Users size={24} />} tone="success" />
          <StatCard label="Dias nesta página" value={loading || loadError ? '—' : diasMonitorados} icon={<CalendarIcon size={24} />} tone="warning" />
        </div>

        <Card as="section" padding="none" aria-busy={isPlaceholderData || undefined} className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <div className="flex flex-col items-stretch justify-between gap-4 border-b border-line bg-surface-muted p-5 md:flex-row md:items-center">
            <div className="w-full md:w-96">
              <Field label="Buscar colaborador" name="busca" hideLabel>
                <Input type="search" autoComplete="off" icon={<Search size={18} />} placeholder="Buscar colaborador..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
              </Field>
            </div>
            <p className="text-sm text-ink-muted">Dados limitados à empresa da sua sessão.</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
              <Spinner size="lg" rotulo="Carregando registros de ponto" />
              <p className="font-semibold">Carregando registros de ponto...</p>
            </div>
          ) : loadError ? (
            <div className="p-6"><ErrorAlert message={loadError} onRetry={retry} /></div>
          ) : (
            <div className="p-3 md:p-0">
              <DataTable
                caption="Marcações de ponto do mês"
                columns={columns}
                rows={registros}
                rowKey={(registro) => registro.id}
                empty={<EmptyState icon={<Clock size={28} />} title="Nenhum registro de ponto encontrado neste mês." />}
              />
            </div>
          )}
        </Card>

        {!loading && !loadError && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
            <span>Página {pagina} de {totalDePaginas} · {total} marcações</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPagina((atual) => atual - 1)} disabled={pagina <= 1}>Anterior</Button>
              <Button variant="secondary" size="sm" onClick={() => setPagina((atual) => atual + 1)} disabled={pagina >= totalDePaginas}>Próxima</Button>
            </div>
          </div>
        )}
        </TabPanel>
      )}
    </div>
  );
}
