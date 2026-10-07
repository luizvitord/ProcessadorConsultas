import { useId } from 'react';
import { filhos, formatarCondicao, formatarProjecao, SIMBOLOS } from '../core/algebra.js';

/**
 * HU3 / HU4 — desenho do grafo de operadores em SVG.
 *
 *   folhas            = tabelas
 *   nós intermediários = operadores (σ, ⋈, ×, π)
 *   raiz              = projeção final (π)
 *   arestas (setas)   = fluxo dos resultados intermediários, de baixo para cima
 *
 * O componente só desenha a árvore que recebe; quem decide se ela é a
 * original (HU3) ou a otimizada (HU4) é o chamador.
 */

const LARGURA_CARACTERE = 7.9; // fonte monoespaçada de 13px
const ALTURA_LINHA = 17;
const ALTURA_SIMBOLO = 24;
const PADDING_X = 12;
const PADDING_Y = 8;
const ESPACO_HORIZONTAL = 28;
const ESPACO_VERTICAL = 40;
const MARGEM = 16;
const MAX_CARACTERES = 34;

/** Quebra o parâmetro do operador em linhas, sem cortar no meio de um termo. */
function quebrar(texto, separador) {
  const linhas = [];
  let atual = '';
  for (const parte of texto.split(separador)) {
    const candidata = atual ? atual + separador + parte : parte;
    if (atual && candidata.length > MAX_CARACTERES) {
      linhas.push(atual + separador.trimEnd());
      atual = parte;
    } else {
      atual = candidata;
    }
  }
  linhas.push(atual);
  return linhas;
}

function rotulo(no) {
  switch (no.tipo) {
    case 'relacao':
      return { simbolo: null, linhas: [no.tabela] };
    case 'selecao':
    case 'juncao':
      return { simbolo: SIMBOLOS[no.tipo], linhas: quebrar(formatarCondicao(no.condicao), ' ∧ ') };
    case 'projecao':
      return { simbolo: SIMBOLOS.projecao, linhas: quebrar(formatarProjecao(no), ', ') };
    case 'produto':
      return { simbolo: SIMBOLOS.produto, linhas: [] };
  }
}

function medirCaixa(no) {
  const { simbolo, linhas } = rotulo(no);
  const maiorLinha = Math.max(1, ...linhas.map((l) => l.length));
  return {
    simbolo,
    linhas,
    largura: maiorLinha * LARGURA_CARACTERE + 2 * PADDING_X,
    altura: (simbolo ? ALTURA_SIMBOLO : 0) + linhas.length * ALTURA_LINHA + 2 * PADDING_Y,
  };
}

/**
 * Layout em árvore: cada subárvore ocupa uma faixa horizontal tão larga quanto
 * a soma das faixas dos filhos (ou o próprio nó, se for mais largo), e o nó
 * fica centralizado sobre os filhos. A raiz fica no topo.
 */
function calcularLayout(raiz) {
  const caixas = new Map();
  const larguras = new Map();

  const larguraDosFilhos = (no) =>
    filhos(no).reduce((soma, f) => soma + larguras.get(f), 0) +
    ESPACO_HORIZONTAL * Math.max(0, filhos(no).length - 1);

  function medir(no) {
    caixas.set(no, medirCaixa(no));
    filhos(no).forEach(medir);
    larguras.set(no, Math.max(caixas.get(no).largura, larguraDosFilhos(no)));
  }

  const nos = [];
  const arestas = [];

  function posicionar(no, x0, y) {
    const caixa = caixas.get(no);
    const centro = x0 + larguras.get(no) / 2;
    const item = { no, ...caixa, x: centro - caixa.largura / 2, y, centro, id: nos.length };
    nos.push(item);

    let x = x0 + (larguras.get(no) - larguraDosFilhos(no)) / 2;
    for (const filho of filhos(no)) {
      const itemFilho = posicionar(filho, x, y + caixa.altura + ESPACO_VERTICAL);
      arestas.push({ de: itemFilho, para: item });
      x += larguras.get(filho) + ESPACO_HORIZONTAL;
    }
    return item;
  }

  medir(raiz);
  posicionar(raiz, MARGEM, MARGEM);

  return {
    nos,
    arestas,
    largura: larguras.get(raiz) + 2 * MARGEM,
    altura: Math.max(...nos.map((n) => n.y + n.altura)) + MARGEM,
  };
}

export default function GrafoOperadores({ arvore, numeroDoNo }) {
  const idSeta = `seta-${useId().replace(/:/g, '')}`;
  const { nos, arestas, largura, altura } = calcularLayout(arvore);

  return (
    <div className="grafo">
      <div className="grafo-rolagem">
        <svg width={largura} height={altura} role="img" aria-label="Grafo de operadores">
          <defs>
            <marker
              id={idSeta}
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="grafo-seta" />
            </marker>
          </defs>

          {/* Arestas: do filho (resultado intermediário) para o pai que o consome */}
          {arestas.map(({ de, para }, i) => (
            <line
              key={i}
              className="grafo-aresta"
              x1={de.centro}
              y1={de.y}
              x2={para.centro}
              y2={para.y + para.altura}
              markerEnd={`url(#${idSeta})`}
            />
          ))}

          {nos.map((item) => {
            const classe =
              item.no.tipo === 'relacao'
                ? 'grafo-no grafo-folha'
                : item.no === arvore
                  ? 'grafo-no grafo-raiz'
                  : 'grafo-no';
            const numero = numeroDoNo?.get(item.no);
            let y = item.y + PADDING_Y;

            return (
              <g key={item.id} className={classe}>
                <rect x={item.x} y={item.y} width={item.largura} height={item.altura} rx="8" />
                {item.simbolo && (
                  <text x={item.centro} y={(y += ALTURA_SIMBOLO) - 5} className="grafo-simbolo">
                    {item.simbolo}
                  </text>
                )}
                {item.linhas.map((linha, i) => (
                  <text key={i} x={item.centro} y={(y += ALTURA_LINHA) - 4} className="grafo-texto">
                    {linha}
                  </text>
                ))}
                {numero !== undefined && (
                  <g className="grafo-passo">
                    <circle cx={item.x + item.largura} cy={item.y} r="11" />
                    <text x={item.x + item.largura} y={item.y + 4}>
                      {numero}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="legenda-grafo">
        <span>
          <i className="amostra amostra-folha" /> Folhas = tabelas
        </span>
        <span>
          <i className="amostra amostra-operador" /> Nós intermediários = operadores (σ, ⋈, ×, π)
        </span>
        <span>
          <i className="amostra amostra-raiz" /> Raiz = projeção final (π)
        </span>
        <span>↑ Setas = fluxo dos resultados intermediários</span>
        {numeroDoNo && (
          <span>
            <i className="amostra amostra-passo" /> Número = passo no plano de execução
          </span>
        )}
      </p>
    </div>
  );
}
