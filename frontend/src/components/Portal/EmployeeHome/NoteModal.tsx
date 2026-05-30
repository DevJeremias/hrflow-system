import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface Props {
  dateRef: string;
  noteText: string;
  setNoteText: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const NoteModal: React.FC<Props> = ({ dateRef, noteText, setNoteText, onClose, onSave }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 p-8 animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-900">Adicionar Justificativa</h3>
          <p className="text-sm font-bold text-slate-500 mt-1">Ref: {dateRef}</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs font-bold text-amber-800 flex gap-2">
            <AlertCircle size={16} className="shrink-0" />
            Sua justificativa será enviada para o RH e estará sujeita a aprovação do seu gestor.
          </p>
        </div>
        <textarea 
          value={noteText} onChange={(e) => setNoteText(e.target.value)}
          placeholder="Ex: Fui ao médico e tenho atestado..."
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-primary resize-none h-32 text-sm font-medium text-slate-700"
        />
        <button onClick={onSave} className="w-full py-4 bg-slate-900 hover:bg-primary text-white font-black rounded-2xl shadow-xl transition-all active:scale-95">
          Salvar Anotação
        </button>
      </div>
    </div>
  </div>
);

export default NoteModal;