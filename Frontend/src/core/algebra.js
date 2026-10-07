/**
 * Álgebra relacional (HU2) e grafo de operadores (HU3).
 *
 * A expressão de álgebra relacional e o grafo de operadores são a MESMA
 * estrutura em memória: uma árvore cujos nós são
 *
 *   relacao   — folha: uma tabela do modelo
 *   selecao   — σ  (filho)
 *   projecao  — π  (filho)
 *   juncao    — ⋈  (esquerda, direita) com condição
 *   produto   — ×  (esquerda, direita) sem condição
 *
 * O texto da álgebra é obtido percorrendo essa árvore, e o grafo exibido na
 * interface é o desenho dela. Assim o que se lê e o que se vê nunca divergem.
 */

export const SIMBOLOS = {
  selecao: 'σ',
  projecao: 'π',
  juncao: '⋈',
  produto: '×',
};

export const relacao = (tabela) => ({ tipo: 'relacao', tabela });
export const selecao = (condicao, filho) => ({ tipo: 'selecao', condicao, filho });
export const projecao = (atributos, filho, todos = false) => ({ tipo: 'projecao', atributos, todos, filho });
export const juncao = (condicao, esquerda, direita) => ({ tipo: 'juncao', condicao, esquerda, direita });
export const produto = (esquerda, direita) => ({ tipo: 'produto', esquerda, direita });

export function filhos(no) {
  if (no.tipo === 'relacao') return [];
  if (no.tipo === 'selecao' || no.tipo === 'projecao') return [no.filho];
  return [no.esquerda, no.direita];
}

/**
 * HU2 / HU3 — árvore NÃO otimizada, construída exatamente na ordem em que a
 * consulta foi escrita:
 *
 *   π lista ( σ where ( ((FROM ⋈on1 JOIN1) ⋈on2 JOIN2) … ) )
 *
 * Folhas = tabelas, nós intermediários = operadores, raiz = projeção final.
 */
export function construirArvoreOriginal(consulta) {
  let arvore = relacao(consulta.tabelas[0]);

  for (const j of consulta.juncoes) {
    arvore = juncao(j.condicao, arvore, relacao(j.tabela));
  }

  if (consulta.onde) arvore = selecao(consulta.onde, arvore);

  return projecao(consulta.projecao.atributos, arvore, consulta.projecao.todos);
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export const nomeAtributo = (a) => `${a.tabela}.${a.atributo}`;

function formatarOperando(op) {
  return op.tipo === 'coluna' ? nomeAtributo(op) : op.valor;
}

/**
 * HU2 — "A conversão deve preservar operadores e condições": os operadores de
 * comparação e os parênteses digitados são mantidos; AND vira ∧, sua notação
 * em álgebra relacional.
 */
export function formatarCondicao(c) {
  switch (c.tipo) {
    case 'comparacao':
      return `${formatarOperando(c.esquerda)} ${c.operador} ${formatarOperando(c.direita)}`;
    case 'grupo':
      return `(${formatarCondicao(c.condicao)})`;
    case 'e':
      return c.termos.map(formatarCondicao).join(' ∧ ');
  }
}

export function formatarProjecao(no) {
  return no.todos ? '*' : no.atributos.map(nomeAtributo).join(', ');
}

/** Parâmetro escrito em subscrito ao lado do símbolo do operador. */
export function parametroDoNo(no) {
  if (no.tipo === 'selecao' || no.tipo === 'juncao') return formatarCondicao(no.condicao);
  if (no.tipo === 'projecao') return formatarProjecao(no);
  return '';
}

/**
 * Converte a árvore em uma lista de partes { texto, subscrito } para que a
 * interface possa desenhar os parâmetros dos operadores em subscrito
 * (σ<sub>cond</sub>, π<sub>atributos</sub>, ⋈<sub>cond</sub>).
 */
export function expressaoEmPartes(no) {
  const partes = [];
  const texto = (t) => partes.push({ texto: t, subscrito: false });
  const sub = (t) => partes.push({ texto: t, subscrito: true });

  function visitar(n) {
    switch (n.tipo) {
      case 'relacao':
        texto(n.tabela);
        break;
      case 'selecao':
      case 'projecao':
        texto(SIMBOLOS[n.tipo]);
        sub(parametroDoNo(n));
        texto('(');
        visitar(n.filho);
        texto(')');
        break;
      case 'juncao':
      case 'produto':
        operandoBinario(n.esquerda);
        texto(` ${SIMBOLOS[n.tipo]}`);
        if (n.tipo === 'juncao') sub(parametroDoNo(n));
        texto(' ');
        operandoBinario(n.direita);
        break;
    }
  }

  // Junções aninhadas ganham parênteses para deixar a associatividade explícita.
  function operandoBinario(n) {
    const binario = n.tipo === 'juncao' || n.tipo === 'produto';
    if (binario) texto('(');
    visitar(n);
    if (binario) texto(')');
  }

  visitar(no);
  return partes;
}

/** Versão em texto puro (subscrito marcado com colchetes). */
export function expressaoEmTexto(no) {
  return expressaoEmPartes(no)
    .map((p) => (p.subscrito ? `[${p.texto}]` : p.texto))
    .join('');
}

// ---------------------------------------------------------------------------
// Utilidades sobre condições, usadas pelo otimizador
// ---------------------------------------------------------------------------

/** Quebra uma condição em sua lista de comparações ligadas por AND. */
export function conjuncoes(c) {
  if (c.tipo === 'e') return c.termos.flatMap(conjuncoes);
  if (c.tipo === 'grupo') return conjuncoes(c.condicao);
  return [c];
}

/** Junta comparações com AND (inverso de `conjuncoes`). */
export function conjuncao(comparacoes) {
  return comparacoes.length === 1 ? comparacoes[0] : { tipo: 'e', termos: comparacoes };
}

/** Atributos (Tabela.atributo) mencionados por uma comparação. */
export function atributosDaComparacao(c) {
  return [c.esquerda, c.direita].filter((o) => o.tipo === 'coluna');
}

/** Conjunto das tabelas mencionadas por uma comparação. */
export function tabelasDaComparacao(c) {
  return new Set(atributosDaComparacao(c).map((o) => o.tabela));
}
