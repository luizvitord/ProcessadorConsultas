import { useState } from 'react';
import EntradaConsulta from './components/EntradaConsulta.jsx';
import ResultadoValidacao from './components/ResultadoValidacao.jsx';
import ExpressaoAlgebra from './components/ExpressaoAlgebra.jsx';
import GrafoOperadores from './components/GrafoOperadores.jsx';
import PlanoExecucao from './components/PlanoExecucao.jsx';
import { processarConsulta } from './core/processador.js';
import './App.css';

/** Heurísticas básicas do enunciado, com o código usado no plano de execução. */
const HEURISTICAS = [
  { codigo: 'a.i', texto: 'Seleções primeiro — reduzem o número de tuplas' },
  { codigo: 'a.ii', texto: 'Projeções na sequência — reduzem o número de atributos' },
  { codigo: 'b.i', texto: 'Seleções e junções mais restritivas primeiro — reordena as folhas' },
  { codigo: 'b.ii', texto: 'Evitar produto cartesiano' },
];

/**
 * Processador de Consultas.
 *
 * Orquestra o "Funcionamento" descrito no enunciado:
 *   1. a consulta SQL é digitada na interface                       -> HU1
 *   2. é parseada e validada (sintaxe, tabelas e atributos)          -> HU1
 *   3. é convertida e exibida em álgebra relacional                  -> HU2
 *   4. o grafo de operadores original é exibido                      -> HU3
 *   5. a álgebra é otimizada e o grafo otimizado é exibido           -> HU4
 *   6. o plano de execução ordenado, com as heurísticas, é exibido  -> HU5
 */
export default function App() {
  const [sqlAnalisado, setSqlAnalisado] = useState('');
  const [resultado, setResultado] = useState(null);

  function analisar(sql) {
    setSqlAnalisado(sql);
    setResultado(processarConsulta(sql));
  }

  const valido = resultado?.ok;

  const usosHeuristica = (codigo) =>
    valido
      ? resultado.plano.passos.flatMap((p) => p.heuristicas).filter((h) => h.codigo === codigo).length
      : 0;

  return (
    <div className="aplicacao">
      <header className="cabecalho">
        <h1>Processador de Consultas</h1>
        <p className="subtitulo">
          Valida uma consulta SQL contra o modelo relacional, converte para álgebra relacional,
          otimiza com heurísticas e mostra o grafo de operadores e o plano de execução. Cada bloco
          indica a história de usuário (HU) que ele atende.
        </p>
      </header>

      <section className="cartao">
        <header className="cartao-cabecalho">
          <h2>1. Consulta SQL</h2>
          <span className="etiqueta-hu">HU1</span>
        </header>
        <p className="descricao">
          Comandos aceitos: <code>SELECT</code>, <code>FROM</code>, <code>WHERE</code>,{' '}
          <code>JOIN</code>, <code>ON</code>. Operadores: <code>=</code> <code>&gt;</code>{' '}
          <code>&lt;</code> <code>&lt;=</code> <code>&gt;=</code> <code>&lt;&gt;</code>{' '}
          <code>AND</code> e parênteses.
        </p>
        <EntradaConsulta onAnalisar={analisar} />
        {resultado && <ResultadoValidacao sql={sqlAnalisado} resultado={resultado} />}
      </section>

      {valido && (
        <>
          <section className="cartao">
            <header className="cartao-cabecalho">
              <h2>2. Álgebra relacional</h2>
              <span className="etiqueta-hu">HU2</span>
            </header>
            <ExpressaoAlgebra arvore={resultado.arvoreOriginal} />
          </section>

          <section className="cartao">
            <header className="cartao-cabecalho">
              <h2>3. Grafo de operadores (não otimizado)</h2>
              <span className="etiqueta-hu">HU3</span>
            </header>
            <GrafoOperadores arvore={resultado.arvoreOriginal} />
          </section>

          <section className="cartao">
            <header className="cartao-cabecalho">
              <h2>4. Consulta otimizada</h2>
              <span className="etiqueta-hu">HU4</span>
            </header>
            <ul className="lista-heuristicas">
              {HEURISTICAS.map((h) => (
                <li key={h.codigo} className={usosHeuristica(h.codigo) > 0 ? 'aplicada' : ''}>
                  <span className="codigo-heuristica">{h.codigo}</span> {h.texto}
                  <small>
                    {usosHeuristica(h.codigo) > 0
                      ? `aplicada ${usosHeuristica(h.codigo)}×`
                      : 'não se aplica a esta consulta'}
                  </small>
                </li>
              ))}
            </ul>
            <h3 className="subtitulo-cartao">Álgebra relacional otimizada</h3>
            <ExpressaoAlgebra arvore={resultado.arvoreOtimizada} />
            <h3 className="subtitulo-cartao">Grafo de operadores otimizado</h3>
            <GrafoOperadores
              arvore={resultado.arvoreOtimizada}
              numeroDoNo={resultado.plano.numeroDoNo}
            />
          </section>

          <section className="cartao">
            <header className="cartao-cabecalho">
              <h2>5. Plano de execução</h2>
              <span className="etiqueta-hu">HU5</span>
            </header>
            <p className="descricao">
              Ordem em que o banco executaria a consulta, seguindo o grafo otimizado de baixo para
              cima: um operador só roda depois que os resultados que chegam a ele estão prontos.
            </p>
            <PlanoExecucao plano={resultado.plano} />
          </section>
        </>
      )}
    </div>
  );
}
