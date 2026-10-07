import { nomeAtributo } from '../core/algebra.js';

/**
 * HU1 — resultado da validação.
 *
 * Em caso de erro: tipo da falha (Sintática ou Semântica), mensagem amigável e
 * o trecho da consulta sublinhado. Em caso de sucesso: o que o parser
 * reconheceu (tabelas, atributos resolvidos e tokens), para que se possa
 * conferir que o parsing ocorreu corretamente.
 */
export default function ResultadoValidacao({ sql, resultado }) {
  if (!resultado.ok) return <Erro sql={sql} erro={resultado.erro} />;

  const { consulta, tokens } = resultado;

  return (
    <div className="alerta alerta-ok">
      <strong>Consulta válida.</strong> Sintaxe e semântica conferidas com o modelo relacional.
      <ul className="lista-validacao">
        <li>
          <span className="rotulo">Tabelas</span>
          {consulta.tabelas.join(', ')}
        </li>
        <li>
          <span className="rotulo">Atributos do SELECT</span>
          {consulta.projecao.todos ? '* (todos)' : consulta.projecao.atributos.map(nomeAtributo).join(', ')}
        </li>
        <li>
          <span className="rotulo">JOINs</span>
          {consulta.juncoes.length}
        </li>
      </ul>

      <details className="tokens">
        <summary>Tokens reconhecidos pelo analisador léxico ({tokens.length - 1})</summary>
        <div className="fita-tokens">
          {tokens.slice(0, -1).map((t, i) => (
            <span key={i} className={`token token-${t.tipo.toLowerCase()}`} title={t.tipo}>
              {t.original}
              <small>{t.tipo}</small>
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}

function Erro({ sql, erro }) {
  // Mostra apenas a linha da consulta onde está o erro, com o trecho sublinhado.
  const inicioLinha = sql.lastIndexOf('\n', erro.posicao - 1) + 1;
  const fimLinha = sql.indexOf('\n', erro.posicao);
  const linha = sql.slice(inicioLinha, fimLinha === -1 ? undefined : fimLinha);
  const inicio = erro.posicao - inicioLinha;
  const fim = inicio + erro.comprimento;

  return (
    <div className="alerta alerta-erro">
      <div className="cabecalho-erro">
        <span className={`selo-erro selo-${erro.tipo === 'Sintática' ? 'sintatico' : 'semantico'}`}>
          Erro {erro.tipo === 'Sintática' ? 'sintático' : 'semântico'}
        </span>
        <span>
          Tipo de falha: <strong>{erro.tipo}</strong> — linha {erro.linha}, coluna {erro.coluna}
        </span>
      </div>
      <p className="mensagem-erro">{erro.message}</p>
      <pre className="trecho-erro">
        {linha.slice(0, inicio)}
        <mark>{linha.slice(inicio, fim) || ' '}</mark>
        {linha.slice(fim)}
      </pre>
    </div>
  );
}
