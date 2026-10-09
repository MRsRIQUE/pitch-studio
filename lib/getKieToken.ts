/**
 * A chave da kie.ai é do servidor do Studio (`KIE_API_KEY`), nunca do usuário:
 * quem paga a geração é o SaySell e o usuário paga em créditos do plano.
 * Os argumentos são ignorados — mantidos para as chamadas antigas não mudarem.
 */
function serverKey(): string | null {
  const key = process.env.KIE_API_KEY?.trim() ?? "";
  if (!key || key === "your_kie_api_key_here") return null;
  return key;
}

export async function getKieTokenForUser(..._args: unknown[]): Promise<string | null> {
  return serverKey();
}

export async function getKieToken(..._args: unknown[]): Promise<string | null> {
  return serverKey();
}
