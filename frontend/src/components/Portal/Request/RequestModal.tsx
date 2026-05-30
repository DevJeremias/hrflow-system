import React, { useState } from 'react';
import { X, UploadCloud, AlertCircle } from 'lucide-react';
import { RequestType } from '../../../services/requestService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { type: RequestType; startDate: string; endDate: string; observation: string; hasAttachment: boolean }) => Promise<void>;
}

const RequestModal: React.FC<Props> = ({ isOpen, onClose, onSubmit }) => {
  const [type, setType] = useState<RequestType>('Licença Médica');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [observation, setObservation] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit({ type, startDate, endDate, observation, hasAttachment: !!fileName });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-20">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Nova Solicitação</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Preencha os dados para enviar ao RH</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar space-y-6">
          
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
            <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
            <p className="text-sm font-medium text-blue-800">
              Para licenças médicas ou acidentes de trabalho, o anexo do atestado ou boletim é <strong>obrigatório</strong> para a aprovação.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tipo de Solicitação</label>
            <select value={type} onChange={(e) => setType(e.target.value as RequestType)} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer">
              <option value="Férias">Férias</option>
              <option value="Licença Médica">Licença Médica</option>
              <option value="Licença Maternidade">Licença Maternidade</option>
              <option value="Licença Paternidade">Licença Paternidade</option>
              <option value="Acidente de Trabalho">Acidente de Trabalho</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Data de Início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-700 outline-none focus:border-primary transition-all cursor-pointer" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Data de Término</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-700 outline-none focus:border-primary transition-all cursor-pointer" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Observações / Motivo</label>
            <textarea value={observation} onChange={(e) => setObservation(e.target.value)} required placeholder="Descreva brevemente o motivo da sua solicitação..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-700 outline-none focus:border-primary transition-all resize-none h-28" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Anexar Documento (Opcional)</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-8 h-8 mb-3 text-slate-400 group-hover:text-primary transition-colors" />
                {fileName ? (
                  <p className="text-sm font-bold text-primary">{fileName}</p>
                ) : (
                  <>
                    <p className="mb-1 text-sm font-semibold text-slate-600"><span className="text-primary">Clique para anexar</span> ou arraste o arquivo</p>
                    <p className="text-xs font-medium text-slate-400">PDF, JPG ou PNG (Max. 5MB)</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} accept=".pdf,.jpg,.jpeg,.png" />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-4 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="px-6 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 bg-slate-900 hover:bg-primary text-white text-sm font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestModal;