import React, { useEffect, useState } from 'react';
import { Clock, Search, Calendar as CalendarIcon, Users } from 'lucide-react';
import { pontoService, type CompanyPointRecord } from '../../services/pontoService';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable, { type Column } from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import Field, { Input } from '../../components/ui/Field';
import Spinner from '../../components/ui/Spinner';
import { mensagemDeErro } from '../../utils/erros';
import { formatarDataIso, formatarHoraSemSegundos } from '../../utils/ponto';
import { usePageTitle } from '../../hooks/usePageTitle';

const mesAtualEmBelem = (): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Belem',
  year: 'numeric',
  month: '2-digit'
}).format(new Date()).slice(0, 7);

const TAMANHO_DA_PAGINA = 50;
const ATRASO_DA_BUSCA_MS = 300;

interface Resultado {
  chave: string;
  registros: CompanyPointRecord[];
  total: number;
  erro: string | null;
}

export default function TimeTracking() {
  usePageTitle('Gestão de ponto');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [busca, setBusca] = useState('');
  const [monthFilter, setMonthFilter] = useState(mesAtualEmBelem);
  const [pagina, setPagina] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const termo = searchTerm.trim();
    if (termo === busca) return undefined;
    const timer = setTimeout(() => {
      setBusca(termo);
      setPagina(1);
    }, ATRASO_DA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [searchTerm, busca]);

  const chave = `${monthFilter}|${busca}|${pagina}|${reloadKey}`;

  useEffect(() => {
    let ativo = true;
    const pronto = (parcial: Omit<Resultado, 'chave'>) => { if (ativo) setResultado({ chave, ...parcial }); };
    pontoService.getRegistrosDaEmpresa({ mes: monthFilter, pagina, limite: TAMANHO_DA_PAGINA, busca })
      .then((dados) => pronto({ ...dados, erro: null }))
      .catch((error) => pronto({ registros: [], total: 0, erro: mensagemDeErro(error, 'Erro ao buscar os registros de ponto') }));
    return () => { ativo = false; };
  }, [chave, monthFilter, pagina, busca]);

  const loading = resultado?.chave !== chave;
  const loadError = loading ? null : resultado.erro;
  const registros = loading ? [] : resultado.registros;
  const total = loading ? 0 : resultado.total;
  const totalDePaginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA));

  const colaboradores = new Set(registros.map((registro) => registro.funcionario_id)).size;
  const diasMonitorados = new Set(registros.map((registro) => registro.date)).size;
  const retry = () => setReloadKey((key) => key + 1);
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
        description="Consulte as marcações reais de ponto dos colaboradores."
        actions={(
          <Field label="Mês de referência" name="mes">
            <Input type="month" autoComplete="off" value={monthFilter} onChange={(event) => event.target.value && trocarMes(event.target.value)} />
          </Field>
        )}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard label="Marcações no mês" value={loading || loadError ? '—' : total} icon={<Clock size={24} />} tone="brand" />
        <StatCard label="Colaboradores nesta página" value={loading || loadError ? '—' : colaboradores} icon={<Users size={24} />} tone="success" />
        <StatCard label="Dias nesta página" value={loading || loadError ? '—' : diasMonitorados} icon={<CalendarIcon size={24} />} tone="warning" />
      </div>

      <Card as="section" padding="none">
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
    </div>
  );
}
