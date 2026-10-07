import { ErroSemantico } from './erros.js';
import { MODELO_RELACIONAL, buscarTabela, buscarAtributo, atributosDe } from './metadados.js';

/**
 * Analisador semântico (HU1).
 *
 * Recebe a AST do analisador sintático e confere cada tabela e atributo contra
 * o Modelo Relacional (Imagem 01). Ao final, todas as referências ficam
 * resolvidas para o nome canônico e qualificado (Tabela.atributo), que é o que
 * a álgebra relacional e o otimizador usam.
 *
 * Erros detectados aqui são sempre ErroSemantico: a consulta está
 * gramaticalmente correta, mas referencia algo que não existe (ou é ambíguo).
 */
export function analisarSemantica(ast) {
  // --- Tabelas (FROM e JOINs) ---
  const referencias = [ast.de, ...ast.juncoes.map((j) => j.tabela)];
  const tabelas = [];

  for (const ref of referencias) {
    const canonica = buscarTabela(ref.nome);
    if (!canonica) {
      throw new ErroSemantico(
        `A tabela "${ref.nome}" não existe no modelo relacional. ` +
          `Tabelas disponíveis: ${Object.keys(MODELO_RELACIONAL).join(', ')}.`,
        ref.token
      );
    }
    if (tabelas.includes(canonica)) {
      throw new ErroSemantico(
        `A tabela "${canonica}" aparece mais de uma vez na consulta.`,
        ref.token
      );
    }
    tabelas.push(canonica);
  }

  // --- Atributos do SELECT: podem vir de qualquer tabela da consulta ---
  const projecao = ast.selecao.todos
    ? { todos: true, atributos: tabelas.flatMap((t) => atributosDe(t).map((a) => ({ tabela: t, atributo: a }))) }
    : { todos: false, atributos: ast.selecao.colunas.map((c) => resolverColuna(c, tabelas, tabelas)) };

  // --- Condições ON: só enxergam as tabelas declaradas até aquele JOIN ---
  const juncoes = ast.juncoes.map((juncao, i) => {
    const visiveis = tabelas.slice(0, i + 2);
    return {
      tabela: tabelas[i + 1],
      condicao: resolverCondicao(juncao.condicao, visiveis, tabelas),
    };
  });

  // --- WHERE: enxerga todas as tabelas ---
  const onde = ast.onde ? resolverCondicao(ast.onde, tabelas, tabelas) : null;

  return { tabelas, projecao, juncoes, onde };
}

function resolverCondicao(condicao, visiveis, todas) {
  switch (condicao.tipo) {
    case 'e':
      return { tipo: 'e', termos: condicao.termos.map((t) => resolverCondicao(t, visiveis, todas)) };
    case 'grupo':
      return { tipo: 'grupo', condicao: resolverCondicao(condicao.condicao, visiveis, todas) };
    case 'comparacao':
      return {
        tipo: 'comparacao',
        operador: condicao.operador,
        esquerda: resolverOperando(condicao.esquerda, visiveis, todas),
        direita: resolverOperando(condicao.direita, visiveis, todas),
      };
  }
}

function resolverOperando(operando, visiveis, todas) {
  if (operando.tipo !== 'coluna') return { tipo: operando.tipo, valor: operando.valor };
  return { tipo: 'coluna', ...resolverColuna(operando, visiveis, todas) };
}

/**
 * Resolve "atributo" ou "Tabela.atributo" para { tabela, atributo } canônicos.
 *
 * `visiveis` são as tabelas que podem ser usadas neste ponto da consulta;
 * `todas` serve só para dar uma mensagem melhor quando a tabela existe na
 * consulta mas ainda não foi declarada (ex.: usada num ON anterior ao seu JOIN).
 */
function resolverColuna(coluna, visiveis, todas) {
  if (coluna.tabela !== null) {
    const tabela = buscarTabela(coluna.tabela);
    if (!tabela) {
      throw new ErroSemantico(
        `A tabela "${coluna.tabela}" não existe no modelo relacional.`,
        coluna.tokenTabela
      );
    }
    if (!todas.includes(tabela)) {
      throw new ErroSemantico(
        `A tabela "${tabela}" existe no modelo, mas não foi incluída no FROM/JOIN da consulta.`,
        coluna.tokenTabela
      );
    }
    if (!visiveis.includes(tabela)) {
      throw new ErroSemantico(
        `A tabela "${tabela}" só é declarada em um JOIN posterior e não pode ser usada nesta condição ON.`,
        coluna.tokenTabela
      );
    }
    const atributo = buscarAtributo(tabela, coluna.atributo);
    if (!atributo) {
      throw new ErroSemantico(
        `O atributo "${coluna.atributo}" não existe na tabela "${tabela}". ` +
          `Atributos de ${tabela}: ${atributosDe(tabela).join(', ')}.`,
        coluna.token
      );
    }
    return { tabela, atributo };
  }

  // Atributo sem tabela: precisa existir em exatamente uma tabela visível.
  const candidatas = visiveis.filter((t) => buscarAtributo(t, coluna.atributo));

  if (candidatas.length === 0) {
    const emOutra = todas.find((t) => !visiveis.includes(t) && buscarAtributo(t, coluna.atributo));
    throw new ErroSemantico(
      emOutra
        ? `O atributo "${coluna.atributo}" pertence a "${emOutra}", que só é declarada em um JOIN posterior.`
        : `O atributo "${coluna.atributo}" não existe em nenhuma tabela da consulta (${visiveis.join(', ')}).`,
      coluna.token
    );
  }
  if (candidatas.length > 1) {
    throw new ErroSemantico(
      `O atributo "${coluna.atributo}" é ambíguo: existe em ${candidatas.join(' e ')}. ` +
        `Qualifique-o como Tabela.${coluna.atributo}.`,
      coluna.token
    );
  }
  return { tabela: candidatas[0], atributo: buscarAtributo(candidatas[0], coluna.atributo) };
}
