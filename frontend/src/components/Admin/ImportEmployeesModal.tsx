import React, { useRef, useState } from 'react';
import { CheckCircle2, Download, FileUp } from 'lucide-react';
import type { RelatorioDeImportacaoApi } from '../../types/api';
import { useImportarColaboradores } from '../../queries/funcionarios';
import ErrorAlert from '../ErrorAlert';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input } from '../ui/Field';
import { mensagemDeErro } from '../../utils/erros';

// O modelo traz as colunas obrigatórias e as mais comuns; a API aceita também as de documentos, endereço e contato.
const COLUNAS_DO_MODELO = 'nome,email,cpf,telefone,data_nascimento,data_admissao,departamento,cargo,tipo_contrato,salario_base,matricula';
const LINHA_DO_MODELO = 'Maria da Silva,maria@empresa.com.br,529.982.247-25,(91) 98888-7777,15/03/1990,01/02/2024,Tecnologia da Informação (TI),Desenvolvedor(a),CLT,"3.500,00",MAT-0001';

const MAXIMO_DO_ARQUIVO_BYTES = 2 * 1024 * 1024;

// Campo de planilha com vírgula, aspas ou quebra de linha precisa de aspas.
const campoCsv = (valor: string) => (/[",\n\r;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor);

// Entrega um arquivo gerado no navegador: nada passa por servidor nem fica em cache da rede.
const baixar = (nome: string, conteudo: string) => {
  const url = URL.createObjectURL(new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
};

interface Props {
  onClose: () => void;
}

const ImportEmployeesModal: React.FC<Props> = ({ onClose }) => {
  const importar = useImportarColaboradores();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioDeImportacaoApi | null>(null);
  const enviando = useRef(false);

  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const escolhido = e.target.files?.[0] ?? null;
    setErro(escolhido && escolhido.size > MAXIMO_DO_ARQUIVO_BYTES ? 'O arquivo passa de 2 MB. Divida a planilha em mais de um arquivo.' : null);
    setArquivo(escolhido && escolhido.size <= MAXIMO_DO_ARQUIVO_BYTES ? escolhido : null);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando.current) return;
    if (!arquivo) return setErro('Escolha o arquivo CSV da planilha.');
    enviando.current = true;
    setErro(null);
    try {
      setRelatorio(await importar.mutateAsync(await arquivo.text()));
    } catch (falha) {
      setErro(mensagemDeErro(falha, 'Não foi possível importar a planilha. Tente novamente.'));
    } finally {
      enviando.current = false;
    }
  };

  const baixarCredenciais = () => {
    if (!relatorio) return;
    const linhas = relatorio.credenciais.map((c) => [c.nome, c.email, c.senha_provisoria].map(campoCsv).join(','));
    baixar('senhas-provisorias.csv', ['nome,email,senha_provisoria', ...linhas].join('\r\n'));
  };

  return (
    <Modal
      title="Importar colaboradores"
      description="Cadastre vários colaboradores de uma vez com uma planilha CSV."
      onClose={onClose}
      form={relatorio ? undefined : { onSubmit: enviar }}
      footer={relatorio ? (
        <div className="flex justify-end"><Button onClick={onClose}>Concluir</Button></div>
      ) : (
        <div className="space-y-4">
          {erro && <ErrorAlert message={erro} />}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={importar.isPending}>Cancelar</Button>
            <Button type="submit" loading={importar.isPending} icon={<FileUp size={18} aria-hidden="true" />}>
              {importar.isPending ? 'Importando...' : 'Importar planilha'}
            </Button>
          </div>
        </div>
      )}
    >
      {relatorio ? (
        <div className="space-y-6">
          <div role="status" className="flex items-start gap-3 rounded-card border border-success-line bg-success-soft p-4 text-success">
            <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p className="font-semibold">
              {relatorio.criados} de {relatorio.total} colaboradores importados.
              {relatorio.erros.length > 0 && ` ${relatorio.erros.length} ${relatorio.erros.length === 1 ? 'linha ficou' : 'linhas ficaram'} de fora.`}
            </p>
          </div>

          {relatorio.credenciais.length > 0 && (
            <div className="space-y-3 rounded-card border border-warning-line bg-warning-soft p-4">
              <p className="text-sm text-ink">
                Cada colaborador importado recebeu uma senha provisória, que ele troca no primeiro acesso. Elas não aparecem de novo depois que você fechar esta janela:
                baixe a lista e entregue a cada pessoa.
              </p>
              <Button variant="secondary" icon={<Download size={18} aria-hidden="true" />} onClick={baixarCredenciais}>
                Baixar senhas provisórias
              </Button>
            </div>
          )}

          {relatorio.erros.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-ink">Linhas que não foram importadas</p>
              <p className="text-sm text-ink-muted">Corrija essas linhas na planilha e importe só elas: as demais já estão cadastradas.</p>
              <div className="max-h-72 overflow-y-auto rounded-card border border-line">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Linhas recusadas e o motivo</caption>
                  <thead className="sticky top-0 bg-surface-muted text-xs uppercase text-ink-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2">Linha</th>
                      <th scope="col" className="px-3 py-2">Colaborador</th>
                      <th scope="col" className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {relatorio.erros.map((item) => (
                      <tr key={item.linha}>
                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{item.linha}</td>
                        <td className="px-3 py-2 text-ink">{item.nome ?? '—'}</td>
                        <td className="px-3 py-2 text-danger">{item.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2 text-sm text-ink-muted">
            <p>A primeira linha do arquivo traz os nomes das colunas. Só <strong className="text-ink">nome</strong> e <strong className="text-ink">email</strong> são obrigatórios.</p>
            <p>
              Departamento e cargo vão pelo nome. Datas em dd/mm/aaaa ou aaaa-mm-dd, salário como 3.500,00 ou 3500.00.
              Aceita vírgula ou ponto e vírgula como separador, em UTF-8 (no Excel: Salvar como, CSV UTF-8).
            </p>
            <p>Linhas inválidas não impedem as demais: elas voltam com o motivo. Máximo de 500 linhas por arquivo.</p>
            <Button
              variant="link"
              icon={<Download size={16} aria-hidden="true" />}
              onClick={() => baixar('modelo-colaboradores.csv', `${COLUNAS_DO_MODELO}\r\n${LINHA_DO_MODELO}\r\n`)}
            >
              Baixar planilha modelo
            </Button>
          </div>
          <Field label="Arquivo CSV" name="arquivoCsv" required>
            <Input data-autofocus type="file" accept=".csv,text/csv" onChange={escolher} />
          </Field>
        </div>
      )}
    </Modal>
  );
};

export default ImportEmployeesModal;
