import { useState } from 'react';

/**
 * HU1 — "Interface gráfica com campo de texto e botão Analisar".
 */
export default function EntradaConsulta({ onAnalisar }) {
  const [sql, setSql] = useState('');

  function analisar(evento) {
    evento.preventDefault();
    if (sql.trim() === '') return;
    onAnalisar(sql);
  }

  return (
    <form onSubmit={analisar}>
      <textarea
        className="campo-sql"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={5}
        spellCheck={false}
        placeholder={
          'SELECT Cliente.Nome, Pedido.DataPedido\n' +
          'FROM Cliente\n' +
          'JOIN Pedido ON Cliente.idCliente = Pedido.Cliente_idCliente\n' +
          'WHERE Pedido.ValorTotalPedido > 100'
        }
      />
      <div className="linha-acoes">
        <button type="submit" className="botao-primario" disabled={sql.trim() === ''}>
          Analisar
        </button>
      </div>
    </form>
  );
}
