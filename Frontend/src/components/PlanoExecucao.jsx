/**
 * HU5 — plano de execução ordenado.
 *
 * "Em vez de apenas listar os passos, exibir as heurísticas aplicadas em cada
 * etapa": cada passo traz as heurísticas que o otimizador registrou no nó
 * correspondente do grafo otimizado.
 */
export default function PlanoExecucao({ plano }) {
  return (
    <ol className="plano">
      {plano.passos.map((passo) => (
        <li key={passo.numero} className={passo.final ? 'passo passo-final' : 'passo'}>
          <div className="passo-numero">{passo.numero}</div>
          <div className="passo-corpo">
            <p className="passo-titulo">
              <span className="passo-simbolo">{passo.simbolo}</span> {passo.descricao}
            </p>
            <p className="passo-entradas">
              Entrada:{' '}
              {passo.entradas.map((e, i) => (
                <span key={i}>
                  {i > 0 && ' e '}
                  {e.tipo === 'tabela' ? (
                    <>
                      tabela <code>{e.nome}</code>
                    </>
                  ) : (
                    <>resultado do passo {e.numero}</>
                  )}
                </span>
              ))}
            </p>

            {passo.heuristicas.length > 0 ? (
              <ul className="passo-heuristicas">
                {passo.heuristicas.map((h, i) => (
                  <li key={i}>
                    <span className="codigo-heuristica">{h.codigo}</span> {h.texto}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="passo-sem-heuristica">
                {passo.final
                  ? 'Projeção final da consulta (raiz do grafo): devolve os atributos pedidos no SELECT.'
                  : 'Nenhuma heurística aplicada nesta etapa.'}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
