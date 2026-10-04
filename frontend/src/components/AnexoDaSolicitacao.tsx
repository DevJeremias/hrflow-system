import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { requestService, type EmployeeRequest } from '../services/requestService';
import { mensagemDeErro } from '../utils/erros';
import { salvarArquivo } from '../utils/solicitacoes';
import Button from './ui/Button';
import { useToast } from './ui/toastContext';

// Baixa o anexo da solicitação pelo serviço (a sessão vai no cookie), em vez de um link que levaria a
// página embora quando a API recusa. Sem anexo, só diz isso.
const AnexoDaSolicitacao: React.FC<{ request: Pick<EmployeeRequest, 'id' | 'type' | 'hasAttachment' | 'attachmentName'> }> = ({ request }) => {
  const toast = useToast();
  const [baixando, setBaixando] = useState(false);

  if (!request.hasAttachment) return <span className="text-ink-muted">Sem anexo</span>;

  const baixar = async () => {
    setBaixando(true);
    try {
      salvarArquivo(await requestService.getAttachment(request.id), request.attachmentName ?? 'anexo');
    } catch (error) {
      toast.error(mensagemDeErro(error, 'Erro ao baixar o anexo.'));
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={baixar} loading={baixando} icon={<Paperclip size={16} aria-hidden="true" />} className="max-w-full lg:max-w-[14rem]">
      <span className="truncate">{request.attachmentName ?? 'Baixar anexo'}</span>
      <span className="sr-only"> (baixar anexo da solicitação de {request.type})</span>
    </Button>
  );
};

export default AnexoDaSolicitacao;
