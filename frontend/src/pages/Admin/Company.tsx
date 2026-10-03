import React, { useState } from 'react';
import { Landmark } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Company as CompanyData, REGIMES_TRIBUTARIOS } from '../../services/empresaService';
import { useEmpresa, useSalvarEmpresa } from '../../queries/empresa';
import ErrorAlert from '../../components/ErrorAlert';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Field, { Input, Select } from '../../components/ui/Field';
import { mensagemDeErro } from '../../utils/erros';
import { mascararCnpj } from '../../utils/empresa';
import { FUSO_PADRAO, FUSOS_DO_BRASIL, rotuloDoFuso } from '../../utils/fuso';
import { usePageTitle } from '../../hooks/usePageTitle';

interface Formulario {
  razaoSocial: string;
  cnpj: string;
  regime: string;
  fuso: string;
}

const formularioDe = (empresa: CompanyData): Formulario => ({
  razaoSocial: empresa.razao_social ?? '',
  cnpj: mascararCnpj(empresa.cnpj ?? ''),
  regime: empresa.regime_tributario ?? '',
  fuso: empresa.fuso
});

// Os dados legais que o holerite imprime. O RH confere; só o Administrador altera.
const Company: React.FC = () => {
  usePageTitle('Dados da empresa');
  const { user } = useAuth();
  const podeEditar = user?.role === 'Administrador';
  const { data: empresa, error, isPending, refetch } = useEmpresa();
  const salvarEmpresa = useSalvarEmpresa();
  // O formulário nasce da empresa carregada; `editado` guarda o que o RH digitou (nulo até ele digitar
  // ou a empresa ser gravada).
  const [editado, setEditado] = useState<Formulario | null>(null);
  const form = editado ?? (empresa ? formularioDe(empresa) : { razaoSocial: '', cnpj: '', regime: '', fuso: FUSO_PADRAO });
  const loading = isPending;
  const loadError = error ? mensagemDeErro(error, 'Erro ao buscar os dados da empresa') : null;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const retry = () => { refetch(); };

  const alterar = (parcial: Partial<Formulario>) => {
    setEditado({ ...form, ...parcial });
    setSaved(false);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const gravada = await salvarEmpresa.mutateAsync({
        razao_social: form.razaoSocial,
        cnpj: form.cnpj,
        regime_tributario: (form.regime || null) as CompanyData['regime_tributario'],
        fuso: form.fuso
      });
      setEditado(formularioDe(gravada));
      setSaved(true);
    } catch (error) {
      setSaveError(mensagemDeErro(error, 'Erro ao salvar os dados da empresa'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Dados da Empresa"
        description="Razão social e CNPJ aparecem no cabeçalho dos holerites. A folha só fecha com os dois preenchidos."
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
          <Spinner size="lg" rotulo="Carregando os dados da empresa" />
          <p className="font-semibold" aria-hidden="true">Carregando os dados da empresa...</p>
        </div>
      ) : loadError || !empresa ? (
        <ErrorAlert message={loadError ?? 'Dados da empresa indisponíveis.'} onRetry={retry} />
      ) : (
        <Card as="section" padding="lg">
          <form onSubmit={salvar} className="space-y-6">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-control bg-surface-sunken text-ink-muted"><Landmark size={24} /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Nome no sistema</p>
                <p className="text-lg font-bold text-ink">{empresa.nome}</p>
              </div>
            </div>

            {!podeEditar && (
              <p className="rounded-control bg-surface-muted p-4 text-sm font-semibold text-ink-muted">Somente o Administrador altera os dados da empresa.</p>
            )}

            <Field label="Razão social" name="razaoSocial" required>
              <Input autoComplete="off" maxLength={255} disabled={!podeEditar} value={form.razaoSocial} onChange={(e) => alterar({ razaoSocial: e.target.value })} />
            </Field>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field label="CNPJ" name="cnpj" required>
                <Input autoComplete="off" inputMode="numeric" placeholder="00.000.000/0000-00" disabled={!podeEditar} value={form.cnpj} onChange={(e) => alterar({ cnpj: mascararCnpj(e.target.value) })} />
              </Field>
              <Field label="Regime tributário" name="regime">
                <Select autoComplete="off" disabled={!podeEditar} value={form.regime} onChange={(e) => alterar({ regime: e.target.value })}>
                  <option value="">Não informado</option>
                  {REGIMES_TRIBUTARIOS.map((regime) => <option key={regime} value={regime}>{regime}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Fuso horário" name="fuso" hint="Define o dia do ponto e o mês da folha. O horário exibido aos colaboradores segue este fuso.">
              <Select autoComplete="off" disabled={!podeEditar} value={form.fuso} onChange={(e) => alterar({ fuso: e.target.value })}>
                {FUSOS_DO_BRASIL.map(({ zona }) => <option key={zona} value={zona}>{rotuloDoFuso(zona)}</option>)}
              </Select>
            </Field>

            {saveError && <ErrorAlert message={saveError} />}
            {saved && <p role="status" className="rounded-control border border-success-line bg-success-soft p-4 text-sm font-semibold text-success">Dados da empresa salvos.</p>}

            {podeEditar && (
              <Button type="submit" size="lg" loading={saving}>
                {saving ? 'Salvando...' : 'Salvar dados'}
              </Button>
            )}
          </form>
        </Card>
      )}
    </div>
  );
};

export default Company;
