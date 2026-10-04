import { Link } from 'react-router-dom';
import LegalPage, { Secao } from './LegalPage';

export default function Privacidade() {
  return (
    <LegalPage titulo="Política de Privacidade" atualizadoEm="3 de outubro de 2026">
      <Secao titulo="1. Quem é quem">
        <p>
          Na Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018), a empresa que cria a conta no HRFlow é a
          controladora dos dados de seus colaboradores: ela decide quais dados cadastrar e para quê. O HRFlow atua
          como operador, armazenando e processando esses dados por conta da empresa. Os dados da própria conta
          (nome, e-mail e senha de quem a criou) são tratados para permitir o acesso ao sistema.
        </p>
      </Secao>

      <Secao titulo="2. Quais dados são tratados">
        <ul>
          <li><strong>Conta de acesso:</strong> nome, e-mail, perfil de acesso, nome da empresa e a senha, que é guardada apenas como hash.</li>
          <li>
            <strong>Cadastro de colaboradores:</strong> nome, CPF, e-mail, telefone, data de nascimento, data de admissão,
            endereço, dados bancários (banco, agência, conta e tipo de conta), cargo, departamento, nível, tipo de contrato,
            salário base, situação e foto de perfil, quando enviada.
          </li>
          <li><strong>Folha de pagamento:</strong> valores calculados a partir do salário, como o desconto de INSS e o salário líquido de cada colaborador.</li>
          <li>
            <strong>Ponto:</strong> tipo da marcação (entrada, almoço ou saída), data e hora, observação e, quando o navegador
            do colaborador autoriza, a localização (latitude e longitude) no momento do registro.
          </li>
          <li><strong>Pedidos de alteração:</strong> o que o colaborador pede para mudar no próprio cadastro (nome, e-mail, endereço e dados bancários) e a decisão do RH.</li>
          <li>
            <strong>Histórico contratual:</strong> salário, cargo e departamento de cada período do vínculo.
          </li>
          <li>
            <strong>Trilha de auditoria:</strong> quem alterou o quê, quando e de qual endereço IP, com os valores de antes e de depois. Inclui
            as tentativas de entrada no sistema, com sucesso ou não.
          </li>
        </ul>
      </Secao>

      <Secao titulo="3. Para que usamos">
        <p>
          Apenas para prestar as funções do sistema: autenticar usuários, manter o cadastro, registrar o ponto,
          processar a folha e exibir holerites e solicitações. Os dados não são usados para publicidade, nem
          vendidos ou cedidos a terceiros para fins comerciais.
        </p>
      </Secao>

      <Secao titulo="4. Cookies">
        <p>
          O HRFlow usa dois cookies, ambos estritamente necessários ao funcionamento do login e sem finalidade de
          rastreamento: <code>hrflow_sessao</code>, que mantém a sessão e que o JavaScript da página não consegue ler,
          e <code>hrflow_csrf</code>, que protege as requisições que alteram dados. Não há ferramentas de análise
          de audiência nem de publicidade nesta aplicação.
        </p>
      </Secao>

      <Secao titulo="5. Quem acessa os dados">
        <p>
          Dentro de cada empresa, Administrador e RH acessam o cadastro e a folha; o colaborador acessa apenas os
          próprios dados. Uma empresa não enxerga os dados de outra. Os responsáveis técnicos pelo projeto podem
          acessar o banco de dados para operar e dar manutenção ao sistema.
        </p>
      </Secao>

      <Secao titulo="6. Segurança e limites atuais">
        <p>
          Adotamos senhas com hash, sessão em cookie protegido, proteção contra CSRF, limite de tentativas de login,
          trilha de auditoria e separação de dados por empresa. A foto de perfil fica guardada à parte do cadastro e não
          trafega nas listas. O banco de dados não cifra os dados coluna a coluna. O projeto é acadêmico e não declara
          certificação de segurança.
        </p>
      </Secao>

      <Secao titulo="7. Direitos do titular">
        <p>
          A LGPD garante ao titular, entre outros direitos, a confirmação do tratamento, o acesso, a correção, a
          anonimização, a portabilidade e a eliminação de seus dados, além de informações sobre o uso e o
          compartilhamento. Dentro do sistema:
        </p>
        <ul>
          <li><strong>Correção:</strong> o colaborador pede a alteração de nome, e-mail, endereço e dados bancários em Meu Perfil e o RH aprova; telefone e foto ele muda na hora.</li>
          <li><strong>Acesso e portabilidade:</strong> a empresa exporta, em JSON, tudo o que o sistema guarda do colaborador.</li>
          <li><strong>Anonimização:</strong> a empresa anonimiza o cadastro de quem deixou de trabalhar nela. CPF, nome, e-mail, telefone, endereço, dados bancários, foto e localização das marcações são apagados; as marcações de ponto e os valores da folha ficam, sem identificar a pessoa.</li>
        </ul>
        <p>
          Se você é colaborador, faça o pedido à sua empresa, que é a controladora: ao RH ou ao encarregado que ela indicou,
          cujo contato aparece em Meu Perfil, na aba Privacidade.
        </p>
      </Secao>

      <Secao titulo="8. Encarregado e contato">
        <p>
          Cada empresa indica o seu encarregado pelo tratamento de dados na tela Dados da Empresa. Para assuntos
          sobre esta política ou sobre o sistema, abra um chamado no repositório do projeto, cujo link está no rodapé desta
          página, sem incluir dados pessoais na mensagem.
        </p>
      </Secao>

      <Secao titulo="9. Quanto tempo guardamos">
        <p>
          Enquanto o vínculo existir, os dados ficam no sistema. Depois do desligamento, a empresa os mantém pelo prazo que
          a lei exige para folha e ponto e, vencido o prazo ou a pedido do titular quando não houver obrigação de guarda,
          anonimiza o cadastro. A exclusão não é automática: é uma ação da empresa. A política de retenção que o projeto
          propõe está em <code>docs/lgpd.md</code>, no repositório.
        </p>
      </Secao>

      <Secao titulo="10. Alterações">
        <p>
          Esta política pode ser atualizada; a data da última atualização fica no topo da página. O uso do sistema
          está sujeito também aos <Link to="/termos" className="font-bold text-brand underline underline-offset-2 hover:text-brand-hover">Termos de Uso</Link>.
        </p>
      </Secao>
    </LegalPage>
  );
}
