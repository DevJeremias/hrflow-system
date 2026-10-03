import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Download, Lock, RefreshCw } from 'lucide-react';
import { useAcaoDaFolha, useFolhaDaCompetencia } from '../../queries/folha';
import PayrollSummaryCards from '../../components/Admin/PayrollMetrics';
import PayrollTable from '../../components/Admin/PayrollTable';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Field, { Input, Select } from '../../components/ui/Field';
import { useConfirm } from '../../components/ui/confirmContext';
import { useToast } from '../../components/ui/toastContext';
import { downloadPayrollPdf } from '../../services/payrollService';
import { mensagemDeErro } from '../../utils/erros';
import { mesAtualEmBelem, rotuloDaCompetencia, formatarMomento } from '../../utils/competencia';
import { usePageTitle } from '../../hooks/usePageTitle';

const Payroll: React.FC = () => {
  usePageTitle('Folha de pagamento');
  const confirmar = useConfirm();
  const toast = useToast();
  const [competencia, setCompetencia] = useState(mesAtualEmBelem);
  const [deptFilter, setDeptFilter] = useState('Todos');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // A folha de cada competência fica em cache: trocar de mês e voltar não refaz a chamada.
  const { data, error, isPending, refetch } = useFolhaDaCompetencia(competencia);
  const processar = useAcaoDaFolha(competencia, 'processar');
  const fechar = useAcaoDaFolha(competencia, 'fechar');
  const folha = data ?? null;
  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar a folha de pagamento') : null;
  const acao = processar.isPending ? 'processar' : fechar.isPending ? 'fechar' : null;
  const falhaDaAcao = processar.error ?? fechar.error;
  const actionError = falhaDaAcao ? mensagemDeErro(falhaDaAcao, 'Não foi possível concluir a operação.') : null;

  const trocarCompetencia = (nova: string) => {
    setCompetencia(nova);
    processar.reset();
    fechar.reset();
    setDeptFilter('Todos');
  };

  const retry = () => { refetch(); };

  const executar = async (qual: 'processar' | 'fechar') => {
    processar.reset();
    fechar.reset();
    try {
      await (qual === 'processar' ? processar : fechar).mutateAsync();
    } catch {
      // O erro aparece na tela por actionError.
    }
  };

  const itens = folha?.itens;
  const displayedPayrolls = useMemo(() => {
    if (!itens) return [];
    return deptFilter === 'Todos' ? itens : itens.filter(p => p.department === deptFilter);
  }, [itens, deptFilter]);

  const dynamicMetrics = useMemo(() => {
    return displayedPayrolls.reduce((acc, curr) => ({
      gross: acc.gross + curr.totalGross,
      retentions: acc.retentions + curr.inss + curr.irrf,
      net: acc.net + curr.netSalary,
      charges: acc.charges + curr.employerCharges
    }), { gross: 0, retentions: 0, net: 0, charges: 0 });
  }, [displayedPayrolls]);

  const departmentsList = useMemo(() => Array.from(new Set((itens ?? []).map(p => p.department))), [itens]);
  const rotulo = rotuloDaCompetencia(competencia);
  const fechada = folha?.status === 'fechada';

  const baixarPdfDaFolha = async () => {
    setDownloadingPdf(true);
    try {
      await downloadPayrollPdf(competencia);
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Não foi possível gerar o PDF dos holerites.'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const fecharMes = async () => {
    if (!folha) return;
    const semSalario = folha.pendencias.length > 0 ? ` ${folha.pendencias.length} colaborador(es) sem salário ficarão sem holerite neste mês.` : '';
    const confirmado = await confirmar({
      title: `Fechar a folha de ${rotulo}?`,
      description: `Depois de fechada, a folha não pode ser processada de novo: salários e dados da empresa passam a valer como estão.${semSalario}`,
      confirmLabel: 'Confirmar fechamento',
    });
    if (confirmado) await executar('fechar');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Gestão de Folha"
        description={fechada ? `Folha de ${rotulo}, fechada.` : `Folha de ${rotulo}: confira os holerites e feche o mês.`}
        actions={(
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Competência" name="competencia">
              <Input type="month" autoComplete="off" value={competencia} max={mesAtualEmBelem()} onChange={(e) => e.target.value && trocarCompetencia(e.target.value)} />
            </Field>
            {folha && (
              <Field label="Setor" name="setor">
                <Select autoComplete="off" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                  <option value="Todos">Todos os Setores</option>
                  {departmentsList.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Select>
              </Field>
            )}
          </div>
        )}
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
          <Spinner size="lg" rotulo="Carregando a folha" />
          <p className="font-semibold" aria-hidden="true">Carregando a folha...</p>
        </div>
      ) : loadError ? (
        <ErrorAlert message={loadError} onRetry={retry} />
      ) : !folha ? (
        <Card padding="none">
          <EmptyState
            title={`A folha de ${rotulo} ainda não foi processada.`}
            description="Ao processar, o sistema calcula o holerite de cada colaborador com o cadastro de agora. Você confere antes de fechar o mês."
            action={(
              <>
                <Button icon={<RefreshCw size={16} aria-hidden="true" />} onClick={() => executar('processar')} loading={acao === 'processar'} disabled={acao !== null}>
                  {acao === 'processar' ? 'Processando...' : 'Processar folha'}
                </Button>
                {actionError && <div className="w-full max-w-xl"><ErrorAlert message={actionError} /></div>}
              </>
            )}
          />
        </Card>
      ) : (
        <>
          <Card className={`flex flex-wrap items-center justify-between gap-4 ${fechada ? 'border-success-line bg-success-soft' : ''}`}>
            <div className="flex items-center gap-3">
              {fechada
                ? <Lock size={20} aria-hidden="true" className="shrink-0 text-success" />
                : <CheckCircle2 size={20} aria-hidden="true" className="shrink-0 text-ink-muted" />}
              <div>
                <p className="font-bold text-ink">{fechada ? 'Folha fechada' : 'Folha aberta'}</p>
                <p className="text-sm text-ink-muted">
                  {fechada && folha.fechadaEm
                    ? `Fechada em ${formatarMomento(folha.fechadaEm)}. Os colaboradores já veem o holerite e nada mais muda nesta competência.`
                    : `Processada em ${formatarMomento(folha.processadaEm)}. Alterações no cadastro só entram ao processar de novo.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {folha.itens.length > 0 && (
                <Button variant="secondary" icon={<Download size={16} aria-hidden="true" />} onClick={baixarPdfDaFolha} loading={downloadingPdf}>
                  {downloadingPdf ? 'Gerando PDF...' : 'Baixar PDF dos holerites'}
                </Button>
              )}
              {!fechada && (
                <>
                  <Button variant="secondary" icon={<RefreshCw size={16} aria-hidden="true" />} onClick={() => executar('processar')} loading={acao === 'processar'} disabled={acao !== null}>
                    {acao === 'processar' ? 'Processando...' : 'Processar novamente'}
                  </Button>
                  <Button icon={<Lock size={16} aria-hidden="true" />} onClick={fecharMes} loading={acao === 'fechar'} disabled={acao !== null}>
                    {acao === 'fechar' ? 'Fechando...' : 'Fechar mês'}
                  </Button>
                </>
              )}
            </div>
          </Card>

          {actionError && <ErrorAlert message={actionError} />}

          {!fechada && folha.regimeTributario === null && (
            <Card className="border-warning-line bg-warning-soft text-sm text-warning">
              <p className="font-semibold">O regime tributário da empresa não foi informado.</p>
              <p>Os encargos usam a regra geral (INSS patronal 20%, RAT 2% e terceiros 5,8%, mais 8% de FGTS). Peça a um Administrador para informá-lo na tela Empresa e processe a folha de novo.</p>
            </Card>
          )}

          {folha.pendencias.length > 0 && (
            <Card className="border-warning-line bg-warning-soft">
              <div className="mb-3 flex items-center gap-2 text-warning">
                <AlertTriangle size={18} aria-hidden="true" />
                <h2 className="font-bold">Pendências ({folha.pendencias.length})</h2>
              </div>
              <p className="mb-3 text-sm text-warning">
                {fechada ? 'Estes colaboradores ficaram de fora desta folha e não têm holerite nesta competência.' : 'Estes colaboradores não entraram na folha. Corrija o cadastro e processe de novo.'}
              </p>
              <ul className="divide-y divide-warning-line text-sm text-ink">
                {folha.pendencias.map((pendencia) => (
                  <li key={pendencia.funcionarioId} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-semibold">{pendencia.nome}</span>
                    <span>{pendencia.motivo}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <PayrollSummaryCards metrics={dynamicMetrics} />
          <PayrollTable payrolls={displayedPayrolls} competencia={competencia} empresa={folha.empresa} locked={fechada} />
        </>
      )}
    </div>
  );
};

export default Payroll;
