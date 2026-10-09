"use client";

/* ============================================================
   TENDÊNCIAS — a tela (passo 4.1: importar)

   Casca igual à de `/quentes` e `/estilos` (`flex-1 overflow-y-auto` +
   coluna de 1310px). Dois blocos: o cartão de importação e a grade do que
   já entrou.

   Importação, pelas decisões do roadmap:
   - o campo de link fica SEMPRE visível. Sem yt-dlp, colar um link mostra
     na hora a mensagem que manda instalar ou enviar o mp4 — nada some,
     nada vira erro genérico;
   - o mp4 sobe por `/api/upload-video` (o mesmo caminho de sempre) e só
     então vira tendência;
   - o botão nomeia o que falta (padrão da Orior, §9 da nota): "Confirme o
     direito de uso", "Cole um link ou escolha um arquivo".

   O player usa `controlsList="nodownload"`: a referência existe para
   derivar, não para ser baixada de volta.
   ============================================================ */

import * as React from "react";
import {
  MENSAGEM_YTDLP_AUSENTE,
  origemDoLink,
  type ListaTendencias,
  type RespostaImportacao,
  type Tendencia,
} from "@/lib/tendencias/tipos";
import "./tendencias.css";

const ROTULO_ORIGEM: Record<Tendencia["origem"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  upload: "Arquivo enviado",
};

const ROTULO_STATUS: Record<Tendencia["status"], string> = {
  importada: "Importada",
  fatiando: "Fatiando",
  analisando: "Analisando",
  pronta: "Pronta",
  erro: "Erro",
};

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function duracao(s: number | null) {
  if (s == null) return null;
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

async function lerErro(res: Response) {
  const corpo = (await res.json().catch(() => ({}))) as { error?: string };
  return corpo.error || `Falha (${res.status}).`;
}

async function pedirLista(): Promise<{ ok: true; lista: ListaTendencias } | { ok: false; erro: string }> {
  try {
    const res = await fetch("/api/tendencias", { cache: "no-store" });
    if (!res.ok) return { ok: false, erro: await lerErro(res) };
    return { ok: true, lista: (await res.json()) as ListaTendencias };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export function TendenciasPage() {
  const [lista, setLista] = React.useState<ListaTendencias | null>(null);
  const [erroLista, setErroLista] = React.useState<string | null>(null);
  const [link, setLink] = React.useState("");
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [direito, setDireito] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [aviso, setAviso] = React.useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [removendo, setRemovendo] = React.useState<string | null>(null);
  const inputArquivo = React.useRef<HTMLInputElement>(null);

  const aplicar = React.useCallback((r: { ok: true; lista: ListaTendencias } | { ok: false; erro: string }) => {
    if (r.ok) { setLista(r.lista); setErroLista(null); }
    else setErroLista(r.erro);
  }, []);

  const carregar = React.useCallback(async () => aplicar(await pedirLista()), [aplicar]);

  React.useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await pedirLista();
      if (vivo) aplicar(r);
    })();
    return () => { vivo = false; };
  }, [aplicar]);

  const linkLimpo = link.trim();
  const origemLink = linkLimpo ? origemDoLink(linkLimpo) : null;
  const semYtdlp = lista !== null && !lista.ytdlp.disponivel;
  // A mensagem aparece no ato de colar, antes de qualquer clique.
  const avisoLink = !linkLimpo
    ? null
    : !origemLink
      ? "Cole um link público do TikTok ou do Instagram."
      : semYtdlp
        ? MENSAGEM_YTDLP_AUSENTE
        : null;

  const bloqueio = !linkLimpo && !arquivo
    ? "Cole um link ou escolha um arquivo"
    : linkLimpo && avisoLink
      ? (origemLink ? "Envie o arquivo mp4" : "Link não reconhecido")
      : !direito
        ? "Confirme o direito de uso"
        : null;

  function escolherArquivo(f: File | null) {
    setArquivo(f);
    if (f) setLink("");
    setAviso(null);
  }

  async function importar() {
    if (bloqueio || enviando) return;
    setEnviando(true);
    setAviso(null);
    try {
      let corpo: { url?: string; videoUrl?: string; direitoConfirmado: true };
      if (arquivo) {
        const up = await fetch("/api/upload-video", {
          method: "POST",
          headers: { "Content-Type": arquivo.type || "video/mp4" },
          body: arquivo,
        });
        // `/api/upload-video` devolve o log inteiro do ffmpeg quando o arquivo não abre.
        if (up.status === 413) throw new Error("O arquivo passa de 100 MB.");
        if (!up.ok) throw new Error("Não foi possível enviar esse arquivo. Confira se é um vídeo mp4 legível.");
        const { cdnUrl } = (await up.json()) as { cdnUrl: string };
        corpo = { videoUrl: cdnUrl, direitoConfirmado: true };
      } else {
        corpo = { url: linkLimpo, direitoConfirmado: true };
      }
      const res = await fetch("/api/tendencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!res.ok) throw new Error(await lerErro(res));
      const { jaExistia } = (await res.json()) as RespostaImportacao;
      setAviso({ tipo: "ok", texto: jaExistia ? "Esse post já estava importado." : "Tendência importada." });
      setLink("");
      setArquivo(null);
      setDireito(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
      await carregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnviando(false);
    }
  }

  async function remover(id: string) {
    if (removendo !== id) { setRemovendo(id); return; }
    setRemovendo(null);
    const res = await fetch(`/api/tendencias?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) setAviso({ tipo: "erro", texto: await lerErro(res) });
    await carregar();
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="td-page">
        <header className="td-header">
          <h1 className="td-title">Tendências</h1>
          <p className="td-sub">
            Traga um post que já performou. Ele fica só no seu acervo local, para derivar estrutura e
            movimento — nunca para ser republicado.
          </p>
        </header>

        <section className="td-import" aria-label="Importar tendência">
          <label className="td-field">
            <span className="td-label">Link do TikTok ou Instagram</span>
            <input
              className="td-input"
              type="url"
              inputMode="url"
              placeholder="Cole o link público do vídeo"
              value={link}
              disabled={enviando}
              onChange={e => { setLink(e.target.value); if (e.target.value) setArquivo(null); setAviso(null); }}
            />
          </label>
          {avisoLink && <p className="td-hint td-hint--alerta" role="status">{avisoLink}</p>}

          <div className="td-ou">ou</div>

          <div className="td-field">
            <span className="td-label">Arquivo de vídeo</span>
            <div className="td-arquivo">
              <button type="button" className="td-btn" disabled={enviando} onClick={() => inputArquivo.current?.click()}>
                Escolher mp4
              </button>
              <span className="td-arquivo__nome">{arquivo ? arquivo.name : "Nenhum arquivo escolhido"}</span>
              <input
                ref={inputArquivo}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                hidden
                onChange={e => escolherArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <label className="td-direito">
            <input type="checkbox" checked={direito} disabled={enviando} onChange={e => setDireito(e.target.checked)} />
            <span>Tenho o direito de usar este vídeo.</span>
          </label>

          <div className="td-acoes">
            <button type="button" className="td-btn td-btn--primario" disabled={!!bloqueio || enviando} onClick={importar}>
              {enviando ? (arquivo ? "Enviando…" : "Baixando…") : bloqueio ?? "Importar"}
            </button>
            {aviso && <p className={`td-hint ${aviso.tipo === "erro" ? "td-hint--erro" : "td-hint--ok"}`} role="status">{aviso.texto}</p>}
          </div>
        </section>

        <section className="td-lista" aria-label="Tendências importadas">
          {erroLista && <p className="td-hint td-hint--erro">{erroLista}</p>}
          {lista && lista.tendencias.length === 0 && (
            <p className="td-vazio">Nenhuma tendência ainda. Importe o primeiro post acima.</p>
          )}
          <div className="td-grade">
            {lista?.tendencias.map(t => {
              const m = t.metricas;
              const metricas = [
                m.views != null && `${compacto.format(m.views)} views`,
                m.likes != null && `${compacto.format(m.likes)} likes`,
                m.comentarios != null && `${compacto.format(m.comentarios)} comentários`,
                m.compartilhamentos != null && `${compacto.format(m.compartilhamentos)} compart.`,
              ].filter(Boolean) as string[];
              return (
                <article key={t.id} className="td-card">
                  <video className="td-card__video" src={t.videoUrl} controls controlsList="nodownload" preload="metadata" playsInline />
                  <div className="td-card__corpo">
                    <div className="td-card__linha">
                      <span className="td-chip">{ROTULO_ORIGEM[t.origem]}</span>
                      <span className={`td-chip td-chip--${t.status}`}>{ROTULO_STATUS[t.status]}</span>
                      {duracao(t.duracao) && <span className="td-card__meta">{duracao(t.duracao)}</span>}
                    </div>
                    {t.handle && <p className="td-card__handle">@{t.handle}</p>}
                    {t.legenda && <p className="td-card__legenda">{t.legenda}</p>}
                    {metricas.length > 0 && <p className="td-card__meta">{metricas.join(" · ")}</p>}
                    {t.erro && <p className="td-hint td-hint--erro">{t.erro}</p>}
                    <div className="td-card__rodape">
                      {t.linkOrigem && (
                        <a className="td-card__link" href={t.linkOrigem} target="_blank" rel="noreferrer">Ver post original</a>
                      )}
                      <button type="button" className="td-btn td-btn--pequeno" onClick={() => remover(t.id)} onBlur={() => setRemovendo(null)}>
                        {removendo === t.id ? "Confirmar remoção" : "Remover"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
