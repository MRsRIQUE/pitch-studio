"use client";

/* ============================================================
   useTypewriter — transcrição do hook `mt()` do bundle da referência
   (`home-chat-input-CY3hUwSR.js`), documentado em
   `miora/sections/03-home-composer/INFO.md`, "truque nº 2".

   O detalhe que importa está em `commonPrefix`: o apagamento NÃO vai
   até zero, para no primeiro caractere em que a frase atual e a
   próxima divergem. Como todas as frases de uma lista costumam
   começar igual, o começo nunca pisca.
   ============================================================ */

import * as React from "react";

/** Comprimento do prefixo comum entre duas frases. O apagamento para aqui. */
export function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
}

export function useTypewriter({
  phrases,
  typingSpeed = 50,
  deletingSpeed = 30,
  pauseAfterType = 1500,
  pauseAfterDelete = 300,
  enabled = true,
}: {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseAfterType?: number;
  pauseAfterDelete?: number;
  enabled?: boolean;
}) {
  const [text, setText] = React.useState("");
  /** A frase inteira em curso — é ela que `Tab` aceita, não o trecho digitado. */
  const [phrase, setPhrase] = React.useState(phrases[0] ?? "");

  const idx = React.useRef(0);
  const chars = React.useRef(0);
  const deleting = React.useRef(false);
  const floor = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* A lista entra na dependência como string: um array literal novo a
     cada render reiniciaria a animação em todo teclado pressionado. */
  const key = phrases.join("|");
  const list = React.useMemo(() => (key ? key.split("|") : []), [key]);

  /* Sem lista, ou com a animação desligada, não há o que animar: o
     valor sai direto no retorno, sem passar por estado. */
  const animate = enabled && list.length > 0;

  React.useEffect(() => {
    if (!animate) return;

    idx.current = 0;
    chars.current = 0;
    deleting.current = false;
    floor.current = 0;

    const step = () => {
      const cur = list[idx.current % list.length];
      const next = list[(idx.current + 1) % list.length];
      setPhrase(cur);

      if (deleting.current) {
        chars.current -= 1;
        setText(cur.slice(0, chars.current));
        if (chars.current <= floor.current) {
          deleting.current = false;
          idx.current = (idx.current + 1) % list.length;
          setPhrase(next);
          timer.current = setTimeout(step, pauseAfterDelete);
          return;
        }
        timer.current = setTimeout(step, deletingSpeed);
      } else {
        chars.current += 1;
        setText(cur.slice(0, chars.current));
        if (chars.current >= cur.length) {
          if (list.length <= 1) return;
          deleting.current = true;
          floor.current = commonPrefix(cur, next);
          timer.current = setTimeout(step, pauseAfterType);
          return;
        }
        timer.current = setTimeout(step, typingSpeed);
      }
    };

    /* O zerar do campo entra no primeiro tique, não no corpo do efeito:
       setState síncrono aqui provocaria um render em cascata a cada
       troca de lista. */
    timer.current = setTimeout(() => {
      setText("");
      setPhrase(list[0]);
      step();
    }, pauseAfterDelete);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [list, animate, typingSpeed, deletingSpeed, pauseAfterType, pauseAfterDelete]);

  if (!animate) {
    const only = list[0] ?? "";
    return { text: only, phrase: only };
  }
  return { text, phrase };
}
