import { expressaoEmPartes } from '../core/algebra.js';

/**
 * HU2 — expressão em álgebra relacional, com os parâmetros de σ, π e ⋈ em
 * subscrito, como na notação dos livros.
 */
export default function ExpressaoAlgebra({ arvore }) {
  return (
    <p className="expressao-algebra">
      {expressaoEmPartes(arvore).map((parte, i) =>
        parte.subscrito ? <sub key={i}>{parte.texto}</sub> : <span key={i}>{parte.texto}</span>
      )}
    </p>
  );
}
