import React, { useState, useEffect, useRef } from 'react';
import { User, Briefcase, CreditCard } from 'lucide-react';
import { Employee, EmployeeForm } from '../../services/employeeService';
import { getRoles, getDepartments, Role, Department } from '../../services/departmentsRolesService'
import { HttpError } from '../../services/httpClient';
import { PersonalTab, WorkTab, FinancialTab } from './EmployeeModalTabs';
import ErrorAlert from '../ErrorAlert';
import { mensagemDeErro } from '../../utils/erros';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Tabs, { TabPanel, type TabItem } from '../ui/Tabs';
import { useConfirm } from '../ui/confirmContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EmployeeForm) => Promise<void>;
  employeeToEdit?: Employee | null;
}

type Tab = 'personal' | 'work' | 'financial';

const initialState: EmployeeForm = {
  nomeCompleto: '', emailPessoal: '', telefone: '', cpf: '', dataNascimento: '', enderecoCompleto: '', senhaAcesso: '',
  matricula: '', cargo: '', cargoId: '', nivel: '', departamento: '', departamentoId: '', dataAdmissao: '', tipoContrato: 'CLT', salarioBase: '', status: 'Ativo',
  banco: '', agencia: '', conta: '', tipoConta: ''
};

// O formulário só guarda texto: o que a tela de colaboradores sabe do cadastro e não se edita aqui
// (perfil do acesso, se há movimento) fica de fora.
const formFrom = (employee: Employee): EmployeeForm => ({
  ...initialState,
  ...Object.fromEntries(Object.entries(employee).filter(([, value]) => typeof value === 'string' || typeof value === 'number')),
}) as EmployeeForm;

// Campo da API (detalhes[].campo) -> aba e campo do formulário onde o RH corrige o valor.
const CAMPOS_DA_API: Record<string, { tab: Tab; field: string }> = {
  nome: { tab: 'personal', field: 'nomeCompleto' },
  email: { tab: 'personal', field: 'emailPessoal' },
  senha: { tab: 'personal', field: 'senhaAcesso' },
  telefone: { tab: 'personal', field: 'telefone' },
  cpf: { tab: 'personal', field: 'cpf' },
  data_nascimento: { tab: 'personal', field: 'dataNascimento' },
  endereco: { tab: 'personal', field: 'enderecoCompleto' },
  data_admissao: { tab: 'work', field: 'dataAdmissao' },
  data_desligamento: { tab: 'work', field: 'dataDesligamento' },
  motivo_desligamento: { tab: 'work', field: 'motivoDesligamento' },
  cargo_id: { tab: 'work', field: 'cargoId' },
  nivel: { tab: 'work', field: 'nivel' },
  departamento_id: { tab: 'work', field: 'departamentoId' },
  tipo_contrato: { tab: 'work', field: 'tipoContrato' },
  salario_base: { tab: 'work', field: 'salarioBase' },
  banco: { tab: 'financial', field: 'banco' },
  agencia: { tab: 'financial', field: 'agencia' },
  conta: { tab: 'financial', field: 'conta' },
  tipo_conta: { tab: 'financial', field: 'tipoConta' },
};

const campoComErro = (error: unknown) => {
  const detalhes: { campo?: string | null }[] = error instanceof HttpError && Array.isArray(error.data?.detalhes) ? error.data.detalhes : [];
  for (const { campo } of detalhes) {
    if (campo && CAMPOS_DA_API[campo]) return CAMPOS_DA_API[campo];
  }
  return null;
};

const CONFIRMACAO_DESCARTE = 'Há dados digitados que ainda não foram salvos. Deseja descartá-los?';

const ABAS: readonly TabItem<Tab>[] = [
  { id: 'personal', label: 'Pessoal', icon: <User size={18} /> },
  { id: 'work', label: 'Contrato', icon: <Briefcase size={18} /> },
  { id: 'financial', label: 'Financeiro', icon: <CreditCard size={18} /> },
];

const ID_DAS_ABAS = 'colaborador';

type ContentProps = Omit<Props, 'isOpen'>;

// Monta junto com o modal: cada abertura começa com estado novo, sem efeito que o reinicie.
const EmployeeModalContent: React.FC<ContentProps> = ({ onClose, onSave, employeeToEdit }) => {
  const confirmar = useConfirm();
  const [initialForm] = useState<EmployeeForm>(() => (employeeToEdit ? formFrom(employeeToEdit) : initialState));
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [formData, setFormData] = useState<EmployeeForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errorTarget, setErrorTarget] = useState<{ field: string } | null>(null);
  // O estado só muda no próximo render: o ref fecha a janela entre dois cliques seguidos.
  const submittingRef = useRef(false);
  const corpoRef = useRef<HTMLDivElement>(null);
  // Campos que vieram do cargo e não foram digitados: só esses podem ser trocados por outro cargo.
  const filledByRole = useRef(new Set<string>());

  const [cargosList, setCargosList] = useState<Role[]>([]);
  const [departamentosList, setDepartamentosList] = useState<Department[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getRoles(), getDepartments()])
      .then(([cargos, departamentos]) => {
        setListError(null);
        setCargosList(cargos);
        setDepartamentosList(departamentos);
      })
      .catch((error) => setListError(mensagemDeErro(error, 'Erro ao carregar cargos e departamentos')));
  }, []);

  // Com o erro na tela, o foco vai ao campo a corrigir (a aba dele já foi aberta no mesmo render).
  useEffect(() => {
    if (errorTarget) corpoRef.current?.querySelector<HTMLElement>(`[name="${errorTarget.field}"]`)?.focus();
  }, [errorTarget]);

  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(initialForm);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updatedData = { ...formData, [name]: value };
    filledByRole.current.delete(name);

    // O cargo sugere departamento, nível e salário, mas só onde o RH ainda não digitou nada:
    // um valor digitado nunca é trocado ao escolher o cargo.
    if (name === 'cargoId') {
      const cargoSelecionado = cargosList.find(c => c.id === value);
      if (cargoSelecionado) {
        const sugestoes: EmployeeForm = {
          departamentoId: cargoSelecionado.departmentId,
          nivel: cargoSelecionado.level ?? '',
          salarioBase: cargoSelecionado.salary?.toString() ?? ''
        };
        for (const [field, suggested] of Object.entries(sugestoes)) {
          if (updatedData[field] && !filledByRole.current.has(field)) continue;
          updatedData[field] = suggested;
          if (suggested) filledByRole.current.add(field);
          else filledByRole.current.delete(field);
        }
      }
    }
    setFormData(updatedData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setErrorTarget(null);
    try {
      await onSave(formData);
    } catch (error) {
      setSubmitError(mensagemDeErro(error, 'Não foi possível salvar o colaborador. Tente novamente.'));
      const alvo = campoComErro(error);
      if (alvo) {
        setActiveTab(alvo.tab);
        setErrorTarget({ field: alvo.field });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Esc, clique fora, X e Cancelar são gestos fáceis de acionar sem querer: com dados digitados, pede confirmação.
  const requestClose = async () => {
    if (submittingRef.current) return;
    if (hasUnsavedChanges) {
      const descartar = await confirmar({
        title: 'Descartar alterações?',
        description: CONFIRMACAO_DESCARTE,
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'danger',
      });
      if (!descartar) return;
    }
    onClose();
  };

  return (
    <Modal
      title={employeeToEdit ? 'Editar Perfil' : 'Novo Colaborador'}
      description="Gestão de dados e contrato de trabalho."
      onClose={requestClose}
      form={{ onSubmit: handleSubmit }}
      footer={(
        <div className="space-y-4">
          {submitError && <ErrorAlert message={submitError} />}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={requestClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Salvando...' : employeeToEdit ? 'Salvar Alterações' : 'Confirmar Cadastro'}
            </Button>
          </div>
        </div>
      )}
    >
      <div ref={corpoRef} className="space-y-6">
        <Tabs tabs={ABAS} value={activeTab} onChange={setActiveTab} label="Seções do cadastro" idPrefix={ID_DAS_ABAS} />
        {listError && <ErrorAlert message={listError} />}
        <TabPanel idPrefix={ID_DAS_ABAS} id={activeTab}>
          {activeTab === 'personal' && <PersonalTab formData={formData} handleChange={handleChange} />}
          {activeTab === 'work' && <WorkTab formData={formData} handleChange={handleChange} cargos={cargosList} departamentos={departamentosList} />}
          {activeTab === 'financial' && <FinancialTab formData={formData} handleChange={handleChange} />}
        </TabPanel>
      </div>
    </Modal>
  );
};

const EmployeeModal: React.FC<Props> = ({ isOpen, ...resto }) => (isOpen ? <EmployeeModalContent {...resto} /> : null);

export default EmployeeModal;
