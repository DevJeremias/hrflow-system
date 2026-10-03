import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { useAuditoria, useHistoricoContratual } from '../../queries/auditoria';
import type { PeriodoContratual, RegistroDeAuditoria } from '../../services/auditoriaService';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card, { CardHeader } from '../../components/ui/Card';
import DataTable, { type Column } from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import Field, { Select } from '../../components/ui/Field';
import { formatarMomento } from '../../utils/competencia';
import { resumoDaMudanca, rotuloDaAcao } from '../../utils/auditoria';
import { mensagemDeErro } from '../../utils/erros';
import { usePageTitle } from '../../hooks/usePageTitle';

const PAGE_SIZE = 50;

// O tipo de registro que o filtro oferece; o valor é o `entidade` da API.
const ENTIDADES = [
  { valor: '', rotulo: 'Tudo da empresa' },
  { valor: 'funcionario', rotulo: 'Cadastro de colaboradores' },
  { valor: 'usuario', rotulo: 'Acessos e senhas' },
  { valor: 'folha', rotulo: 'Folha de pagamento' },
  { valor: 'justificativa', rotulo: 'Justificativas de ponto' },
  { valor: 'solicitacao', rotulo: 'Pedidos de alteração' },
] as const;

const formatarDia = (dia: string) => dia.split('-').reverse().join('/');
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const colunasDaTrilha: Column<RegistroDeAuditoria>[] = [
  {
    key: 'quando',
    header: 'Quando',
    cell: (r) => <time dateTime={r.criado_em} className="whitespace-nowrap text-ink">{formatarMomento(r.criado_em)}</time>,
  },
  {
    key: 'quem',
    header: 'Quem',
    cell: (r) => (r.usuario_nome ? (
      <>
        <span className="block font-semibold text-ink">{r.usuario_nome}</span>
        {r.perfil && <span className="block text-xs text-ink-muted">{r.perfil}</span>}
      </>
    ) : <span className="text-ink-muted">Sem conta identificada</span>),
  },
  {
    key: 'acao',
    header: 'O que aconteceu',
    cell: (r) => {
      const linhas = resumoDaMudanca(r);
      return (
        <>
          <span className="block font-semibold text-ink">{rotuloDaAcao(r.acao)}</span>
          {linhas.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
              {linhas.map((linha) => <li key={linha} className="break-words">{linha}</li>)}
            </ul>
          )}
        </>
      );
    },
  },
  { key: 'ip', header: 'Origem', cell: (r) => <span className="font-mono text-xs text-ink-muted">{r.ip ?? '-'}</span> },
];

const colunasDoHistorico: Column<PeriodoContratual>[] = [
  {
    key: 'periodo',
    header: 'Período',
    cell: (p) => (
      <span className="whitespace-nowrap text-ink">
        {formatarDia(p.vigencia_inicio)} a {p.vigencia_fim ? formatarDia(p.vigencia_fim) : <Badge tone="success">em vigor</Badge>}
      </span>
    ),
  },
  { key: 'salario', header: 'Salário', cell: (p) => (p.salario_base === null ? <span className="text-ink-muted">Não definido</span> : <span className="font-semibold text-ink">{moeda.format(Number(p.salario_base))}</span>) },
  { key: 'cargo', header: 'Cargo', cell: (p) => <span className="text-ink">{p.cargo ?? 'Não definido'}</span> },
  { key: 'departamento', header: 'Departamento', cell: (p) => <span className="text-ink-muted">{p.departamento ?? 'Não definido'}</span> },
];

// O histórico contratual do colaborador: o salário, o cargo e o departamento de cada período.
const HistoricoContratual: React.FC<{ funcionarioId: number }> = ({ funcionarioId }) => {
  const { data, error, isPending, refetch } = useHistoricoContratual(funcionarioId);
  if (error) return <ErrorAlert message={mensagemDeErro(error, 'Erro ao buscar o histórico contratual')} onRetry={() => { refetch(); }} />;
  return (
    <Card as="section" padding="none" className="overflow-hidden">
      <CardHeader title="Histórico contratual" level={2} />
      <DataTable
        caption="Salário, cargo e departamento de cada período"
        columns={colunasDoHistorico}
        rows={data ?? []}
        rowKey={(p) => p.id}
        loading={isPending}
        loadingRows={2}
        empty={<EmptyState title="Nenhum período registrado." />}
      />
    </Card>
  );
};

// Quem alterou o quê, quando e de onde, na empresa toda ou na vida de um colaborador (`?colaborador=ID&nome=...`,
// que a lista de colaboradores abre). Os registros só se leem: nada aqui os altera.
const Audit: React.FC = () => {
  const [params] = useSearchParams();
  const colaboradorParam = params.get('colaborador');
  const funcionarioId = colaboradorParam && /^\d{1,9}$/.test(colaboradorParam) ? Number(colaboradorParam) : null;
  const nomeDoColaborador = params.get('nome');
  usePageTitle(funcionarioId ? 'Histórico do colaborador' : 'Auditoria');

  const [page, setPage] = useState(1);
  const [entidade, setEntidade] = useState('');
  const consulta = funcionarioId
    ? { pagina: page, limite: PAGE_SIZE, entidade: 'funcionario', id: funcionarioId }
    : { pagina: page, limite: PAGE_SIZE, ...(entidade ? { entidade } : {}) };
  // A página anterior fica na tela enquanto a nova chega: só o primeiro carregamento mostra o esqueleto.
  const { data, error, isPending, isPlaceholderData, refetch } = useAuditoria(consulta);
  const registros = data?.registros ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar a trilha de auditoria') : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title={funcionarioId ? `Histórico de ${nomeDoColaborador || `colaborador ${funcionarioId}`}` : 'Auditoria'}
        description="Quem alterou o quê, quando e de onde. Os registros só se leem: ninguém os edita."
        actions={funcionarioId ? (
          <Link to="/admin/auditoria" className="inline-flex items-center gap-2 text-sm font-semibold text-brand underline-offset-2 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" /> Ver a empresa toda
          </Link>
        ) : undefined}
      />

      {funcionarioId && <HistoricoContratual funcionarioId={funcionarioId} />}

      {!funcionarioId && (
        <Card padding="sm">
          <div className="max-w-xs">
            <Field label="Mostrar" name="entidade">
              <Select value={entidade} onChange={(e) => { setEntidade(e.target.value); setPage(1); }}>
                {ENTIDADES.map(({ valor, rotulo }) => <option key={valor} value={valor}>{rotulo}</option>)}
              </Select>
            </Field>
          </div>
        </Card>
      )}

      {loadError && <ErrorAlert message={loadError} onRetry={() => { refetch(); }} />}

      {!loadError && (
        <DataTable
          caption="Registros de auditoria, do mais recente ao mais antigo"
          columns={colunasDaTrilha}
          rows={registros}
          rowKey={(r) => r.id}
          loading={isPending}
          loadingRows={4}
          className={`rounded-card transition-opacity md:border md:border-line md:bg-surface md:shadow-card ${isPlaceholderData ? 'opacity-60' : ''}`}
          empty={<Card><EmptyState icon={<History size={28} />} title="Nenhum registro encontrado." description="As ações que mudam dados e acessos aparecem aqui assim que acontecem." /></Card>}
        />
      )}

      {!loadError && !isPending && (
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
          <span>{total === 0 ? 'Nenhum registro' : `Página ${page} de ${pages} · ${total} registros`}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pages}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Audit;
