const EXCECOES_STYLE = new Map([
  ['pages/Landing/Hero.tsx', new Set(['transform'])],
  ['pages/Auth/Login.tsx', new Set(['backgroundImage'])],
]);

const UTILITARIOS_COM_VALOR_FORA_DOS_TOKENS = /^(?:bg|text|border|outline|ring|from|via|to|fill|stroke|rounded(?:-[a-z]+)?|shadow|font|leading|tracking|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y)-\[/;
const VALOR_VISUAL_LITERAL = /(?:#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(|[-+]?\d+(?:\.\d+)?\s*px\b)/i;
const PACOTES_DE_UI = ['@mui/material', '@chakra-ui/react', '@headlessui/react', 'antd', 'react-bootstrap'];

const classesDaString = (valor) => valor.match(/[^\s]+/g) ?? [];
const partesDeStyle = (atributo) => {
  if (atributo.value?.type !== 'JSXExpressionContainer' || atributo.value.expression.type !== 'ObjectExpression') return [];
  return atributo.value.expression.properties.filter((propriedade) => propriedade.type === 'Property');
};

export const rules = {
  'no-raw-design-values': {
    meta: {
      type: 'problem',
      docs: { description: 'impede valores visuais arbitrários em classes Tailwind' },
      schema: [],
      messages: { raw: 'Use um token semântico do design system em vez deste valor arbitrário: {{className}}.' },
    },
    create(context) {
      const verificar = (node, valor) => {
        for (const token of classesDaString(valor)) {
          const classe = token.split(':').at(-1).replace(/^[!-]+/, '');
          if (UTILITARIOS_COM_VALOR_FORA_DOS_TOKENS.test(classe)) {
            context.report({ node, messageId: 'raw', data: { className: classe } });
          }
        }
      };
      return {
        Literal(node) {
          if (typeof node.value === 'string') verificar(node, node.value);
        },
        TemplateLiteral(node) {
          for (const trecho of node.quasis) verificar(node, trecho.value.raw);
        },
      };
    },
  },

  'no-inline-design-style': {
    meta: {
      type: 'problem',
      docs: { description: 'reserva estilos inline às exceções funcionais aprovadas' },
      schema: [],
      messages: { inline: 'Use tokens e componentes do design system; estilo inline não é permitido para {{property}}.' },
    },
    create(context) {
      const arquivo = context.getFilename().replaceAll('\\', '/');
      const excecao = [...EXCECOES_STYLE].find(([sufixo]) => arquivo.endsWith(`/${sufixo}`))?.[1] ?? new Set();
      return {
        JSXAttribute(node) {
          if (node.name.name !== 'style') return;
          const propriedades = partesDeStyle(node);
          if (propriedades.length === 0) {
            context.report({ node, messageId: 'inline', data: { property: 'style' } });
            return;
          }
          for (const propriedade of propriedades) {
            const nome = propriedade.key.name ?? propriedade.key.value;
            const expressao = propriedade.value;
            const excecaoFuncional = typeof nome === 'string'
              && excecao.has(nome)
              && expressao.type === 'TemplateLiteral'
              && expressao.expressions.length > 0
              && !VALOR_VISUAL_LITERAL.test(context.sourceCode.getText(expressao));
            if (excecaoFuncional) continue;
            context.report({ node: propriedade, messageId: 'inline', data: { property: String(nome) } });
          }
        },
      };
    },
  },

  'ui-boundary-imports': {
    meta: {
      type: 'problem',
      docs: { description: 'mantém componentes de interface independentes das telas de produto' },
      schema: [],
      messages: { boundary: 'components/ui não pode depender de {{source}}; mova o padrão visual para o design system.' },
    },
    create(context) {
      const arquivo = context.getFilename().replaceAll('\\', '/');
      if (!archivoEnDesignSystem(arquivo)) return {};
      return {
        ImportDeclaration(node) {
          const source = node.source.value;
          if (typeof source !== 'string' || !/^\.\.\//.test(source)) return;
          if (/^\.\.\/\.\.\/(?:pages|layouts|components\/(?:Admin|Portal|Auth|Notificacoes))\//.test(source)) {
            context.report({ node, messageId: 'boundary', data: { source } });
          }
        },
      };
    },
  },
};

function archivoEnDesignSystem(archivo) {
  return archivo.includes('/src/components/ui/');
}

export const restrictedUiPackages = PACOTES_DE_UI.flatMap((name) => [name, `${name}/**`]);
