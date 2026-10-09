"use client";

/* ============================================================
   EDITOR DE ESTILO

   Dois campos, porque um estilo tem duas coisas: nome e fragmento. O Miora
   abre um editor de skill com parâmetros, versão e publicação; nada disso tem
   equivalente aqui, e um campo a mais seria um campo vazio para sempre.

   O contador de caracteres é real (mede o que vai para o prompt) e o botão
   salvar fica desativado enquanto faltar nome ou fragmento — não existe estilo
   sem os dois.
   ============================================================ */

import * as React from "react";
import type { Estilo } from "@/lib/estilosStore";

export function EstiloEditor({
  estilo,
  draft,
  onClose,
  onSave,
}: {
  /** `null` cria um estilo novo; um estilo edita o existente. */
  estilo: Estilo | null;
  /** Valores iniciais de uma criação — hoje só o arquivo importado. */
  draft?: { name: string; fragment: string };
  onClose: () => void;
  onSave: (values: { name: string; fragment: string }) => void;
}) {
  const [name, setName] = React.useState(estilo?.name ?? draft?.name ?? "");
  const [fragment, setFragment] = React.useState(estilo?.fragment ?? draft?.fragment ?? "");
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    nameRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const valid = name.trim().length > 0 && fragment.trim().length > 0;

  return (
    <div
      className="est-editor"
      role="dialog"
      aria-modal="true"
      aria-label={estilo ? "Editar estilo" : "Novo estilo"}
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="est-editor__panel"
        onSubmit={event => {
          event.preventDefault();
          if (valid) onSave({ name: name.trim(), fragment: fragment.trim() });
        }}
      >
        <h2>{estilo ? "Editar estilo" : "Novo estilo"}</h2>

        <div className="est-editor__field">
          <label htmlFor="estilo-nome">Nome</label>
          <input
            ref={nameRef}
            id="estilo-nome"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Fotografia editorial"
            maxLength={60}
          />
        </div>

        <div className="est-editor__field">
          <label htmlFor="estilo-fragmento">Fragmento</label>
          <textarea
            id="estilo-fragmento"
            value={fragment}
            onChange={event => setFragment(event.target.value)}
            placeholder="Luz natural difusa, paleta neutra, grão fino de filme, muito espaço negativo…"
          />
          <p className="est-editor__hint">
            {fragment.trim().length} caracteres · este texto é anexado ao fim do prompt no composer.
          </p>
        </div>

        <div className="est-editor__actions">
          <button type="button" className="est-header__action" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="est-header__action est-header__action--primary" disabled={!valid}>
            {estilo ? "Salvar" : "Criar estilo"}
          </button>
        </div>
      </form>
    </div>
  );
}
