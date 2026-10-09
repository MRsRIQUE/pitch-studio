"use client";

/* ============================================================
   ESCOLHER QUEM APARECE

   A folha que abre por cima do painel quando o usuário manda um produto
   para a cena. Duas coisas só: escolher um personagem que já existe ou
   criar um na hora.

   Criar na hora é o caminho principal, não o secundário: na primeira vez
   que alguém usa isto não existe personagem nenhum, e mandar a pessoa
   para outra tela para cadastrar antes de poder continuar é o jeito mais
   fácil de matar a funcionalidade.

   ── As fotos sobem antes de entrar no store ─────────────────────────
   `POST /api/upload` grava em disco e devolve `/generated/...`. É essa
   URL que vai para o store — nunca o base64. O porquê está no cabeçalho
   de `lib/personagensStore.ts`: o `persist` mora no `localStorage`, e
   duas fotos em base64 estouram o teto dele e derrubam o store inteiro,
   em silêncio.
   ============================================================ */

import * as React from "react";
import { Check, Loader2, Plus, Trash2, User, X } from "lucide-react";
import {
  usePersonagensStore,
  MAX_FOTOS,
  type Personagem,
} from "@/lib/personagensStore";
import "./produtos.css";

async function subirArquivo(arquivo: File): Promise<string | null> {
  const dataUrl = await new Promise<string>((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsDataURL(arquivo);
  });

  const resposta = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, folder: "personagens", mimeType: arquivo.type }),
  });
  if (!resposta.ok) return null;
  const corpo = (await resposta.json()) as { cdnUrl?: string };
  return corpo.cdnUrl ?? null;
}

export function SeletorPersonagem({
  nomeDoProduto,
  montando = false,
  emPagina = false,
  onEscolher,
  onFechar,
}: {
  nomeDoProduto: string;
  /** A montagem grava as fotos em disco antes de criar os nós; enquanto
   *  isso a folha trava, senão dois cliques viram duas cenas. */
  montando?: boolean;
  /** Na tela própria não há painel para cobrir: a folha vira caixa
   *  centrada com véu, em vez de encher a coluna da direita. */
  emPagina?: boolean;
  onEscolher: (personagem: Personagem) => void;
  onFechar: () => void;
}) {
  const personagens = usePersonagensStore((e) => e.personagens);
  const criar = usePersonagensStore((e) => e.criar);
  const adicionarFoto = usePersonagensStore((e) => e.adicionarFoto);
  const removerFoto = usePersonagensStore((e) => e.removerFoto);
  const definirDescricao = usePersonagensStore((e) => e.definirDescricao);
  const remover = usePersonagensStore((e) => e.remover);

  /* Sem ninguém cadastrado o formulário já abre: ver o cabeçalho. */
  const [criando, setCriando] = React.useState(personagens.length === 0);
  const [nome, setNome] = React.useState("");
  const [rascunhoId, setRascunhoId] = React.useState<string | null>(null);
  const [subindo, setSubindo] = React.useState(false);

  const arquivoRef = React.useRef<HTMLInputElement>(null);

  const rascunho = personagens.find((p) => p.id === rascunhoId) ?? null;

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const comecarRascunho = () => {
    if (rascunhoId) return rascunhoId;
    const id = criar(nome || "Novo personagem");
    setRascunhoId(id);
    return id;
  };

  const escolherArquivos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const id = comecarRascunho();
    setSubindo(true);
    try {
      /* Em série, não em paralelo: são arquivos de câmera, e mandar seis
         de uma vez para uma rota que grava em disco só troca uma espera
         por seis timeouts. */
      for (const arquivo of Array.from(lista).slice(0, MAX_FOTOS)) {
        const url = await subirArquivo(arquivo);
        if (url) adicionarFoto(id, url);
      }
    } finally {
      setSubindo(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  };

  const concluirCriacao = () => {
    if (!rascunho) return;
    const pronto = usePersonagensStore.getState().personagens.find((p) => p.id === rascunho.id);
    if (pronto) onEscolher(pronto);
  };

  const cancelarCriacao = () => {
    /* O rascunho é um personagem de verdade no store desde a primeira
       foto. Desistir tem que apagá-lo, senão fica um "Novo personagem"
       vazio na lista para sempre. */
    if (rascunhoId) remover(rascunhoId);
    setRascunhoId(null);
    setNome("");
    setCriando(personagens.length <= 1);
  };

  return (
    <div
      className={emPagina ? "pq-folha pq-folha--centro" : "pq-folha"}
      role="dialog"
      aria-modal="true"
      aria-label="Escolher personagem"
    >
      <div className="pq-folha__topo">
        <div>
          <strong>Quem vai aparecer?</strong>
          <span className="pq-folha__sub">{nomeDoProduto}</span>
        </div>
        <button type="button" className="pq-icone" aria-label="Fechar" onClick={onFechar}>
          <X size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="pq-folha__corpo">
        {!criando && (
          <>
            <div className="pq-pessoas">
              {personagens.filter((p) => p.ativo).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pq-pessoa"
                  onClick={() => onEscolher(p)}
                  disabled={p.fotos.length === 0 || montando}
                  title={p.fotos.length === 0 ? "Este personagem ainda não tem foto" : undefined}
                >
                  <span className="pq-pessoa__retrato">
                    {p.fotos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.fotos[0]} alt="" draggable={false} />
                    ) : (
                      <User size={18} strokeWidth={1.7} />
                    )}
                  </span>
                  <span className="pq-pessoa__texto">
                    <strong>{p.nome}</strong>
                    <span>
                      {p.fotos.length === 0
                        ? "sem foto"
                        : `${p.fotos.length} foto${p.fotos.length > 1 ? "s" : ""}`}
                      {p.usos > 0 && ` · ${p.usos} uso${p.usos > 1 ? "s" : ""}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <button type="button" className="pq-linha-acao" onClick={() => setCriando(true)}>
              <Plus size={16} strokeWidth={1.8} />
              Criar um personagem
            </button>
          </>
        )}

        {criando && (
          <div className="pq-form">
            <label className="pq-campo">
              <span>Nome</span>
              <input
                value={rascunho?.nome ?? nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (rascunhoId) usePersonagensStore.getState().renomear(rascunhoId, e.target.value);
                }}
                placeholder="Ana, Bruno, a apresentadora…"
              />
            </label>

            <label className="pq-campo">
              <span>Como é essa pessoa</span>
              <textarea
                rows={3}
                value={rascunho?.descricao ?? ""}
                onChange={(e) => {
                  const id = comecarRascunho();
                  definirDescricao(id, e.target.value);
                }}
                placeholder="Mulher de 30 anos, cabelo castanho ondulado, pele clara, sorriso aberto."
              />
              {/* O texto não é enfeite: o modelo de vídeo não lê "use a Ana",
                  ele lê a descrição. Sem ela, só a foto — e a foto sozinha
                  traz junto a pose e a roupa dela. */}
              <small>Entra no prompt junto com as fotos. Ajuda o modelo a não copiar a pose da foto.</small>
            </label>

            <div className="pq-fotos">
              {(rascunho?.fotos ?? []).map((url) => (
                <span key={url} className="pq-foto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" draggable={false} />
                  <button
                    type="button"
                    aria-label="Remover a foto"
                    onClick={() => rascunhoId && removerFoto(rascunhoId, url)}
                  >
                    <Trash2 size={12} strokeWidth={1.9} />
                  </button>
                </span>
              ))}

              {(rascunho?.fotos.length ?? 0) < MAX_FOTOS && (
                <button
                  type="button"
                  className="pq-foto pq-foto--add"
                  onClick={() => arquivoRef.current?.click()}
                  disabled={subindo}
                >
                  {subindo ? <Loader2 size={16} className="pq-girando" /> : <Plus size={16} strokeWidth={1.8} />}
                </button>
              )}
            </div>

            <input
              ref={arquivoRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void escolherArquivos(e.target.files)}
            />

            <div className="pq-form__acoes">
              <button type="button" className="pq-btn" onClick={cancelarCriacao}>
                Cancelar
              </button>
              <button
                type="button"
                className="pq-btn pq-btn--marca"
                onClick={concluirCriacao}
                disabled={!rascunho || rascunho.fotos.length === 0 || montando}
                title={
                  !rascunho || rascunho.fotos.length === 0
                    ? "Adicione pelo menos uma foto da pessoa"
                    : undefined
                }
              >
                {montando ? <Loader2 size={15} className="pq-girando" /> : <Check size={15} strokeWidth={2} />}
                {montando ? "Montando…" : "Usar na cena"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
