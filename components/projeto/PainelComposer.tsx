"use client";

/* ============================================================
   O COMPOSER DO PAINEL

   É o mesmo `ComposerShell` do bloco 03 — o contrato de props está
   congelado e o `/chat` depende dele —, com a geometria do painel:
   336 de largura e 160 de altura, contra os 996/206 da Home. Toda a
   diferença vive em `painel.css`, na classe `pj-composer`.

   A barra de baixo segue a ordem da referência, da esquerda para a
   direita: anexar · especialista · conectores · modo de execução ·
   agente | melhorar · ditado · enviar.

   ── O anexo mudou de destino ──
   Até aqui o arquivo anexado ia DIRETO para o canvas, como artefato.
   Agora ele entra no CHAT: fica na bandeja acima do campo, com um
   rótulo (`@foto 1`), e vai junto da mensagem para o agente ver. Quem
   decide se ele vira nó é o agente (`usar_anexo`) — ou o usuário, pelo
   botão do chip. O caminho antigo continua existindo, mas como escolha.

   ── O `@` ──
   Digitar `@` abre o menu de referências: os anexos da conversa e os
   estilos ligados. É o referenciador que o texto usa para dizer ao
   agente "@foto 1 é o relógio, @foto 2 o personagem".
   ============================================================ */

import * as React from "react";
import Link from "next/link";
import { Check, ImagePlus, Sparkles, X } from "@/components/icones";
import { useProjetoSessao, type Anexo, type TipoArtefato } from "@/lib/projetoSessao";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposerShell } from "@/components/gallery/Composer/ComposerShell";
import {
  ComposerIconButton,
  IconAttach,
  IconPolish,
} from "@/components/gallery/Composer/ComposerControls";
import { BotaoConectores } from "@/components/gallery/Composer/BotaoConectores";
import { PilulaModoExecucao } from "@/components/gallery/Composer/PilulaModoExecucao";
import { BotaoDitado } from "@/components/gallery/Composer/BotaoDitado";
import { usePolishPrompt } from "@/components/gallery/Composer/usePolishPrompt";
import { useChatSessionStore } from "@/lib/chatSessionStore";
import { useEstilosStore } from "@/lib/estilosStore";
import { CHAT_MODEL_GROUPS as MODEL_GROUPS } from "@/lib/models";
import {
  lerModoExecucao,
  gravarModoExecucao,
  type ModoExecucao,
} from "@/lib/modoExecucao";
import "@/components/projeto/painel.css";

const EVENTO_MODO = "pitch-modo-execucao";

function assinarModo(avisar: () => void): () => void {
  window.addEventListener(EVENTO_MODO, avisar);
  return () => window.removeEventListener(EVENTO_MODO, avisar);
}

/** O ícone de caixa de ferramentas do botão 2 (`select specialist`). */
function IconeEspecialista() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 15h4" />
      <path d="m14.817 10.995-.971-1.45 1.034-1.232a2 2 0 0 0-2.025-3.238l-1.82.364L9.91 3.885a2 2 0 0 0-3.625.748L6.141 6.55l-1.725.426a2 2 0 0 0-.19 3.756l.657.27" />
      <path d="m18.822 10.995 2.26-5.38a1 1 0 0 0-.557-1.318L16.954 2.9a1 1 0 0 0-1.281.533l-.924 2.122" />
      <path d="M4 12.006A1 1 0 0 1 4.994 11H19a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  );
}

/* ── Medir o arquivo antes de subir ───────────────────────────
   A geometria vem do próprio arquivo: é com ela que o chip, a bolha e
   o nó (quando virar nó) nascem no tamanho certo. */
function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

function medirImagem(src: string): Promise<{ w: number; h: number }> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => ok({ w: 1024, h: 1024 });
    img.src = src;
  });
}

function medirVideo(src: string): Promise<{ w: number; h: number }> {
  return new Promise((ok) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => ok({ w: v.videoWidth || 1280, h: v.videoHeight || 720 });
    v.onerror = () => ok({ w: 1280, h: 720 });
    v.src = src;
  });
}

/** Um item do menu do `@`: um anexo da conversa ou um estilo ligado. */
type ItemMencao =
  | { tipo: "anexo"; anexo: Anexo }
  | { tipo: "estilo"; id: string; nome: string };

/** O `@` que o caret está completando, se houver. */
function acharMencao(texto: string, caret: number): { inicio: number; consulta: string } | null {
  const antes = texto.slice(0, caret);
  const arroba = antes.lastIndexOf("@");
  if (arroba < 0) return null;
  /* Só conta como menção quando o `@` abre uma palavra e o que vem
     depois cabe num rótulo (`foto 12`): sem quebra de linha e curto. */
  if (arroba > 0 && !/\s/.test(antes[arroba - 1])) return null;
  const consulta = antes.slice(arroba + 1);
  if (consulta.length > 24 || /[\n@]/.test(consulta)) return null;
  return { inicio: arroba, consulta };
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function PainelComposer({
  projetoId,
  valor,
  onChange,
  onEnviar,
  ocupado,
  aoAbrirAjustes,
}: {
  projetoId: string;
  valor: string;
  onChange: (v: string) => void;
  onEnviar: () => void;
  ocupado: boolean;
  aoAbrirAjustes: () => void;
}) {
  const { preferredModel, setPreferredModel } = useChatSessionStore();
  const estilos = useEstilosStore((s) => s.estilos);
  const marcarAplicado = useEstilosStore((s) => s.markApplied);
  const polish = usePolishPrompt({ onChange, model: preferredModel });

  /* A preferência vive no `localStorage`, que é uma leitura do
     navegador e não estado do React: no servidor não existe. O
     `useSyncExternalStore` devolve o valor neutro na renderização do
     servidor e o verdadeiro na hidratação, sem um render extra. */
  const modo = React.useSyncExternalStore(assinarModo, lerModoExecucao, () => "auto" as ModoExecucao);

  const agente = MODEL_GROUPS.flatMap((g) => g.models).find((m) => m.id === preferredModel);
  const ligados = estilos.filter((e) => e.enabled);

  /* ── A bandeja ── */
  const referencias = useProjetoSessao((e) => e.sessoes[projetoId]?.referencias);
  const bandejaIds = useProjetoSessao((e) => e.sessoes[projetoId]?.bandeja);
  const anexarNaSessao = useProjetoSessao((e) => e.anexar);
  const desanexar = useProjetoSessao((e) => e.desanexar);
  const atualizarAnexo = useProjetoSessao((e) => e.atualizarAnexo);
  const abrirArtefato = useProjetoSessao((e) => e.abrirArtefato);

  const bandeja = React.useMemo(
    () => (bandejaIds ?? []).map((id) => referencias?.[id]).filter((a): a is Anexo => !!a),
    [bandejaIds, referencias],
  );
  const todasReferencias = React.useMemo(
    () => Object.values(referencias ?? {}).sort((a, b) => a.em - b.em),
    [referencias],
  );

  const arquivoRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [subindo, setSubindo] = React.useState(0);
  const [arrastando, setArrastando] = React.useState(false);

  /* O arquivo sobe e entra na BANDEJA — não no canvas. O upload vira URL
     durável; quando o armazenamento recusa (nesta máquina o `/api/upload`
     já devolveu 500 com o `sharp` mal instalado), o anexo fica com o
     `data:` do próprio arquivo, só nesta sessão. O limite existe porque o
     `data:` vai para o `localStorage` junto com a sessão. */
  const anexar = React.useCallback(async (arquivo: File) => {
    const ehVideo = arquivo.type.startsWith("video/");
    if (!ehVideo && !arquivo.type.startsWith("image/")) return;

    setSubindo((n) => n + 1);
    try {
      const dataUrl = await lerComoDataUrl(arquivo);
      const medida = ehVideo ? await medirVideo(dataUrl) : await medirImagem(dataUrl);

      const LIMITE_SEM_UPLOAD = 512 * 1024;
      let url = "";
      let duravel = false;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, folder: "uploads", mimeType: arquivo.type }),
        });
        const j = await res.json();
        if (!res.ok || !j.cdnUrl) throw new Error(j.error ?? "upload recusado");
        url = j.cdnUrl;
        duravel = true;
      } catch (falhaUpload) {
        if (arquivo.size > LIMITE_SEM_UPLOAD) throw falhaUpload;
        console.warn("[projeto] upload recusado; o anexo fica só nesta sessão:", falhaUpload);
        url = dataUrl;
      }

      anexarNaSessao(projetoId, {
        tipo: ehVideo ? "video" : "imagem",
        url,
        duravel,
        largura: medida.w,
        altura: medida.h,
        nome: arquivo.name,
      });
    } catch (err) {
      console.error("[projeto] falha ao anexar:", err);
    } finally {
      setSubindo((n) => n - 1);
    }
  }, [projetoId, anexarNaSessao]);

  const anexarVarios = React.useCallback((lista: FileList | File[] | null | undefined) => {
    if (!lista) return;
    for (const f of Array.from(lista)) void anexar(f);
  }, [anexar]);

  /* Colar uma imagem no campo é o jeito mais rápido de mandar um print. */
  React.useEffect(() => {
    const campo = textareaRef.current;
    if (!campo) return;
    const aoColar = (e: ClipboardEvent) => {
      const arquivos = Array.from(e.clipboardData?.files ?? []).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (arquivos.length === 0) return;
      e.preventDefault();
      anexarVarios(arquivos);
    };
    campo.addEventListener("paste", aoColar);
    return () => campo.removeEventListener("paste", aoColar);
  }, [anexarVarios]);

  /* O chip pode mandar o anexo para o canvas na hora — é o caminho que
     o botão de anexar fazia sozinho até aqui, agora como escolha. */
  const porNoCanvas = React.useCallback((a: Anexo) => {
    if (a.noId) return;
    const tipo: TipoArtefato = a.tipo === "video" ? "video" : "imagem";
    abrirArtefato(projetoId, {
      id: a.id,
      tipo,
      estado: "pronto",
      largura: a.largura,
      altura: a.altura,
      x: 862,
      y: 190,
      url: a.url,
      duravel: a.duravel,
      origem: "anexo",
    });
    atualizarAnexo(projetoId, a.id, { noId: a.id });
  }, [projetoId, abrirArtefato, atualizarAnexo]);

  /* ── O menu do `@` ── */
  const [mencao, setMencao] = React.useState<{ inicio: number; consulta: string } | null>(null);
  const [ativo, setAtivo] = React.useState(0);

  const itens = React.useMemo<ItemMencao[]>(() => {
    if (!mencao) return [];
    const q = normalizar(mencao.consulta);
    const anexos: ItemMencao[] = todasReferencias
      .filter((a) => !q || normalizar(a.rotulo).startsWith(q) || normalizar(a.nome ?? "").includes(q))
      .map((anexo) => ({ tipo: "anexo", anexo }));
    const est: ItemMencao[] = ligados
      .filter((e) => !q || normalizar(e.name).includes(q))
      .map((e) => ({ tipo: "estilo", id: e.id, nome: e.name }));
    return [...anexos, ...est].slice(0, 12);
  }, [mencao, todasReferencias, ligados]);

  const aoMudar = (v: string) => {
    onChange(v);
    const caret = textareaRef.current?.selectionStart ?? v.length;
    setMencao(acharMencao(v, caret));
    /* A lista muda a cada tecla; o destaque volta ao primeiro item. */
    setAtivo(0);
  };
  /* O destaque nunca aponta para fora da lista, mesmo que ela encolha. */
  const indiceAtivo = itens.length ? Math.min(ativo, itens.length - 1) : 0;

  const inserirMencao = React.useCallback((item: ItemMencao) => {
    if (!mencao) return;
    const campo = textareaRef.current;
    const caret = campo?.selectionStart ?? valor.length;
    const rotulo = item.tipo === "anexo" ? item.anexo.rotulo : item.nome;
    const antes = valor.slice(0, mencao.inicio);
    const depois = valor.slice(caret);
    const inserido = `@${rotulo} `;
    onChange(`${antes}${inserido}${depois}`);
    if (item.tipo === "estilo") marcarAplicado(item.id);
    setMencao(null);
    /* O caret vai para depois da menção, no próximo quadro — o valor
       controlado ainda não chegou ao DOM neste. */
    const pos = antes.length + inserido.length;
    requestAnimationFrame(() => {
      campo?.focus();
      campo?.setSelectionRange(pos, pos);
    });
  }, [mencao, valor, onChange, marcarAplicado]);

  const aoTecla = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mencao || itens.length === 0) {
      if (e.key === "Escape" && mencao) setMencao(null);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((indiceAtivo + 1) % itens.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((indiceAtivo - 1 + itens.length) % itens.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      inserirMencao(itens[indiceAtivo]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMencao(null);
    }
  };

  const podeEnviar = valor.trim().length > 0 || bandeja.length > 0;

  /* ── O destaque das menções dentro do campo ─────────────────
     O texto do `textarea` fica transparente e quem se vê é a camada
     por cima, que redesenha o mesmo texto com `@foto 1` e `@Estilo`
     virados chip. As duas camadas dividem a métrica (fonte, altura de
     linha, largura) em `painel.css`, e o scroll é copiado do campo para
     a camada, senão a segunda linha do chip descola do cursor. */
  const overlayRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const campo = textareaRef.current;
    const camada = overlayRef.current;
    if (!campo || !camada) return;
    const sincronizar = () => { camada.style.transform = `translateY(${-campo.scrollTop}px)`; };
    sincronizar();
    campo.addEventListener("scroll", sincronizar);
    return () => campo.removeEventListener("scroll", sincronizar);
  }, [valor]);

  const rotulos = React.useMemo(() => {
    const anexos = todasReferencias.map((a) => ({ rotulo: a.rotulo, anexo: a }));
    const est = ligados.map((e) => ({ rotulo: e.name, anexo: null as Anexo | null }));
    /* O mais longo primeiro: `@foto 12` não pode casar como `@foto 1`. */
    return [...anexos, ...est].sort((a, b) => b.rotulo.length - a.rotulo.length);
  }, [todasReferencias, ligados]);

  const textoComChips = React.useMemo<React.ReactNode>(() => {
    if (!valor) return null;
    if (rotulos.length === 0) return valor;
    const partes: React.ReactNode[] = [];
    let resto = valor;
    let chave = 0;
    while (resto.length > 0) {
      let primeiro: { idx: number; item: (typeof rotulos)[number] } | null = null;
      for (const item of rotulos) {
        const idx = resto.indexOf(`@${item.rotulo}`);
        if (idx !== -1 && (primeiro === null || idx < primeiro.idx)) primeiro = { idx, item };
      }
      if (!primeiro) { partes.push(<React.Fragment key={chave++}>{resto}</React.Fragment>); break; }
      if (primeiro.idx > 0) partes.push(<React.Fragment key={chave++}>{resto.slice(0, primeiro.idx)}</React.Fragment>);
      const { item } = primeiro;
      /* O chip NÃO pode mudar a largura do texto: o `textarea` por baixo
         mede `@foto 1` em fonte normal, e é nele que o cursor anda. Nada
         de miniatura inline, padding ou negrito aqui — só cor e fundo,
         que não ocupam espaço. A foto já está no chip da bandeja. */
      partes.push(
        <span
          key={chave++}
          className="pj-overlay-chip"
          data-tipo={item.anexo ? item.anexo.tipo : "estilo"}
        >
          @{item.rotulo}
        </span>,
      );
      resto = resto.slice(primeiro.idx + item.rotulo.length + 1);
    }
    return partes;
  }, [valor, rotulos]);

  return (
    <div
      className="pj-composer-caixa"
      data-arrastando={arrastando ? "true" : undefined}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          setArrastando(true);
        }
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        anexarVarios(e.dataTransfer.files);
      }}
    >
      {mencao && itens.length > 0 && (
        <div className="pj-mencoes" role="listbox" aria-label="Referências">
          <div className="pj-mencoes-titulo">Referenciar</div>
          {itens.map((item, i) => (
            <button
              key={item.tipo === "anexo" ? item.anexo.id : `estilo-${item.id}`}
              type="button"
              role="option"
              aria-selected={i === indiceAtivo}
              className="pj-mencao"
              data-ativa={i === indiceAtivo ? "true" : undefined}
              onMouseEnter={() => setAtivo(i)}
              onMouseDown={(e) => { e.preventDefault(); inserirMencao(item); }}
            >
              {item.tipo === "anexo" ? (
                <>
                  {item.anexo.tipo === "video" ? (
                    <video className="pj-mencao-mini" src={item.anexo.url} muted preload="metadata" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="pj-mencao-mini" src={item.anexo.url} alt="" />
                  )}
                  <span className="pj-mencao-rotulo">@{item.anexo.rotulo}</span>
                  <span className="pj-mencao-detalhe">
                    {item.anexo.noId ? "no canvas" : `${item.anexo.largura}×${item.anexo.altura}`}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span className="pj-mencao-rotulo">@{item.nome}</span>
                  <span className="pj-mencao-detalhe">estilo</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}

    <ComposerShell
      beam
      className="pj-composer"
      value={valor}
      onChange={aoMudar}
      onSubmit={onEnviar}
      disabled={ocupado || !podeEnviar}
      busy={ocupado}
      fieldBusy={polish.polishing}
      placeholder={bandeja.length
        ? "Diga o que fazer com os anexos — use @ para citar cada um…"
        : "Descreva o que você quer criar neste projeto…"}
      maxLength={null}
      submitLabel="Enviar"
      submitOn="mod-enter"
      submitHint={null}
      textareaRef={textareaRef}
      onKeyDown={aoTecla}

      overlay={valor ? (
        <div aria-hidden className="pj-overlay">
          <div ref={overlayRef} className="pj-overlay-inner">{textoComChips}</div>
        </div>
      ) : undefined}

      above={(bandeja.length > 0 || subindo > 0) ? (
        <div className="pj-bandeja" aria-label="Anexos desta mensagem">
          {bandeja.map((a) => (
            <div className="pj-chip" key={a.id} title={a.nome ?? a.rotulo}>
              {a.tipo === "video" ? (
                <video className="pj-chip-mini" src={a.url} muted preload="metadata" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="pj-chip-mini" src={a.url} alt="" />
              )}
              <span className="pj-chip-rotulo">{a.rotulo}</span>
              <button
                type="button"
                className="pj-chip-acao"
                data-feito={a.noId ? "true" : undefined}
                title={a.noId ? "Já está no canvas" : "Colocar no canvas agora"}
                aria-label={a.noId ? "Já está no canvas" : "Colocar no canvas agora"}
                onClick={() => porNoCanvas(a)}
              >
                {a.noId ? <Check size={13} /> : <ImagePlus size={13} />}
              </button>
              <button
                type="button"
                className="pj-chip-acao"
                title="Remover"
                aria-label={`Remover ${a.rotulo}`}
                onClick={() => desanexar(projetoId, a.id)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {subindo > 0 && (
            <div className="pj-chip" data-subindo="true">
              <span className="pj-chip-mini" />
              <span>Enviando…</span>
            </div>
          )}
        </div>
      ) : undefined}

      leading={<>
        {/* Os três de ícone andam juntos, com 8 entre eles, como o
            `icon-group` da referência; do grupo para a pílula são 4. */}
        <span className="pj-grupo-icones">
        {/* 1 — anexar: o arquivo entra na bandeja e vai junto da mensagem */}
        <input
          ref={arquivoRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            anexarVarios(e.target.files);
            e.target.value = "";
          }}
        />
        <ComposerIconButton
          label={subindo ? "Enviando o anexo…" : "Anexar fotos ou vídeos à mensagem"}
          disabled={ocupado}
          open={subindo > 0}
          onClick={() => arquivoRef.current?.click()}
        >
          <IconAttach />
        </ComposerIconButton>

        {/* 2 — especialista: o mesmo painel que a tecla `/` abre. Inserir
            um estilo põe `@Nome` no campo, como na referência. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="pc-icon-btn"
            aria-label="Escolher um estilo"
            title="Escolher um estilo"
            disabled={ocupado}
          >
            <IconeEspecialista />
          </DropdownMenuTrigger>
          {/* `z-[300]` em todos os menus do painel: o portal nasce com
              `z-50` e o painel está em 230 — sem isto o menu abre atrás
              do próprio composer e parece que o botão não faz nada. */}
          <DropdownMenuContent side="top" align="start" sideOffset={10} positionerClassName="z-[300]" className="w-[280px] p-2">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 text-ms-sm font-normal text-ms-text-tertiary">
                Estilos
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {ligados.length === 0 ? (
              <div className="px-2 py-3 text-center text-ms-base text-ms-text-tertiary">
                Nenhum estilo ligado
                {/* Um estado vazio sem saída é um botão morto: daqui vai-se
                    à tela que liga os estilos. */}
                <Link
                  href="/estilos"
                  className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-ms text-ms-base text-ms-text transition-colors hover:bg-ms-bg-hover"
                >
                  <Sparkles size={14} />
                  Gerenciar estilos
                </Link>
              </div>
            ) : ligados.map((e) => (
              <button
                key={e.id}
                type="button"
                className="flex h-8 w-full items-center gap-2 rounded-ms px-2 text-ms-base text-ms-text transition-colors hover:bg-ms-bg-hover"
                onClick={() => {
                  onChange(`${valor.replace(/\/$/, "")}@${e.name} `);
                  marcarAplicado(e.id);
                }}
              >
                <Sparkles size={14} />
                <span className="truncate">{e.name}</span>
              </button>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 3 — conectores: os três provedores, com o estado real da chave */}
        <BotaoConectores aoAbrirAjustes={aoAbrirAjustes} positionerClassName="z-[300]" />
        </span>

        {/* 4 — modo de execução */}
        <PilulaModoExecucao
          valor={modo}
          disabled={ocupado}
          positionerClassName="z-[300]"
          onChange={(m) => {
            gravarModoExecucao(m);
            window.dispatchEvent(new Event(EVENTO_MODO));
          }}
        />

        {/* 5 — agente: quem raciocina. */}
        <DropdownMenu>
          <DropdownMenuTrigger className="pc-pill group" aria-label="Agente" title={agente?.label ?? "Agente"} disabled={ocupado}>
            <span className="max-w-[92px] truncate">{agente?.label ?? "Agente"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={10} positionerClassName="z-[300]" className="max-h-[min(380px,var(--available-height))] w-[min(280px,calc(100vw-24px))] overflow-y-auto p-2">
            <DropdownMenuRadioGroup value={preferredModel} onValueChange={setPreferredModel}>
            {MODEL_GROUPS.map((g) => (
              <DropdownMenuGroup key={g.label}>
                <DropdownMenuLabel className="px-2 text-ms-sm font-normal text-ms-text-tertiary">
                  {g.label}
                </DropdownMenuLabel>
                {g.models.map((m) => (
                  <DropdownMenuRadioItem
                    key={m.id}
                    value={m.id}
                    label={m.label}
                    closeOnClick
                    className="min-h-9 gap-3 py-2 pl-2 pr-8 text-ms-sm text-ms-text"
                  >
                    <span className="min-w-0 flex-1 truncate">{m.label}</span>
                    {/* Onde a referência põe o multiplicador de cobrança,
                        vai o rótulo real do modelo. */}
                    <span className="shrink-0 text-ms-xs text-ms-text-tertiary">{m.desc}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </>}

      trailing={<>
        {/* 6 — melhorar */}
        <ComposerIconButton
          label={polish.polishing ? "Interromper a reescrita" : "Melhorar o prompt"}
          open={polish.polishing}
          disabled={ocupado || (!polish.polishing && valor.trim().length === 0)}
          onClick={() => (polish.polishing ? polish.cancel() : polish.polish(valor))}
        >
          <IconPolish />
        </ComposerIconButton>

        {polish.canUndo && !polish.polishing && (
          <button
            type="button"
            onClick={polish.undo}
            className="h-6 rounded-ms-full px-2 text-ms-sm text-ms-text-secondary transition-colors hover:bg-ms-bg-hover"
          >
            Desfazer
          </button>
        )}

        {/* 7 — ditado */}
        <BotaoDitado
          disabled={ocupado}
          onTexto={(trecho) => onChange(valor ? `${valor} ${trecho}` : trecho)}
        />
      </>}
    />
    </div>
  );
}
