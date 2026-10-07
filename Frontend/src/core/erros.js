/**
 * HU1 — "O parser deve separar o que é erro de gramática SQL de erro semântico"
 * e "Exibir mensagens de erro amigáveis indicando o tipo de falha".
 *
 * Os dois tipos de falha são classes distintas; a interface lê `tipo` para
 * exibir "Sintática" ou "Semântica" e `posicao`/`comprimento` para sublinhar
 * o trecho problemático da consulta.
 */
export class ErroConsulta extends Error {
  constructor(tipo, mensagem, token) {
    super(mensagem);
    this.tipo = tipo;
    this.posicao = token?.posicao ?? null;
    this.comprimento = token?.original?.length || 1;
    this.linha = token?.linha ?? null;
    this.coluna = token?.coluna ?? null;
  }
}

/** Erro de gramática SQL: palavra-chave ausente, JOIN sem ON, símbolo inválido... */
export class ErroSintatico extends ErroConsulta {
  constructor(mensagem, token) {
    super('Sintática', mensagem, token);
  }
}

/** Erro de significado: tabela ou atributo inexistente no modelo, atributo ambíguo... */
export class ErroSemantico extends ErroConsulta {
  constructor(mensagem, token) {
    super('Semântica', mensagem, token);
  }
}
