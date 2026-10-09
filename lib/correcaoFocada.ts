/* ============================================================
   CORREÇÃO FOCADA — quando só um detalhe saiu errado

   Um vídeo de 10 segundos custa muito mais do que uma imagem, e o erro
   típico é pequeno: a mão pegou o produto pela tampa, o rótulo ficou de
   costas, apareceu uma segunda garrafa. Reescrever o prompt inteiro
   para isso é jogar fora o que deu certo. A receita UGC faz diferente:
   mantém o prompt e ACRESCENTA um bloco FIX que diz o que preservar e o
   que corrigir.

   Este arquivo é a metade sem tela: recebe o prompt que gerou o vídeo e
   a queixa do usuário, pede ao assistente o prompt corrigido e devolve
   texto. Quem escreve no nó é o popover (`CorrecaoPopover.tsx`).
   ============================================================ */

import { productionAI } from "./productionClient";
import { promptCorrecaoFocada } from "./ugcPromptKit";

/**
 * Devolve o prompt original com o bloco FIX no fim. Tira cerca de código
 * e aspas de fora, que os modelos às vezes põem mesmo proibidos.
 */
export async function gerarCorrecao(promptOriginal: string, queixa: string, modelo: string): Promise<string> {
  const q = queixa.trim();
  if (!q) throw new Error("Diga o que saiu errado.");
  const texto = await productionAI(promptCorrecaoFocada(promptOriginal, q), modelo);
  const limpo = texto
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^["“]+|["”]+$/g, "")
    .trim();
  if (!limpo) throw new Error("O assistente devolveu um prompt vazio. Tente outro modelo.");
  /* Sem o bloco FIX, o modelo reescreveu em vez de corrigir — é o que a
     regra proíbe. Melhor recusar do que trocar o prompt que funcionava. */
  if (!/\bFIX\b/.test(limpo)) throw new Error("O assistente reescreveu o prompt em vez de corrigir. Tente de novo ou troque o modelo.");
  return limpo;
}
