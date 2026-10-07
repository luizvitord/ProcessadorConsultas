import { ErroSintatico } from './erros.js';

/**
 * Analisador léxico (HU1).
 *
 * A consulta é quebrada em tokens por UMA expressão regular com a flag `y`
 * (sticky): cada chamada a `exec` só casa exatamente na posição `lastIndex`,
 * então qualquer caractere que nenhum grupo reconheça é detectado na hora,
 * sem pular texto em silêncio.
 *
 * Grupos da expressão, em ordem de tentativa:
 *   1. espaços em branco          -> descartados (RN: ignorar repetições de espaços)
 *   2. número   123 | 10.50
 *   3. texto    'abc'  ('' representa uma aspa dentro do texto)
 *   4. operador <= >= <> = < >   (os de dois caracteres vêm antes, para não
 *                                 casar "<" sozinho no início de "<=")
 *   5. identificador / palavra-chave
 *   6. símbolos ( ) , . * ;
 */
const PADRAO_TOKEN =
  /(\s+)|(\d+(?:\.\d+)?)|('(?:[^']|'')*')|(<=|>=|<>|=|<|>)|([A-Za-z_][A-Za-z0-9_]*)|([(),.*;])/y;

/** Comandos SQL selecionados para o trabalho (HU1). */
export const PALAVRAS_CHAVE = new Set(['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'AND']);

export function analisarLexico(sql) {
  const tokens = [];
  let linha = 1;
  let inicioLinha = 0;

  PADRAO_TOKEN.lastIndex = 0;

  while (PADRAO_TOKEN.lastIndex < sql.length) {
    const posicao = PADRAO_TOKEN.lastIndex;
    const casamento = PADRAO_TOKEN.exec(sql);
    const local = { posicao, linha, coluna: posicao - inicioLinha + 1 };

    if (!casamento) {
      const caractere = sql[posicao];
      const token = { ...local, original: caractere };
      if (caractere === "'") {
        throw new ErroSintatico('Texto iniciado com aspas simples (\') nunca foi fechado.', token);
      }
      throw new ErroSintatico(
        `Caractere inválido "${caractere}". Operadores aceitos: =, >, <, <=, >=, <>, AND e parênteses.`,
        token
      );
    }

    const [original, espaco, numero, texto, operador, palavra, simbolo] = casamento;

    if (espaco !== undefined) {
      // Mantém linha/coluna corretas para as mensagens de erro.
      for (let i = 0; i < espaco.length; i++) {
        if (espaco[i] === '\n') {
          linha++;
          inicioLinha = posicao + i + 1;
        }
      }
      continue;
    }

    if (numero !== undefined) {
      tokens.push({ tipo: 'NUMERO', valor: numero, original, ...local });
    } else if (texto !== undefined) {
      tokens.push({ tipo: 'TEXTO', valor: texto, original, ...local });
    } else if (operador !== undefined) {
      tokens.push({ tipo: 'OPERADOR', valor: operador, original, ...local });
    } else if (palavra !== undefined) {
      // RN — maiúsculas e minúsculas são equivalentes nas palavras-chave.
      const maiuscula = palavra.toUpperCase();
      if (PALAVRAS_CHAVE.has(maiuscula)) {
        tokens.push({ tipo: 'PALAVRA_CHAVE', valor: maiuscula, original, ...local });
      } else {
        tokens.push({ tipo: 'IDENTIFICADOR', valor: palavra, original, ...local });
      }
    } else {
      tokens.push({ tipo: 'SIMBOLO', valor: simbolo, original, ...local });
    }
  }

  tokens.push({
    tipo: 'FIM',
    valor: null,
    original: '',
    posicao: sql.length,
    linha,
    coluna: sql.length - inicioLinha + 1,
  });

  return tokens;
}
