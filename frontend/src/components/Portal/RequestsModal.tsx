import React, { useId, useState } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { RequestType } from '../../services/requestService';
import Button from '../ui/Button';
import Field, { Input, Select, Textarea } from '../ui/Field';
import Modal from '../ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { type: RequestType; startDate: string; endDate: string; observation: string; hasAttachment: boolean }) => Promise<void>;
}

const TIPOS: RequestType[] = ['Férias', 'Licença Médica', 'Licença Maternidade', 'Licença Paternidade', 'Acidente de Trabalho', 'Outros'];

const RequestsModal: React.FC<Props> = ({ isOpen, onClose, onSubmit }) => {
  const [type, setType] = useState<RequestType>('Licença Médica');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [observation, setObservation] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idArquivo = useId().replace(/:/g, '');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ type, startDate, endDate, observation, hasAttachment: !!fileName });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Nova Solicitação"
      description="Preencha os dados para enviar ao RH"
      onClose={onClose}
      form={{ onSubmit: handleSubmit }}
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
          <span>Para licenças médicas ou acidentes de trabalho, o anexo do atestado ou boletim é <strong>obrigatório</strong> para a aprovação.</span>
        </p>

        <Field label="Tipo de Solicitação" name="type" required>
          <Select data-autofocus value={type} onChange={(e) => setType(e.target.value as RequestType)}>
            {TIPOS.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Data de Início" name="startDate" required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="cursor-pointer" />
          </Field>
          <Field label="Data de Término" name="endDate" required>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="cursor-pointer" />
          </Field>
        </div>

        <Field label="Observações / Motivo" name="observation" required>
          <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Descreva brevemente o motivo da sua solicitação..." rows={4} />
        </Field>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-ink">Anexar Documento (Opcional)</span>
          {/* O campo de arquivo fica fora da tela, mas focável: o rótulo é a área de soltar e mostra o foco do campo. */}
          <input id={idArquivo} name="anexo" type="file" accept=".pdf,.jpg,.jpeg,.png" className="peer sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
          <label htmlFor={idArquivo} className="group flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-line-input bg-surface-muted text-center transition-colors hover:bg-surface-sunken peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
            <UploadCloud aria-hidden="true" className="mb-3 h-8 w-8 text-ink-muted group-hover:text-brand" />
            {fileName ? (
              <span className="text-sm font-semibold text-brand">{fileName}</span>
            ) : (
              <>
                <span className="mb-1 text-sm font-semibold text-ink"><span className="text-brand">Clique para anexar</span> ou arraste o arquivo</span>
                <span className="text-xs text-ink-muted">PDF, JPG ou PNG (Max. 5MB)</span>
              </>
            )}
          </label>
        </div>
      </div>
    </Modal>
  );
};

export default RequestsModal;
