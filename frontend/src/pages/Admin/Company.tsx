import React, { useState, useEffect } from 'react';
import { Landmark } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Company as CompanyData, REGIMES_TRIBUTARIOS, getCompany, saveCompany } from '../../services/empresaService';
import ErrorAlert from '../../components/ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import { mascararCnpj } from '../../utils/empresa';

interface Formulario {
  razaoSocial: string;
  cnpj: string;
  regime: string;
}

const formularioDe = (empresa: CompanyData): Formulario => ({
  razaoSocial: empresa.razao_social ?? '',
  cnpj: mascararCnpj(empresa.cnpj ?? ''),
  regime: empresa.regime_tributario ?? ''
});

const campo = 'w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-600 disabled:text-slate-500 disabled:cursor-not-allowed';
const rotulo = 'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2';

// Os dados legais que o holerite imprime. O RH confere; só o Administrador altera.
const Company: React.FC = () => {
  const { user } = useAuth();
  const podeEditar = user?.role === 'Administrador';
  const [empresa, setEmpresa] = useState<CompanyData | null>(null);
  const [form, setForm] = useState<Formulario>({ razaoSocial: '', cnpj: '', regime: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let ativo = true;
    getCompany()
      .then((dados) => {
        if (!ativo) return;
        setEmpresa(dados);
        setForm(formularioDe(dados));
      })
      .catch((error) => { if (ativo) setLoadError(mensagemDeErro(error, 'Erro ao buscar os dados da empresa')); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [reloadKey]);

  const alterar = (parcial: Partial<Formulario>) => {
    setForm((atual) => ({ ...atual, ...parcial }));
    setSaved(false);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const gravada = await saveCompany({
        razao_social: form.razaoSocial,
        cnpj: form.cnpj,
        regime_tributario: (form.regime || null) as CompanyData['regime_tributario']
      });
      setEmpresa(gravada);
      setForm(formularioDe(gravada));
      setSaved(true);
    } catch (error) {
      setSaveError(mensagemDeErro(error, 'Erro ao salvar os dados da empresa'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dados da Empresa</h1>
        <p className="text-slate-500 font-medium mt-1">Razão social e CNPJ aparecem no cabeçalho dos holerites. A folha só fecha com os dois preenchidos.</p>
      </div>

      {loading ? (
        <div role="status" className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          <p className="font-bold">Carregando os dados da empresa...</p>
        </div>
      ) : loadError || !empresa ? (
        <ErrorAlert message={loadError ?? 'Dados da empresa indisponíveis.'} onRetry={retry} />
      ) : (
        <form onSubmit={salvar} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500"><Landmark size={24} /></div>
            <div>
              <p className={`${rotulo} mb-0`}>Nome no sistema</p>
              <p className="font-black text-lg">{empresa.nome}</p>
            </div>
          </div>

          {!podeEditar && (
            <p className="p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-500">Somente o Administrador altera os dados da empresa.</p>
          )}

          <div>
            <label htmlFor="razao-social" className={rotulo}>Razão social</label>
            <input id="razao-social" required maxLength={255} disabled={!podeEditar} value={form.razaoSocial} onChange={(e) => alterar({ razaoSocial: e.target.value })} className={campo} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="cnpj" className={rotulo}>CNPJ</label>
              <input id="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" disabled={!podeEditar} value={form.cnpj} onChange={(e) => alterar({ cnpj: mascararCnpj(e.target.value) })} className={campo} />
            </div>
            <div>
              <label htmlFor="regime" className={rotulo}>Regime tributário</label>
              <select id="regime" disabled={!podeEditar} value={form.regime} onChange={(e) => alterar({ regime: e.target.value })} className={campo}>
                <option value="">Não informado</option>
                {REGIMES_TRIBUTARIOS.map((regime) => <option key={regime} value={regime}>{regime}</option>)}
              </select>
            </div>
          </div>

          {saveError && <ErrorAlert message={saveError} />}
          {saved && <p role="status" className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold border border-emerald-100">Dados da empresa salvos.</p>}

          {podeEditar && (
            <button type="submit" disabled={saving} className="px-8 py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar dados'}
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default Company;
