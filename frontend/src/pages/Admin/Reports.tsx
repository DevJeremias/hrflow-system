import React, { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import Tabs, { TabPanel, type TabItem } from '../../components/ui/Tabs';
import RelatorioDeHeadcount from '../../components/Admin/RelatorioDeHeadcount';
import RelatorioDeCusto from '../../components/Admin/RelatorioDeCusto';
import RelatorioDeAbsenteismo from '../../components/Admin/RelatorioDeAbsenteismo';
import RelatorioDeAniversariantes from '../../components/Admin/RelatorioDeAniversariantes';
import { usePageTitle } from '../../hooks/usePageTitle';

type Aba = 'headcount' | 'custo' | 'absenteismo' | 'aniversariantes';

const ABAS: readonly TabItem<Aba>[] = [
  { id: 'headcount', label: 'Headcount e turnover' },
  { id: 'custo', label: 'Custo por departamento' },
  { id: 'absenteismo', label: 'Absenteísmo' },
  { id: 'aniversariantes', label: 'Aniversariantes' },
];

const ID_DAS_ABAS = 'relatorios';

const PAINEL: Record<Aba, React.ReactNode> = {
  headcount: <RelatorioDeHeadcount />,
  custo: <RelatorioDeCusto />,
  absenteismo: <RelatorioDeAbsenteismo />,
  aniversariantes: <RelatorioDeAniversariantes />,
};

const Reports: React.FC = () => {
  usePageTitle('Relatórios');
  const [aba, setAba] = useState<Aba>('headcount');

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Relatórios"
        description="Acompanhe o quadro de colaboradores, o custo da folha e as ausências, e exporte em CSV ou PDF."
      />

      <Tabs tabs={ABAS} value={aba} onChange={setAba} label="Relatórios disponíveis" idPrefix={ID_DAS_ABAS} />
      <TabPanel idPrefix={ID_DAS_ABAS} id={aba} className="space-y-6">
        {PAINEL[aba]}
      </TabPanel>
    </div>
  );
};

export default Reports;
