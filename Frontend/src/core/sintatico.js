import { ErroSintatico } from './erros.js';

/**
 * Analisador sintático descendente recursivo (HU1).
 *
 * Cada regra da gramática abaixo vira uma função. Qualquer desvio da gramática
 * lança ErroSintatico — tabelas e atributos ainda NÃO são conferidos aqui;
 * isso é papel do analisador semântico, para manter os dois tipos de erro
 * separados como pede a HU1.
 *
 *   consulta   ::= SELECT selecao FROM tabela juncao* [WHERE condicao] [;] FIM
 *   selecao    ::= '*' | coluna (',' coluna)*
 *   juncao     ::= JOIN tabela ON condicao               (RN: 0, 1, …, N JOINs)
 *   condicao   ::= termo (AND termo)*
 *   termo      ::= '(' condicao ')' | operando OPERADOR operando
 *   operando   ::= coluna | NUMERO | TEXTO
 *   coluna     ::= IDENTIFICADOR ['.' IDENTIFICADOR]
 *   OPERADOR   ::= = | > | < | <= | >= | <>
 *
 * Saída: árvore sintática (AST) com as referências ainda "cruas", isto é,
 * exatamente como o usuário digitou.
 */
export function analisarSintaxe(tokens) {
  let atual = 0;

  const olhar = () => tokens[atual];
  const avancar = () => tokens[atual++];
  const ehPalavra = (palavra) => olhar().tipo === 'PALAVRA_CHAVE' && olhar().valor === palavra;
  const ehSimbolo = (simbolo) => olhar().tipo === 'SIMBOLO' && olhar().valor === simbolo;

  function descrever(token) {
    if (token.tipo === 'FIM') return 'o fim da consulta';
    if (token.tipo === 'PALAVRA_CHAVE') return `a palavra-chave ${token.valor}`;
    return `"${token.original}"`;
  }

  function falhar(mensagem, token = olhar()) {
    throw new ErroSintatico(`${mensagem} Encontrado: ${descrever(token)}.`, token);
  }

  function exigirPalavra(palavra, mensagem) {
    if (!ehPalavra(palavra)) falhar(mensagem);
    return avancar();
  }

  // consulta ::= SELECT selecao FROM tabela juncao* [WHERE condicao] [;] FIM
  function consulta() {
    exigirPalavra('SELECT', 'A consulta deve começar com SELECT.');
    const selecao = listaSelecao();
    exigirPalavra('FROM', 'Falta a cláusula FROM depois da lista de atributos (ou uma vírgula entre eles).');
    const de = tabela('FROM');

    const juncoes = [];
    while (ehPalavra('JOIN')) {
      const tokenJoin = avancar();
      const tabelaJuncao = tabela('JOIN');
      exigirPalavra('ON', `O JOIN com a tabela "${tabelaJuncao.nome}" precisa da cláusula ON.`);
      if (olhar().tipo === 'FIM') falhar('Falta a condição de junção depois de ON.');
      juncoes.push({ tabela: tabelaJuncao, condicao: condicao(), token: tokenJoin });
    }

    let onde = null;
    if (ehPalavra('WHERE')) {
      avancar();
      if (olhar().tipo === 'FIM') falhar('Falta a condição depois de WHERE.');
      onde = condicao();
    }

    if (ehSimbolo(';')) avancar();

    if (olhar().tipo !== 'FIM') {
      if (ehSimbolo(')')) falhar('Parêntese ")" sem o "(" correspondente.');
      falhar(
        juncoes.length === 0 && onde === null
          ? 'Esperado JOIN, WHERE ou o fim da consulta.'
          : 'Trecho inesperado: esperado JOIN, WHERE, AND ou o fim da consulta.'
      );
    }

    return { tipo: 'consulta', selecao, de, juncoes, onde };
  }

  // selecao ::= '*' | coluna (',' coluna)*
  function listaSelecao() {
    if (ehSimbolo('*')) {
      avancar();
      return { todos: true, colunas: [] };
    }
    if (olhar().tipo !== 'IDENTIFICADOR') {
      falhar('Informe os atributos (ou *) logo após SELECT.');
    }
    const colunas = [coluna()];
    while (ehSimbolo(',')) {
      avancar();
      if (olhar().tipo !== 'IDENTIFICADOR') falhar('Esperado um atributo depois da vírgula.');
      colunas.push(coluna());
    }
    return { todos: false, colunas };
  }

  function tabela(clausula) {
    if (olhar().tipo !== 'IDENTIFICADOR') {
      falhar(`Esperado o nome de uma tabela depois de ${clausula}.`);
    }
    const token = avancar();
    return { nome: token.valor, token };
  }

  // coluna ::= IDENTIFICADOR ['.' IDENTIFICADOR]
  function coluna() {
    const primeiro = avancar();
    if (ehSimbolo('.')) {
      avancar();
      if (olhar().tipo !== 'IDENTIFICADOR') {
        falhar(`Esperado o nome de um atributo depois de "${primeiro.original}.".`);
      }
      const segundo = avancar();
      return {
        tipo: 'coluna',
        tabela: primeiro.valor,
        atributo: segundo.valor,
        tokenTabela: primeiro,
        token: segundo,
      };
    }
    return { tipo: 'coluna', tabela: null, atributo: primeiro.valor, token: primeiro };
  }

  // condicao ::= termo (AND termo)*
  function condicao() {
    const termos = [termo()];
    while (ehPalavra('AND')) {
      avancar();
      termos.push(termo());
    }
    return termos.length === 1 ? termos[0] : { tipo: 'e', termos };
  }

  // termo ::= '(' condicao ')' | operando OPERADOR operando
  function termo() {
    if (ehSimbolo('(')) {
      const abertura = avancar();
      const interna = condicao();
      if (!ehSimbolo(')')) {
        if (olhar().tipo === 'FIM') {
          throw new ErroSintatico('Parêntese "(" aberto e nunca fechado.', abertura);
        }
        falhar('Esperado ")" ou AND.');
      }
      avancar();
      return { tipo: 'grupo', condicao: interna };
    }

    const esquerda = operando('Esperada uma comparação (ex.: Tabela.atributo = valor).');
    if (olhar().tipo !== 'OPERADOR') {
      falhar('Esperado um operador de comparação (=, >, <, <=, >=, <>).');
    }
    const operador = avancar().valor;
    const direita = operando(`Esperado um atributo ou valor depois de "${operador}".`);
    return { tipo: 'comparacao', operador, esquerda, direita };
  }

  // operando ::= coluna | NUMERO | TEXTO
  function operando(mensagem) {
    const token = olhar();
    if (token.tipo === 'IDENTIFICADOR') return coluna();
    if (token.tipo === 'NUMERO') {
      avancar();
      return { tipo: 'numero', valor: token.valor, token };
    }
    if (token.tipo === 'TEXTO') {
      avancar();
      return { tipo: 'texto', valor: token.valor, token };
    }
    falhar(mensagem);
  }

  return consulta();
}
