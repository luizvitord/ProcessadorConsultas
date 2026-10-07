/**
 * Metadados do Modelo Relacional de referência (Imagem 01 do enunciado).
 *
 * HU1 / RN — "Apenas tabelas/atributos listados no modelo podem ser usados".
 * A validação semântica consulta exclusivamente este dicionário.
 */
export const MODELO_RELACIONAL = {
  Categoria: ['idCategoria', 'Descricao'],
  Produto: ['idProduto', 'Nome', 'Descricao', 'Preco', 'QuantEstoque', 'Categoria_idCategoria'],
  TipoCliente: ['idTipoCliente', 'Descricao'],
  Cliente: [
    'idCliente',
    'Nome',
    'Email',
    'Nascimento',
    'Senha',
    'TipoCliente_idTipoCliente',
    'DataRegistro',
  ],
  TipoEndereco: ['idTipoEndereco', 'Descricao'],
  Endereco: [
    'idEndereco',
    'EnderecoPadrao',
    'Logradouro',
    'Numero',
    'Complemento',
    'Bairro',
    'Cidade',
    'UF',
    'CEP',
    'TipoEndereco_idTipoEndereco',
    'Cliente_idCliente',
  ],
  Telefone: ['Numero', 'Cliente_idCliente'],
  Status: ['idStatus', 'Descricao'],
  Pedido: ['idPedido', 'Status_idStatus', 'DataPedido', 'ValorTotalPedido', 'Cliente_idCliente'],
  Pedido_has_Produto: [
    'idPedidoProduto',
    'Pedido_idPedido',
    'Produto_idProduto',
    'Quantidade',
    'PrecoUnitario',
  ],
};

/**
 * RN — "Deve ignorar a diferença entre palavras maiúsculas e minúsculas".
 * Devolve o nome canônico da tabela (como está no modelo) ou null.
 */
export function buscarTabela(nome) {
  const procurado = nome.toLowerCase();
  return Object.keys(MODELO_RELACIONAL).find((t) => t.toLowerCase() === procurado) ?? null;
}

/** Devolve o nome canônico do atributo dentro da tabela, ou null. */
export function buscarAtributo(tabela, nome) {
  const procurado = nome.toLowerCase();
  return MODELO_RELACIONAL[tabela].find((a) => a.toLowerCase() === procurado) ?? null;
}

export function atributosDe(tabela) {
  return MODELO_RELACIONAL[tabela];
}
