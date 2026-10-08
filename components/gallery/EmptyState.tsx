"use client";

/* ============================================================
   ESTADO VAZIO DO ACERVO — bloco 07

   A caixa inteira é literal do `<style>` do `preview.html`:

     .empty{display:flex;height:160px;flex-direction:column;
            align-items:center;justify-content:center;gap:8px;
            text-align:center}
     .empty__title{font-size:13px;color:--mio-color-text-secondary}
     .empty__desc {font-size:11px;color:--mio-color-text-placeholder}

   Duas linhas de texto, mais nada: sem ícone, sem ilustração e sem
   botão. O `INFO.md` chama isso de tese do produto — a frase
   `assets.emptyDescription` diz que o conteúdo aparece sozinho, e é
   por isso que **não existe passo de salvar** e nem CTA aqui.

   Entra sem animação: no bloco 07 esta tela não tem keyframe nenhum.

   **O fundo animado é uma decisão do usuário, posterior ao bloco.** O orbe da
   nota portada (`components/notas/`) entra atrás do texto, em camada discreta:
   opacidade 0.14, desfoque de 18px e máscara radial que descarta a moldura
   preta do shader. Com `prefers-reduced-motion` ele não é montado. O contraste
   do texto por cima foi medido depois de posto — está no relatório da leva 9.

   O que estava aqui antes — ícone, leque de vídeos e o link
   "Começar a criar" — é herança do HeliosGen e não tem contrapartida
   no bloco 07. Saiu.
   ============================================================ */

import { FundoOrbe } from "@/components/notas/FundoOrbe";
import "@/app/gallery/acervo.css";

export function EmptyState() {
  return (
    <div className="acervo-lista">
      {/* `position: relative` só aqui: a caixa de 160px do bloco continua
          exatamente com as medidas dela; o que muda é ela passar a ser a
          referência do fundo absoluto. */}
      <div className="acervo-vazio" style={{ position: "relative" }}>
        <FundoOrbe />
        {/* `assets.emptyTitle` / `assets.emptyDescription`, traduzidos
            com comprimento parecido para a caixa não mudar de altura. */}
        <div className="acervo-vazio-titulo" style={{ position: "relative" }}>Nenhum item</div>
        <div className="acervo-vazio-desc" style={{ position: "relative" }}>
          O conteúdo enviado ou gerado aparece aqui automaticamente
        </div>
      </div>
    </div>
  );
}
