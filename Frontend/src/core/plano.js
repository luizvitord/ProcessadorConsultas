import { filhos, formatarCondicao, formatarProjecao, SIMBOLOS } from './algebra.js';

/**
 * HU5 — Plano de execução.
 *
 * RN: "Execução deve seguir ordem definida pelo grafo otimizado". Um operador
 * só pode rodar depois que os resultados intermediários que chegam a ele pelas
 * arestas estiverem prontos, então a ordem é um percurso em pós-ordem da
 * árvore otimizada: filho esquerdo, filho direito e, por fim, o próprio nó.
 * As folhas (tabelas) não são passos — aparecem como entradas dos operadores.
 */
export function gerarPlano(arvore) {
  const passos = [];
  const numeroDoNo = new Map();

  function visitar(no) {
    if (no.tipo === 'relacao') return { tipo: 'tabela', nome: no.tabela };

    const entradas = filhos(no).map(visitar);
    const numero = passos.length + 1;
    numeroDoNo.set(no, numero);
    passos.push({
      numero,
      simbolo: SIMBOLOS[no.tipo],
      descricao: descrever(no),
      entradas,
      heuristicas: no.heuristicas ?? [],
      final: no === arvore,
    });
    return { tipo: 'passo', numero };
  }

  visitar(arvore);
  return { passos, numeroDoNo };
}

function descrever(no) {
  switch (no.tipo) {
    case 'selecao':
      return `Seleção: mantém só as tuplas em que ${formatarCondicao(no.condicao)}`;
    case 'projecao':
      return no.todos
        ? 'Projeção: devolve todos os atributos (SELECT *)'
        : `Projeção: mantém os atributos ${formatarProjecao(no)}`;
    case 'juncao':
      return `Junção: combina as tuplas em que ${formatarCondicao(no.condicao)}`;
    case 'produto':
      return 'Produto cartesiano: combina todas as tuplas de uma entrada com todas as da outra';
  }
}
