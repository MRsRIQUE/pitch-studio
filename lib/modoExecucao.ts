/**
 * O modo de execução — a pílula nº 4 da barra do composer.
 *
 * `lib/generationGate.ts` responde outra pergunta ("a geração está
 * bloqueada?") e não é meu para estender, então a preferência mora aqui.
 *
 * As duas opções são as da referência, com o mesmo significado:
 *   auto      — gera direto, sem confirmar (é o padrão do Miora)
 *   confirmar — mostra o cartão de parâmetros e espera o aval
 *
 * Num app que gasta crédito por geração, é aqui que mora a diferença entre
 * "o usuário aprova cada gasto" e "o app gasta sozinho". Por isso o valor é
 * persistido: quem escolheu confirmar não quer reescolher a cada carga.
 */

export type ModoExecucao = "auto" | "confirmar";

const CHAVE = "pitch-modo-execucao";

export function lerModoExecucao(): ModoExecucao {
  try {
    return localStorage.getItem(CHAVE) === "confirmar" ? "confirmar" : "auto";
  } catch {
    return "auto";
  }
}

export function gravarModoExecucao(modo: ModoExecucao): void {
  try {
    localStorage.setItem(CHAVE, modo);
  } catch {
    /* modo privado do navegador: a escolha vale só para esta sessão */
  }
}

/* Os rótulos da referência são `Auto` e `Ask` — quatro e três letras,
   e é por isso que a pílula dela cabe em 83px. "Direto" e "Confirmar"
   empurravam a barra do painel para 89 e 11px além do que cabe, o que
   fazia o flex esmagar os botões de ícone de 24 para 16. */
export const ROTULO_MODO: Record<ModoExecucao, string> = {
  auto: "Auto",
  confirmar: "Pedir",
};

/** O texto do tooltip, que na referência muda junto com o estado. */
export const TOOLTIP_MODO: Record<ModoExecucao, string> = {
  auto: "Atual: geração direta (gera sem confirmar)",
  confirmar: "Atual: geração confirmada (revisa os parâmetros antes)",
};

/** A descrição longa de cada opção, mostrada no cartão de confirmação. */
export const DESCRICAO_MODO: Record<ModoExecucao, string> = {
  auto: "Pula o cartão de confirmação e gera direto.",
  confirmar: "Mostra os parâmetros da geração e espera a sua confirmação.",
};
