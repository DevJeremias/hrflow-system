import React from 'react';
import type { HeadcountRow } from '../../services/relatoriosService';
import { nomeCurtoDoMes, rotuloDaCompetencia } from '../../utils/competencia';

interface Props {
  linhas: readonly HeadcountRow[];
  titulo: string;
}

const LARGURA = 720;
const ALTURA = 260;
const EIXO = { esquerda: 44, direita: 12, topo: 14, base: 40 };
const DOMINIO_PONTO = { minimo: 215, maximo: 250, marcas: [215, 225, 235, 250] };

const passoAproximado = (valores: readonly number[]) => {
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const intervalo = Math.max(maximo - minimo, Math.abs(maximo) * 0.08, 1);
  const passoBruto = intervalo / 4;
  const magnitude = 10 ** Math.floor(Math.log10(passoBruto));
  const escala = passoBruto / magnitude;
  const fator = escala <= 1 ? 1 : escala <= 2 ? 2 : escala <= 5 ? 5 : 10;
  return Math.max(fator * magnitude, 1);
};

const dominioDoGrafico = (valores: readonly number[]) => {
  if (valores.length === 0) return DOMINIO_PONTO;
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  if (minimo >= DOMINIO_PONTO.minimo && maximo <= DOMINIO_PONTO.maximo) return DOMINIO_PONTO;

  const passo = passoAproximado(valores);
  const limiteInferior = Math.floor((minimo - passo * 0.35) / passo) * passo;
  const limiteSuperior = Math.ceil((maximo + passo * 0.35) / passo) * passo;
  const marcas = Array.from(
    { length: Math.round((limiteSuperior - limiteInferior) / passo) + 1 },
    (_, indice) => limiteInferior + indice * passo,
  );
  return { minimo: limiteInferior, maximo: limiteSuperior, marcas };
};

const GraficoDeHeadcount: React.FC<Props> = ({ linhas, titulo }) => {
  const dominio = dominioDoGrafico(linhas.map((linha) => linha.ativos));
  const larguraUtil = LARGURA - EIXO.esquerda - EIXO.direita;
  const alturaUtil = ALTURA - EIXO.topo - EIXO.base;
  const x = (indice: number) => EIXO.esquerda + larguraUtil * indice / Math.max(linhas.length - 1, 1);
  const y = (valor: number) => EIXO.topo + alturaUtil * (1 - (valor - dominio.minimo) / (dominio.maximo - dominio.minimo));
  const caminho = linhas.map((linha, indice) => `${indice === 0 ? 'M' : 'L'} ${x(indice)} ${y(linha.ativos)}`).join(' ');

  return (
    <figure aria-label={titulo} className="m-0">
      <div className="overflow-x-auto">
        <svg aria-hidden="true" className="h-auto min-w-chart w-full font-mono text-xs" viewBox={`0 0 ${LARGURA} ${ALTURA}`}>
          {dominio.marcas.map((marca) => (
            <g key={marca}>
              <line x1={EIXO.esquerda} x2={LARGURA - EIXO.direita} y1={y(marca)} y2={y(marca)} className="stroke-line" strokeDasharray="2 4" />
              <text x={EIXO.esquerda - 8} y={y(marca)} textAnchor="end" dominantBaseline="middle" className="fill-ink-subtle">{marca}</text>
            </g>
          ))}
          <line x1={EIXO.esquerda} x2={LARGURA - EIXO.direita} y1={y(dominio.minimo)} y2={y(dominio.minimo)} className="stroke-line-strong" />
          {caminho && <path d={caminho} fill="none" className="stroke-brand-fill" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {linhas.map((linha, indice) => (
            <g key={linha.mes}>
              <circle cx={x(indice)} cy={y(linha.ativos)} r={indice === linhas.length - 1 ? 5 : 3} className={indice === linhas.length - 1 ? 'fill-brand-fill stroke-surface' : 'fill-brand-fill'} strokeWidth="2" />
              <text x={x(indice)} y={ALTURA - 19} textAnchor="middle" className={indice === linhas.length - 1 ? 'fill-brand' : 'fill-ink-subtle'}>{nomeCurtoDoMes(linha.mes)}</text>
              {(indice === 0 || linha.mes.endsWith('-01')) && (
                <text x={x(indice)} y={ALTURA - 4} textAnchor="middle" className="fill-ink-subtle">{linha.mes.slice(0, 4)}</text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <table className="sr-only">
        <caption>{titulo}. Tendência mensal em eixo vertical ajustado de {dominio.minimo} a {dominio.maximo} colaboradores.</caption>
        <thead><tr><th scope="col">Mês</th><th scope="col">Ativos</th><th scope="col">Admitidos</th><th scope="col">Desligados</th></tr></thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.mes}><th scope="row">{rotuloDaCompetencia(linha.mes)}</th><td>{linha.ativos}</td><td>{linha.admitidos}</td><td>{linha.desligados}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export default GraficoDeHeadcount;
