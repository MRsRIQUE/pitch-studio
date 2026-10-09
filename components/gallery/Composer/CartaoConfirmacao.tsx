"use client";

/* ============================================================
   O CARTÃO DE CONFIRMAÇÃO DE PARÂMETROS

   É a metade que faltava da pílula nº 4. A referência descreve o cartão
   no i18n — *"Show the parameter confirmation card for image / video /
   3D / UI generation and wait for your confirmation"* — mas não há
   captura dele em `_fonte/estados/`, então a caixa é desenhada com o
   vocabulário do kit, não copiada: superfície branca, raio grande,
   sombra flutuante, e a mesma entrada de 150ms dos popovers do bloco.

   Ele não inventa nenhum parâmetro: a lista que aparece é a mesma
   `paramSummary` que a pílula de parâmetros já resume, mais o modelo e
   a contagem de referências anexadas.
   ============================================================ */

import * as React from "react";
import "@/app/gallery/composer.css";

export function CartaoConfirmacao({
  modelo,
  parametros,
  referencias,
  onConfirmar,
  onCancelar,
}: {
  modelo: string;
  /** Os mesmos valores que a pílula de parâmetros resume. */
  parametros: string[];
  referencias: number;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const cancelarRef = React.useRef<HTMLButtonElement>(null);

  /* O foco vai para "Cancelar", não para "Gerar": quem pediu para
     confirmar antes não quer que um Enter distraído gaste a geração. */
  React.useEffect(() => { cancelarRef.current?.focus(); }, []);

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onCancelar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onCancelar]);

  return (
    <div className="pcx-confirma" role="dialog" aria-label="Confirmar a geração">
      <div className="pcx-confirma-titulo">Confirmar a geração</div>

      <dl className="pcx-confirma-lista">
        <div className="pcx-confirma-linha">
          <dt>Modelo</dt>
          <dd>{modelo}</dd>
        </div>
        {parametros.length > 0 && (
          <div className="pcx-confirma-linha">
            <dt>Parâmetros</dt>
            <dd>{parametros.join(" · ")}</dd>
          </div>
        )}
        {referencias > 0 && (
          <div className="pcx-confirma-linha">
            <dt>Referências</dt>
            <dd>{referencias === 1 ? "1 anexada" : `${referencias} anexadas`}</dd>
          </div>
        )}
      </dl>

      <div className="pcx-confirma-acoes">
        <button ref={cancelarRef} type="button" className="pcx-confirma-btn" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="pcx-confirma-btn pcx-confirma-btn--marca" onClick={onConfirmar}>
          Gerar
        </button>
      </div>
    </div>
  );
}
