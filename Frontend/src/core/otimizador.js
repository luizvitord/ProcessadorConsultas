import { atributosDe } from './metadados.js';
import {
  relacao,
  selecao,
  projecao,
  juncao,
  produto,
  conjuncoes,
  conjuncao,
  atributosDaComparacao,
  tabelasDaComparacao,
  formatarCondicao,
  nomeAtributo,
} from './algebra.js';

/**
 * HU4 — Otimização heurística da consulta.
 *
 * Heurísticas do enunciado e onde cada uma é aplicada:
 *
 *   a.i   seleções primeiro (reduzem tuplas)
 *         -> cada comparação que envolve uma única tabela desce até a folha
 *            dessa tabela, antes de qualquer junção.
 *   a.ii  projeções na sequência (reduzem atributos)
 *         -> logo após as seleções de cada folha, e após cada junção, entra
 *            uma π com apenas os atributos que ainda serão usados acima.
 *   b.i   reordenar as folhas: seleções e junções mais restritivas primeiro
 *         -> a primeira folha é a relação mais restritiva; as seguintes são
 *            escolhidas, uma a uma, entre as que têm condição de junção com o
 *            que já foi processado, sempre a mais restritiva.
 *         -> várias seleções sobre a mesma tabela ficam em cascata, a mais
 *            restritiva mais perto da tabela (é executada primeiro).
 *   b.ii  evitar produto cartesiano
 *         -> só entra uma relação SEM condição de junção quando nenhuma
 *            restante está ligada às já processadas; aí o × é inevitável.
 *
 * Restritividade: sem estatísticas reais das tabelas, usamos os fatores de
 * seletividade padrão da literatura (otimizador do System R):
 *   =  -> 1/10      <>  -> 9/10      <, >, <=, >=  -> 1/3
 * Quanto menor o fator, menos tuplas sobram, logo mais restritiva a operação.
 */

const FATORES = {
  '=': { valor: 1 / 10, texto: '1/10' },
  '<>': { valor: 9 / 10, texto: '9/10' },
  '<': { valor: 1 / 3, texto: '1/3' },
  '>': { valor: 1 / 3, texto: '1/3' },
  '<=': { valor: 1 / 3, texto: '1/3' },
  '>=': { valor: 1 / 3, texto: '1/3' },
};

export function seletividade(comparacao) {
  // Comparação entre duas constantes não filtra por atributo nenhum.
  if (atributosDaComparacao(comparacao).length === 0) return { valor: 1, texto: '1' };
  return FATORES[comparacao.operador];
}

export function formatarFator(valor) {
  return `${(valor * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

const produtoDosFatores = (predicados) => predicados.reduce((acc, p) => acc * p.fator.valor, 1);

/** Menor elemento segundo `custo`; em empate fica o primeiro (ordem da consulta). */
function menorPor(lista, custo) {
  return lista.reduce((melhor, item) => (custo(item) < custo(melhor) ? item : melhor));
}

/** Atributos que saem de um nó da árvore. */
export function atributosDisponiveis(no) {
  switch (no.tipo) {
    case 'relacao':
      return atributosDe(no.tabela).map((atributo) => ({ tabela: no.tabela, atributo }));
    case 'selecao':
      return atributosDisponiveis(no.filho);
    case 'projecao':
      return no.atributos;
    default:
      return [...atributosDisponiveis(no.esquerda), ...atributosDisponiveis(no.direita)];
  }
}

export function otimizar(consulta) {
  // ---------------------------------------------------------------------
  // 1. Junta TODAS as condições (ON e WHERE) e quebra em comparações
  //    simples ligadas por AND. Cada uma é classificada pelas tabelas que usa.
  // ---------------------------------------------------------------------
  const predicados = [
    ...consulta.juncoes.flatMap((j) =>
      conjuncoes(j.condicao).map((c) => ({ c, origem: `ON do JOIN com ${j.tabela}` }))
    ),
    ...(consulta.onde ? conjuncoes(consulta.onde).map((c) => ({ c, origem: 'WHERE' })) : []),
  ].map((p) => ({ ...p, tabelas: [...tabelasDaComparacao(p.c)], fator: seletividade(p.c) }));

  const selecoesPorTabela = new Map(consulta.tabelas.map((t) => [t, []]));
  const predicadosDeJuncao = [];
  const semTabela = [];

  for (const p of predicados) {
    if (p.tabelas.length === 1) selecoesPorTabela.get(p.tabelas[0]).push(p);
    else if (p.tabelas.length === 2) predicadosDeJuncao.push(p);
    else semTabela.push(p);
  }

  const fatorDaTabela = (t) => produtoDosFatores(selecoesPorTabela.get(t));

  const atributosFinais = consulta.projecao.atributos;

  /**
   * a.ii — atributos de `tabelas` que ainda serão usados ACIMA de um ponto
   * da árvore: os da projeção final e os das junções ainda não aplicadas.
   * Saem na ordem do modelo para a projeção ficar legível.
   */
  function atributosNecessarios(tabelas, juncoesPendentes) {
    const usados = new Set(
      [...atributosFinais, ...juncoesPendentes.flatMap((p) => atributosDaComparacao(p.c))]
        .filter((a) => tabelas.includes(a.tabela))
        .map(nomeAtributo)
    );
    return tabelas.flatMap((t) =>
      atributosDe(t)
        .map((atributo) => ({ tabela: t, atributo }))
        .filter((a) => usados.has(nomeAtributo(a)))
    );
  }

  // ---------------------------------------------------------------------
  // 2. Folhas: Tabela -> σ (a.i, mais restritiva primeiro) -> π (a.ii)
  // ---------------------------------------------------------------------
  function construirFolha(t) {
    let no = relacao(t);

    // Ordenação estável: em empate, mantém a ordem em que foram escritas.
    const selecoes = [...selecoesPorTabela.get(t)].sort((a, b) => a.fator.valor - b.fator.valor);

    selecoes.forEach((p, i) => {
      no = selecao(p.c, no);
      no.heuristicas = [
        {
          codigo: 'a.i',
          texto:
            `Seleção movida do ${p.origem} para junto da tabela ${t}: ` +
            'reduz o número de tuplas antes de qualquer junção.',
        },
      ];
      if (selecoes.length > 1) {
        no.heuristicas.push({
          codigo: 'b.i',
          texto:
            `${i + 1}ª de ${selecoes.length} seleções sobre ${t}, da mais restritiva para a ` +
            `menos restritiva (fator estimado ${p.fator.texto}).`,
        });
      }
    });

    // Na folha, todas as junções ainda estão por vir.
    const necessarios = atributosNecessarios([t], predicadosDeJuncao);
    const total = atributosDe(t).length;
    if (necessarios.length > 0 && necessarios.length < total) {
      no = projecao(necessarios, no);
      no.heuristicas = [
        {
          codigo: 'a.ii',
          texto:
            `Projeção antecipada: dos ${total} atributos de ${t}, mantém apenas ` +
            `${necessarios.length} — os usados acima (projeção final e condições de junção).`,
        },
      ];
    }

    return no;
  }

  // ---------------------------------------------------------------------
  // 3. Ordem das folhas e junções (b.i) evitando produto cartesiano (b.ii)
  // ---------------------------------------------------------------------
  const restantes = [...consulta.tabelas];
  const primeira = menorPor(restantes, fatorDaTabela);
  restantes.splice(restantes.indexOf(primeira), 1);

  const processadas = [primeira];
  const pendentes = [...predicadosDeJuncao];
  let arvore = construirFolha(primeira);

  /** Condições de junção que ligam `t` ao que já foi processado. */
  const ligacoes = (t) =>
    pendentes.filter(
      (p) => p.tabelas.includes(t) && p.tabelas.some((o) => o !== t && processadas.includes(o))
    );

  while (restantes.length > 0) {
    const conectadas = restantes.filter((t) => ligacoes(t).length > 0);
    const heuristicas = [];

    if (processadas.length === 1) {
      heuristicas.push({
        codigo: 'b.i',
        texto:
          `${primeira} é a primeira folha por ser a relação mais restritiva ` +
          `(fator estimado ${formatarFator(fatorDaTabela(primeira))}).`,
      });
    }

    let proxima;
    if (conectadas.length > 0) {
      const custo = (t) => fatorDaTabela(t) * produtoDosFatores(ligacoes(t));
      proxima = menorPor(conectadas, custo);
      const usados = ligacoes(proxima);
      const fator = custo(proxima); // antes de consumir as condições pendentes
      for (const p of usados) pendentes.splice(pendentes.indexOf(p), 1);

      const condicao = conjuncao(usados.map((p) => p.c));
      arvore = juncao(condicao, arvore, construirFolha(proxima));

      heuristicas.push(
        {
          codigo: 'b.i',
          texto:
            `${proxima} entra agora por ser, entre as relações ligadas a ` +
            `${processadas.join(', ')}, a junção mais restritiva ` +
            `(fator estimado ${formatarFator(fator)}).`,
        },
        {
          codigo: 'b.ii',
          texto:
            `Junção pela condição ${formatarCondicao(condicao)} ` +
            `(do ${[...new Set(usados.map((p) => p.origem))].join(' e do ')}): ` +
            'a condição é aplicada na própria junção, evitando o produto cartesiano.',
        }
      );
    } else {
      proxima = menorPor(restantes, fatorDaTabela);
      arvore = produto(arvore, construirFolha(proxima));
      heuristicas.push({
        codigo: 'b.ii',
        texto:
          `Produto cartesiano inevitável: nenhuma condição da consulta liga ${proxima} ` +
          `a ${processadas.join(', ')}. Por isso ele foi deixado para depois das junções possíveis.`,
      });
    }

    arvore.heuristicas = heuristicas;
    processadas.push(proxima);
    restantes.splice(restantes.indexOf(proxima), 1);

    // a.ii — projeção após a junção, se ainda houver junções acima dela
    // (depois da última, quem reduz os atributos é a projeção final).
    if (restantes.length > 0) {
      const necessarios = atributosNecessarios(processadas, pendentes);
      const disponiveis = atributosDisponiveis(arvore).length;
      if (necessarios.length > 0 && necessarios.length < disponiveis) {
        arvore = projecao(necessarios, arvore);
        arvore.heuristicas = [
          {
            codigo: 'a.ii',
            texto:
              'Projeção após a junção: descarta os atributos que não serão mais usados ' +
              `(de ${disponiveis} para ${necessarios.length}).`,
          },
        ];
      }
    }
  }

  // Comparações entre constantes não dependem de tabela alguma.
  if (semTabela.length > 0) {
    arvore = selecao(conjuncao(semTabela.map((p) => p.c)), arvore);
    arvore.heuristicas = [
      {
        codigo: 'a.i',
        texto: 'Condição entre constantes: não depende de nenhuma tabela e é avaliada uma única vez.',
      },
    ];
  }

  // Raiz: projeção final (π) pedida no SELECT.
  arvore = projecao(atributosFinais, arvore, consulta.projecao.todos);
  arvore.heuristicas = [];

  return arvore;
}
