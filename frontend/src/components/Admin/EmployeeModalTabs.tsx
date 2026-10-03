import React from 'react';
import type { Role, Department } from '../../services/departmentsRolesService';
import type { EmployeeForm } from '../../services/employeeService';
import Field, { Input, Select } from '../ui/Field';

interface TabProps {
  formData: EmployeeForm;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export const PersonalTab: React.FC<TabProps> = ({ formData, handleChange }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Nome Completo" name="nomeCompleto" required>
        <Input data-autofocus type="text" autoComplete="name" value={formData.nomeCompleto} onChange={handleChange} placeholder="João da Silva" />
      </Field>
      <Field label="E-mail Pessoal" name="emailPessoal" required>
        <Input type="email" autoComplete="email" value={formData.emailPessoal} onChange={handleChange} placeholder="joao@email.com" />
      </Field>
    </div>

    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Telefone" name="telefone">
        <Input type="tel" autoComplete="tel" value={formData.telefone} onChange={handleChange} placeholder="(11) 98765-4321" />
      </Field>
      <Field label="CPF" name="cpf">
        <Input type="text" inputMode="numeric" autoComplete="off" value={formData.cpf} onChange={handleChange} placeholder="123.456.789-00" />
      </Field>
    </div>

    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Data de Nascimento" name="dataNascimento">
        <Input type="date" autoComplete="bday" value={formData.dataNascimento} onChange={handleChange} />
      </Field>
      {/* A API só grava a senha no cadastro; depois dele, quem troca a senha é o próprio usuário no perfil. */}
      {!formData.id && (
        <Field label="Senha de Acesso" name="senhaAcesso" required>
          <Input type="password" autoComplete="new-password" value={formData.senhaAcesso} onChange={handleChange} placeholder="········" />
        </Field>
      )}
    </div>

    <Field label="Endereço Completo" name="enderecoCompleto">
      <Input type="text" autoComplete="street-address" value={formData.enderecoCompleto} onChange={handleChange} placeholder="Rua, número, bairro, cidade - UF" />
    </Field>
  </div>
);

interface WorkTabProps extends TabProps {
  cargos?: Role[];
  departamentos?: Department[];
}

export const WorkTab: React.FC<WorkTabProps> = ({ formData, handleChange, cargos = [], departamentos = [] }) => (
  <div className="space-y-5">
    <Field label="Data de Admissão" name="dataAdmissao">
      <Input type="date" autoComplete="off" value={formData.dataAdmissao} onChange={handleChange} />
    </Field>

    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Cargo" name="cargoId">
        <Select autoComplete="off" value={formData.cargoId} onChange={handleChange}>
          <option value="">Selecione o Cargo...</option>
          {formData.cargoId && !cargos.some((c) => c.id === formData.cargoId) && <option value={formData.cargoId}>{formData.cargo}</option>}
          {cargos.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
      </Field>
      <Field label="Nível Hierárquico" name="nivel">
        <Select autoComplete="off" value={formData.nivel} onChange={handleChange}>
          <option value="">Selecione o Nível...</option>
          <option value="Júnior">Júnior</option>
          <option value="Pleno">Pleno</option>
          <option value="Sênior">Sênior</option>
          <option value="Gestão">Gestão</option>
          <option value="Coordenação">Coordenação</option>
        </Select>
      </Field>
    </div>

    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Setor / Departamento" name="departamentoId">
        <Select autoComplete="off" value={formData.departamentoId} onChange={handleChange}>
          <option value="">Selecione o Setor...</option>
          {formData.departamentoId && !departamentos.some((d) => d.id === formData.departamentoId) && <option value={formData.departamentoId}>{formData.departamento}</option>}
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </Field>
      <Field label="Tipo de Contrato" name="tipoContrato">
        <Select autoComplete="off" value={formData.tipoContrato} onChange={handleChange}>
          <option value="CLT">CLT</option>
          <option value="PJ">PJ</option>
          <option value="Estágio">Estágio</option>
          <option value="Temporário">Temporário</option>
        </Select>
      </Field>
    </div>

    <Field label="Salário Base (Bruto)" name="salarioBase">
      <Input type="number" min="0" step="0.01" inputMode="decimal" autoComplete="off" icon={<span className="text-sm font-semibold">R$</span>} value={formData.salarioBase} onChange={handleChange} placeholder="0.00" />
    </Field>
  </div>
);

export const FinancialTab: React.FC<TabProps> = ({ formData, handleChange }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Banco" name="banco">
        <Input type="text" autoComplete="off" value={formData.banco} onChange={handleChange} placeholder="Ex: Banco do Brasil" />
      </Field>
      <Field label="Agência" name="agencia">
        <Input type="text" autoComplete="off" value={formData.agencia} onChange={handleChange} placeholder="1234-5" />
      </Field>
    </div>
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Conta" name="conta">
        <Input type="text" autoComplete="off" value={formData.conta} onChange={handleChange} placeholder="12345-6" />
      </Field>
      <Field label="Tipo de Conta" name="tipoConta">
        <Select autoComplete="off" value={formData.tipoConta} onChange={handleChange}>
          <option value="">Selecione...</option>
          <option value="Corrente">Conta Corrente</option>
          <option value="Poupanca">Conta Poupança</option>
          <option value="Salario">Conta Salário</option>
        </Select>
      </Field>
    </div>
  </div>
);
