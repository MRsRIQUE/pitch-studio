"use client";

/* ============================================================
   COPIAR TEXTO — com o caminho de volta

   `navigator.clipboard.writeText` só existe em contexto seguro e com a
   aba em foco; na casca desktop (Tauri) e em alguns webviews ele
   rejeita ou nem existe, e a cópia falhava em silêncio. Quando ele
   falha, o texto vai por um `textarea` fora da tela e `execCommand`,
   que continua funcionando onde a API nova não chega.
   ============================================================ */

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* cai no caminho antigo */
  }
  try {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.top = "-1000px";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    campo.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}
