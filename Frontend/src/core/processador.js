import { analisarLexico } from './lexico.js';
import { analisarSintaxe } from './sintatico.js';
import { analisarSemantica } from './semantico.js';
import { construirArvoreOriginal } from './algebra.js';
import { otimizar } from './otimizador.js';
import { gerarPlano } from './plano.js';
import { ErroConsulta } from './erros.js';

/**
 * Pipeline completo do processador de consultas ("Funcionamento" do enunciado):
 *
 *   SQL -> tokens (léxico) -> AST (sintático) -> consulta validada (semântico)  HU1
 *       -> árvore de álgebra relacional original                                HU2 / HU3
 *       -> árvore otimizada pelas heurísticas                                   HU4
 *       -> plano de execução ordenado                                           HU5
 *
 * Qualquer erro sintático ou semântico interrompe o pipeline e é devolvido
 * para a interface exibir; erros inesperados (bugs) continuam sendo lançados.
 */
export function processarConsulta(sql) {
  try {
    const tokens = analisarLexico(sql);
    const ast = analisarSintaxe(tokens);
    const consulta = analisarSemantica(ast);
    const arvoreOriginal = construirArvoreOriginal(consulta);
    const arvoreOtimizada = otimizar(consulta);
    const plano = gerarPlano(arvoreOtimizada);
    return { ok: true, tokens, consulta, arvoreOriginal, arvoreOtimizada, plano };
  } catch (erro) {
    if (erro instanceof ErroConsulta) return { ok: false, erro };
    throw erro;
  }
}
