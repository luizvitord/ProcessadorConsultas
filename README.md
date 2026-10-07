# Processador de Consultas

Projeto 2 de Banco de Dados (26.2): uma consulta SQL é validada contra o modelo relacional,
convertida para álgebra relacional, otimizada por heurísticas e exibida como grafo de operadores
e plano de execução. Aplicação React + Vite em `Frontend/`, sem backend.

## Como executar

```
cd Frontend
npm install
npm run dev       # http://localhost:5173
```

## Organização

Toda a lógica fica em `Frontend/src/core/`, sem dependência de React:

| Arquivo | HU | Responsabilidade |
|---|---|---|
| `metadados.js` | HU1 | Tabelas e atributos do modelo relacional (Imagem 01) |
| `lexico.js` | HU1 | Tokenização por expressão regular (`/…/y`, sticky) |
| `sintatico.js` | HU1 | Parser descendente recursivo: valida a gramática e gera a AST |
| `semantico.js` | HU1 | Confere tabelas/atributos no modelo e resolve para `Tabela.atributo` |
| `erros.js` | HU1 | `ErroSintatico` × `ErroSemantico` |
| `algebra.js` | HU2 / HU3 | Árvore de operadores (σ, π, ⋈, ×) e sua impressão em álgebra relacional |
| `otimizador.js` | HU4 | Aplicação das heurísticas, gerando a árvore otimizada |
| `plano.js` | HU5 | Ordem de execução (pós-ordem da árvore otimizada) |
| `processador.js` | — | Encadeia todas as etapas |

`Frontend/src/components/` contém só a apresentação; cada cartão da tela indica a HU que atende.

## Validação (HU1)

Gramática aceita:

```
consulta  ::= SELECT selecao FROM tabela (JOIN tabela ON condicao)* [WHERE condicao] [;]
selecao   ::= '*' | coluna (',' coluna)*
condicao  ::= termo (AND termo)*
termo     ::= '(' condicao ')' | operando (= | > | < | <= | >= | <>) operando
operando  ::= coluna | número | 'texto'
coluna    ::= atributo | Tabela.atributo
```

Palavras-chave, tabelas e atributos não diferenciam maiúsculas de minúsculas, e espaços em
branco repetidos são ignorados. Erros sintáticos são de gramática (palavra-chave ausente, JOIN
sem ON, parêntese não fechado, caractere inválido). Erros semânticos são de significado:
tabela ou atributo inexistente, atributo ambíguo (ex.: `Nome` com `Cliente` e `Produto`),
tabela repetida, ou tabela usada num `ON` antes do seu `JOIN`.

## Otimização (HU4)

1. **a.i — seleções primeiro:** as condições de ON e WHERE são quebradas nos `AND`. As que usam
   uma única tabela descem até a folha dessa tabela.
2. **a.ii — projeções na sequência:** após as seleções de cada folha, e após cada junção, entra
   uma π só com os atributos ainda usados acima (projeção final e junções pendentes).
3. **b.i — mais restritivas primeiro:** a primeira folha é a relação mais restritiva. Depois,
   entra sempre a relação ligada mais restritiva. Várias seleções sobre a mesma tabela ficam em
   cascata, com a mais restritiva primeiro. Sem estatísticas reais, a restritividade usa os
   fatores de seletividade padrão do System R: `=` 1/10, `<>` 9/10, `<`/`>`/`<=`/`>=` 1/3.
4. **b.ii — evitar produto cartesiano:** uma relação só entra sem condição de junção (×) quando
   nenhuma das restantes está ligada às já processadas.

O plano de execução (HU5) percorre a árvore otimizada em pós-ordem, com os filhos antes do pai.
Cada passo exibe as heurísticas que o otimizador registrou naquele nó, e o número do passo
também aparece no grafo otimizado.
