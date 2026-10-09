/* ============================================================
   ANEXOS DA MEMÓRIA

   O cartão de criação do bloco 08 tem três botões: anexar imagem,
   cancelar e salvar. A imagem anexada fica no registro da âncora,
   do mesmo jeito que o texto — e é este arquivo que guarda esse
   registro.

   Por que um store novo em vez de um campo em `folderStore`,
   `store` ou `chatSessionStore`: nenhum dos três é meu, e os três
   sincronizam com o servidor num formato que o backend conhece.
   Acrescentar campo lá dentro mudaria o contrato de outras frentes
   e da API. Aqui o vínculo é local e por id, do lado de fora dos
   três — cada registro é `<origem>:<id do item>`, exatamente a
   chave do nó-âncora no grafo.

   As Gerações não passam por aqui: lá o texto vira prompt e a
   imagem vira imagem de referência, e as duas coisas viajam juntas
   para o composer pelo `remixHandoff`. O anexo acompanha o texto
   até onde o texto for.
   ============================================================ */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AnexosState {
  /** `<origem>:<id>` → URLs devolvidas por `/api/upload`. */
  porAncora: Record<string, string[]>;
  anexar: (chave: string, urls: string[]) => void;
  desanexar: (chave: string) => void;
}

export const useMemoriaAnexos = create<AnexosState>()(
  persist(
    set => ({
      porAncora: {},

      anexar: (chave, urls) =>
        set(s => {
          if (urls.length === 0) return s;
          const atuais = s.porAncora[chave] ?? [];
          return { porAncora: { ...s.porAncora, [chave]: [...atuais, ...urls] } };
        }),

      desanexar: chave =>
        set(s => {
          if (!(chave in s.porAncora)) return s;
          const proximo = { ...s.porAncora };
          delete proximo[chave];
          return { porAncora: proximo };
        }),
    }),
    { name: "pitch-memoria-anexos-v1" },
  ),
);

/** Tipos aceitos hoje pelo seletor de arquivo que alimenta `/api/upload`. */
export const TIPOS_ACEITOS = "image/*";

/**
 * Envia uma imagem para `/api/upload` e devolve a URL durável.
 * Lança em qualquer falha: quem chama mostra o erro: nada de
 * engolir e fingir que anexou.
 */
export async function enviarImagem(arquivo: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error(`Não deu para ler ${arquivo.name}.`));
    leitor.readAsDataURL(arquivo);
  });

  const resposta = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, folder: "uploads", mimeType: arquivo.type }),
  });

  // A rota devolve `{ error }` com 4xx/5xx; a mensagem dela é melhor
  // que um "falhou" genérico, então é ela que sobe.
  const corpo = (await resposta.json().catch(() => null)) as { cdnUrl?: string; error?: string } | null;
  if (!resposta.ok || !corpo?.cdnUrl) {
    throw new Error(corpo?.error || `Falha ao enviar ${arquivo.name}.`);
  }
  return corpo.cdnUrl;
}
