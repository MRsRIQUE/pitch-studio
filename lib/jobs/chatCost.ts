/**
 * Débito fixo, em créditos do Studio, por mensagem do Assistente.
 *
 * A kie.ai cobra conversa por token, e o tamanho de cada turno varia com o
 * histórico e as imagens; um valor fixo por mensagem é previsível para o
 * usuário e fica acima do custo típico de cada modelo. ESTIMATIVA — calibrar
 * com a fatura real da kie.ai depois das primeiras semanas.
 *
 * Modelo fora desta tabela não conversa: sem preço, não há débito seguro.
 */
export const CHAT_CREDITS_PER_MESSAGE: Readonly<Record<string, number>> = {
  "gemini-3-flash": 1,
  "gemini-3.1-pro": 4,
  "gpt-5-2": 4,
  "claude-haiku-4-5": 2,
  "claude-sonnet-4-6": 8,
  "claude-opus-4-7": 30,
};

export function chatCredits(model: string): number | null {
  return CHAT_CREDITS_PER_MESSAGE[model] ?? null;
}
