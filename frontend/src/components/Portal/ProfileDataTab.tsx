import React, { useState, useRef } from 'react';
import { Mail, Phone, Building2, Lock, User as UserIcon, Camera, X, Save } from 'lucide-react';
import httpClient from '../../services/httpClient';

interface Props {
  perfil: any;
  onUpdate: (novosDados: any) => void;
  getToken: () => string | null;
}

const ProfileDataTab: React.FC<Props> = ({ perfil, onUpdate, getToken }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ 
  nome: perfil?.nome || '', 
  email: perfil?.email || '', 
  telefone: perfil?.telefone || '', 
  avatar: perfil?.avatar || '' 
  });
  const [status, setStatus] = useState({ loading: false, erro: '', sucesso: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Imagem máxima de 2MB.");
      const reader = new FileReader();
      reader.onloadend = () => setEditForm(prev => ({ ...prev, avatar: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSalvar = async () => {
    setStatus({ loading: true, erro: '', sucesso: '' });
    try {
      await httpClient('/perfil/meus-dados', {
        method: 'PUT',
        auth: true,
        body: JSON.stringify(editForm),
        errorMessage: 'Erro ao atualizar dados'
      });
      setStatus({ loading: false, erro: '', sucesso: 'Dados atualizados!' });
      setIsEditing(false);
      onUpdate(editForm);
      setTimeout(() => setStatus({ loading: false, erro: '', sucesso: '' }), 3000);
    } catch (error: any) {
      setStatus({ loading: false, erro: error.message, sucesso: '' });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-slate-900">Informações Pessoais</h2>
        {!isEditing && <button onClick={() => setIsEditing(true)} className="text-sm font-bold text-primary hover:underline">Editar Dados</button>}
      </div>

      {status.erro && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">{status.erro}</div>}
      {status.sucesso && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-sm font-bold">{status.sucesso}</div>}

      <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-3xl font-black overflow-hidden">
            {editForm.avatar ? <img src={editForm.avatar} alt="Avatar" className="w-full h-full object-cover" /> : perfil?.nome.charAt(0)}
          </div>
          {isEditing && (
            <>
              <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full"><Camera size={14} /></button>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
            </>
          )}
        </div>
        <div className="flex-1">
          {isEditing ? <input type="text" value={editForm.nome} onChange={e => setEditForm({...editForm, nome: e.target.value})} className="w-full max-w-sm p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xl" /> : <h2 className="text-2xl font-black text-slate-900">{perfil?.nome}</h2>}
          <p className="text-slate-500 font-medium">{perfil?.cargo}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><Mail size={14} className="inline mr-2"/> E-mail</label>
          {isEditing ? <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" /> : <div className="p-4 bg-slate-50 rounded-2xl font-bold">{perfil?.email}</div>}
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><Phone size={14} className="inline mr-2"/> Telefone</label>
          {isEditing ? <input type="text" value={editForm.telefone} onChange={e => setEditForm({...editForm, telefone: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" /> : <div className="p-4 bg-slate-50 rounded-2xl font-bold">{perfil?.telefone || '-'}</div>}
        </div>
      </div>

      {isEditing && (
        <div className="flex gap-4 pt-6">
          <button onClick={() => setIsEditing(false)} className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-100 rounded-xl"><X size={18} className="inline mr-2" /> Cancelar</button>
          <button onClick={handleSalvar} disabled={status.loading} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl shadow-xl"><Save size={18} className="inline mr-2" /> Guardar</button>
        </div>
      )}
    </div>
  );
};

export default ProfileDataTab;