import { Link } from 'react-router-dom';
import LegalPage, { Secao } from './LegalPage';

export default function Termos() {
  return (
    <LegalPage titulo="Termos de Uso" atualizadoEm="2 de outubro de 2026">
      <Secao titulo="1. O que é o HRFlow">
        <p>
          O HRFlow é um sistema web de gestão de recursos humanos que reúne cadastro de colaboradores, estrutura
          de departamentos e cargos, registro de ponto, folha de pagamento e um portal para cada colaborador.
          É um projeto acadêmico de Ciência da Computação, em desenvolvimento: funcionalidades podem mudar,
          ser acrescentadas ou removidas.
        </p>
      </Secao>

      <Secao titulo="2. Conta e perfis de acesso">
        <p>
          A conta de uma empresa é criada por quem a representa e nasce com o perfil Administrador. O Administrador
          e o RH gerenciam colaboradores, estrutura, ponto e folha; o Colaborador acessa apenas os próprios dados.
        </p>
        <ul>
          <li>As informações do cadastro devem ser verdadeiras e mantidas atualizadas.</li>
          <li>A senha é pessoal. Quem a possui responde pelo uso da conta e deve avisar a empresa se suspeitar de acesso indevido.</li>
          <li>A sessão dura 8 horas e é encerrada ao sair, ao trocar a senha ou quando o usuário é inativado ou excluído.</li>
        </ul>
      </Secao>

      <Secao titulo="3. Responsabilidade da empresa pelos dados que cadastra">
        <p>
          A empresa que cria a conta decide quais dados de colaboradores inserir e para quê. Cabe a ela ter base
          legal para tratar esses dados, informar seus colaboradores e atender os pedidos deles. O HRFlow apenas
          armazena e processa as informações a pedido da empresa. Os detalhes estão na{' '}
          <Link to="/privacidade" className="text-indigo-600 font-bold hover:underline">Política de Privacidade</Link>.
        </p>
      </Secao>

      <Secao titulo="4. Uso permitido">
        <ul>
          <li>Não use o sistema para fins ilícitos nem para tratar dados de pessoas sem autorização da empresa.</li>
          <li>Não tente acessar dados de outra empresa ou de outro colaborador, nem burlar os controles de acesso.</li>
          <li>Não sobrecarregue o serviço com requisições automatizadas ou testes de carga sem combinar antes.</li>
        </ul>
      </Secao>

      <Secao titulo="5. Cálculos da folha de pagamento">
        <p>
          A folha calcula o desconto de INSS a partir de uma tabela embutida no sistema. Os valores devem ser
          conferidos pela empresa e por seu contador antes de qualquer uso oficial, como pagamento, recolhimento ou
          declaração. O HRFlow não substitui a assessoria contábil e trabalhista.
        </p>
      </Secao>

      <Secao titulo="6. Disponibilidade e limites de responsabilidade">
        <p>
          O serviço é oferecido no estado em que se encontra, sem garantia de funcionamento ininterrupto nem de
          adequação a uma finalidade específica. Por ser um projeto acadêmico, pode haver indisponibilidades,
          correções e perda de dados. A empresa deve manter cópia das informações de que precisa. Na extensão
          permitida pela lei, os responsáveis pelo projeto não respondem por prejuízos decorrentes do uso ou da
          impossibilidade de uso do sistema.
        </p>
      </Secao>

      <Secao titulo="7. Alterações destes termos">
        <p>
          Estes termos podem ser atualizados. A data da última atualização fica no topo desta página, e o uso
          continuado do sistema depois da mudança indica concordância com a nova versão.
        </p>
      </Secao>

      <Secao titulo="8. Lei aplicável e contato">
        <p>
          Estes termos seguem a legislação brasileira. Dúvidas podem ser abertas no repositório do projeto, cujo
          link está no rodapé desta página; não inclua dados pessoais nem senhas na mensagem.
        </p>
      </Secao>
    </LegalPage>
  );
}
