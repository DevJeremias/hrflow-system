import React, { useId, useState } from 'react';
import { UploadCloud, AlertCircle, X } from 'lucide-react';
import { NewRequest, RequestType, VacationBalance } from '../../services/requestService';
import { ANEXO_OBRIGATORIO, TIPOS_DE_SOLICITACAO, rotuloDosDias, validarArquivo, validarPeriodo, type ErrosDoPeriodo } from '../../utils/solicitacoes';
import { hojeNoFuso } from '../../utils/ponto';
import { useFusoDaEmpresa } from '../../hooks/useFusoDaEmpresa';
import Button, { IconButton } from '../ui/Button';
import Field, { Input, Select, Textarea } from '../ui/Field';
import Modal from '../ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewRequest) => Promise<void>;
  // O saldo de férias do colaborador, para avisar quantos dias ele pode pedir.
  balance?: VacationBalance;
}

interface Erros extends ErrosDoPeriodo {
  observation?: string;
  attachment?: string;
}

const RequestsModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, balance }) => {
  const [type, setType] = useState<RequestType>('Férias');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [observation, setObservation] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [errors, setErrors] = useState<Erros>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idArquivo = useId().replace(/:/g, '');
  const fuso = useFusoDaEmpresa();

  if (!isOpen) return null;

  const anexoObrigatorio = ANEXO_OBRIGATORIO.includes(type);
  const hoje = hojeNoFuso(fuso);

  const escolherArquivo = (arquivo: File | undefined) => {
    setAttachment(arquivo ?? null);
    setErrors((atuais) => ({ ...atuais, attachment: arquivo ? validarArquivo(arquivo) ?? undefined : undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const encontrados: Erros = { ...validarPeriodo(type, startDate, endDate, hoje) };
    if (!observation.trim()) encontrados.observation = 'Descreva o motivo da solicitação.';
    if (attachment) {
      const erroDoArquivo = validarArquivo(attachment);
      if (erroDoArquivo) encontrados.attachment = erroDoArquivo;
    } else if (anexoObrigatorio) {
      encontrados.attachment = type === 'Licença Médica' ? 'Anexe o atestado médico.' : 'Anexe o boletim de ocorrência ou o comunicado do acidente.';
    }
    setErrors(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ type, startDate, endDate, observation, attachment });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Nova Solicitação"
      description="Preencha os dados para enviar ao RH"
      onClose={onClose}
      form={{ onSubmit: handleSubmit, noValidate: true }}
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>{isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}</Button>
        </div>
      )}
    >
      <div className="space-y-6">
        <p className="flex gap-3 rounded-card border border-info-line bg-info-soft p-4 text-sm font-medium text-info">
          <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>Para licenças médicas ou acidentes de trabalho, o anexo do atestado ou boletim é <strong>obrigatório</strong>. Para férias, cada período tem de 5 a 30 dias.</span>
        </p>

        <Field
          label="Tipo de Solicitação"
          name="type"
          required
          hint={type === 'Férias' && balance && balance.admissao !== null ? `Saldo de férias: ${rotuloDosDias(balance.saldo)} disponíveis.` : undefined}
        >
          <Select data-autofocus value={type} onChange={(e) => { setType(e.target.value as RequestType); setErrors({}); }}>
            {TIPOS_DE_SOLICITACAO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Data de Início" name="startDate" required error={errors.inicio}>
            <Input type="date" min={type === 'Férias' ? hoje : undefined} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="cursor-pointer" />
          </Field>
          <Field label="Data de Término" name="endDate" required error={errors.fim}>
            <Input type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="cursor-pointer" />
          </Field>
        </div>

        <Field label="Observações / Motivo" name="observation" required error={errors.observation}>
          <Textarea value={observation} maxLength={1000} onChange={(e) => setObservation(e.target.value)} placeholder="Descreva brevemente o motivo da sua solicitação..." rows={4} />
        </Field>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-ink">
            Anexar Documento {anexoObrigatorio ? <span aria-hidden="true" className="ml-0.5 text-danger">*</span> : <span className="font-normal text-ink-muted">(Opcional)</span>}
          </span>
          {/* O campo de arquivo fica fora da tela, mas focável: o rótulo é a área de soltar e mostra o foco do campo. */}
          <input
            id={idArquivo}
            name="anexo"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            aria-invalid={errors.attachment ? true : undefined}
            aria-describedby={errors.attachment ? `${idArquivo}-erro` : undefined}
            className="peer sr-only"
            // O valor é limpo para escolher de novo o mesmo arquivo depois de remover ou corrigir.
            onChange={(e) => { escolherArquivo(e.target.files?.[0]); e.target.value = ''; }}
          />
          <label htmlFor={idArquivo} className="group flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-line-input bg-surface-muted text-center transition-colors hover:bg-surface-sunken peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-aria-[invalid=true]:border-danger">
            <UploadCloud aria-hidden="true" className="mb-3 h-8 w-8 text-ink-muted group-hover:text-brand" />
            {attachment ? (
              <span className="max-w-full truncate px-4 text-sm font-semibold text-brand">{attachment.name}</span>
            ) : (
              <>
                <span className="mb-1 text-sm font-semibold text-ink"><span className="text-brand">Clique para anexar</span> ou arraste o arquivo</span>
                <span className="text-xs text-ink-muted">PDF, JPG ou PNG (Max. 5MB)</span>
              </>
            )}
          </label>
          {attachment && (
            <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
              <span>{(attachment.size / 1024 / 1024).toFixed(2).replace('.', ',')} MB</span>
              <IconButton label="Remover anexo" size="sm" onClick={() => escolherArquivo(undefined)}><X size={16} aria-hidden="true" /></IconButton>
            </div>
          )}
          {errors.attachment && <p id={`${idArquivo}-erro`} className="text-xs font-semibold text-danger">{errors.attachment}</p>}
        </div>
      </div>
    </Modal>
  );
};

export default RequestsModal;
