"use client";

/* ============================================================
   O BRIEFING UGC — o formulário da primeira mensagem

   No modo livre a primeira frase decide a qualidade do plano. No UGC a
   primeira mensagem é um briefing inteiro — personagem, produto, duração,
   ideia, hook, roteiro, local, estilo — porque é isso que a receita do
   @ViralOps_ dá ao "projeto" dela antes de pedir o esboço. Este
   formulário existe para o usuário não ter que lembrar a lista.

   O que sai daqui é UMA mensagem de texto (o briefing, em português, que
   o modelo lê) mais as fotos que vão junto e as referências que viram
   nós quando o plano for montado no grafo. O modelo vê as fotos; o grafo
   recebe os nós. São as mesmas URLs nos dois lugares.
   ============================================================ */

/* As fotos são do usuário, já em disco. */
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { Loader2, Upload, X } from "lucide-react";
import { usePersonagensStore, personagensAtivos } from "@/lib/personagensStore";
import { VIDEO_MODELS } from "@/lib/modelConfig";
import type { Referencia } from "@/lib/estruturaIdeia";

export interface EnvioBriefing {
  texto: string;
  imagens: string[];
  referencias: Referencia[];
}

const ESTILOS = [
  "Selfie falando com a câmera",
  "Unboxing",
  "Antes e depois",
  "Review no espelho",
  "Arrumando-se (GRWM)",
  "Demonstração de uso",
];

const CAMERAS: { id: "selfie" | "tripe" | "amigo"; rotulo: string }[] = [
  { id: "selfie", rotulo: "Selfie, braço esticado" },
  { id: "tripe", rotulo: "Celular no tripé" },
  { id: "amigo", rotulo: "Alguém filmando" },
];

/** As durações vêm do modelo que o briefing usa, nunca de uma lista aqui. */
const DURACOES = (VIDEO_MODELS.find(m => m.id === "seedance-2-5")?.durations ?? [5, 10, 15, 20, 30]).filter(d => d % 5 === 0);

async function subirFoto(arquivo: File, pasta: string): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) throw new Error("Use imagens JPG, PNG ou WebP.");
  if (arquivo.size > 10 * 1024 * 1024) throw new Error("A foto pode ter até 10 MB.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(arquivo);
  });
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, folder: pasta, mimeType: arquivo.type }),
  });
  const data = await res.json();
  if (!res.ok || !data.cdnUrl) throw new Error(data.error || "Não foi possível guardar a foto.");
  return data.cdnUrl as string;
}

function CampoFoto({
  rotulo,
  url,
  ocupado,
  onEscolher,
  onLimpar,
}: {
  rotulo: string;
  url: string | null;
  ocupado: boolean;
  onEscolher: (files: FileList | null) => void;
  onLimpar: () => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div className="est-brief__foto">
      {url ? (
        <div className="est-brief__foto-prev">
          <img src={url} alt={rotulo} />
          <button type="button" aria-label={`Remover ${rotulo}`} onClick={onLimpar} disabled={ocupado}><X size={12} /></button>
        </div>
      ) : (
        <button type="button" className="est-brief__foto-vazia" disabled={ocupado} onClick={() => input.current?.click()}>
          {ocupado ? <Loader2 size={16} className="est-girando" /> : <Upload size={16} />}
          <span>{rotulo}</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { onEscolher(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

export function BriefingUGC({ ocupado, onEnviar }: { ocupado: boolean; onEnviar: (envio: EnvioBriefing) => void }) {
  const personagens = usePersonagensStore(s => s.personagens);
  const ativos = React.useMemo(() => personagensAtivos(personagens).filter(p => p.fotos.length > 0), [personagens]);

  const [personagemId, setPersonagemId] = React.useState("");
  const [descricaoPessoa, setDescricaoPessoa] = React.useState("");
  const [produtoNome, setProdutoNome] = React.useState("");
  const [produtoFoto, setProdutoFoto] = React.useState<string | null>(null);
  const [cenarioFoto, setCenarioFoto] = React.useState<string | null>(null);
  const [duracao, setDuracao] = React.useState(DURACOES.includes(10) ? 10 : DURACOES[0]);
  const [ideia, setIdeia] = React.useState("");
  const [hook, setHook] = React.useState("");
  const [roteiro, setRoteiro] = React.useState("");
  const [local, setLocal] = React.useState("");
  const [estilo, setEstilo] = React.useState(ESTILOS[0]);
  const [camera, setCamera] = React.useState<(typeof CAMERAS)[number]["id"]>("selfie");
  const [extras, setExtras] = React.useState("");
  const [subindo, setSubindo] = React.useState<"produto" | "cenario" | null>(null);
  const [erro, setErro] = React.useState("");

  const personagem = ativos.find(p => p.id === personagemId) ?? null;
  const podeEnviar = !ocupado && !subindo && ideia.trim().length > 0 && (personagem !== null || descricaoPessoa.trim().length > 0);

  const escolher = (qual: "produto" | "cenario") => async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || subindo) return;
    setSubindo(qual); setErro("");
    try {
      const url = await subirFoto(f, qual === "produto" ? "produtos" : "cenarios");
      if (qual === "produto") setProdutoFoto(url); else setCenarioFoto(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setSubindo(null);
    }
  };

  const enviar = () => {
    if (!podeEnviar) return;
    const referencias: Referencia[] = [];
    const imagens: string[] = [];
    const fotos: string[] = [];

    if (personagem) {
      const foto = personagem.fotos[personagem.fotos.length - 1];
      referencias.push({ papel: "personagem", rotulo: personagem.nome.slice(0, 40), url: foto, descricao: personagem.descricao });
      imagens.push(foto);
      fotos.push(`foto ${fotos.length + 1} = o personagem "${personagem.nome}"`);
    }
    if (produtoFoto) {
      referencias.push({ papel: "produto", rotulo: (produtoNome.trim() || "Produto").slice(0, 40), url: produtoFoto, descricao: produtoNome.trim() || undefined });
      imagens.push(produtoFoto);
      fotos.push(`foto ${fotos.length + 1} = o produto${produtoNome.trim() ? ` "${produtoNome.trim()}"` : ""}`);
    }
    if (cenarioFoto) {
      referencias.push({ papel: "cenario", rotulo: "Cenario", url: cenarioFoto, descricao: local.trim() || undefined });
      imagens.push(cenarioFoto);
      fotos.push(`foto ${fotos.length + 1} = o cenário`);
    }

    const linhas = [
      "BRIEFING UGC",
      `- Personagem: ${personagem ? `${personagem.nome}${personagem.descricao ? ` — ${personagem.descricao}` : ""} (na foto)` : descricaoPessoa.trim()}`,
      `- Produto: ${produtoNome.trim() || (produtoFoto ? "o da foto" : "nenhum — o vídeo é sobre a pessoa/ideia")}`,
      `- Duração: ${duracao} segundos, vertical 9:16`,
      `- Ideia: ${ideia.trim()}`,
      hook.trim() ? `- Hook (primeiros 1,5 s): ${hook.trim()}` : "- Hook: proponha um, visual, sem fala",
      roteiro.trim() ? `- Roteiro (fala): ${roteiro.trim()}` : "- Roteiro: escreva a fala inteira em português, do jeito que a pessoa fala",
      local.trim() ? `- Local: ${local.trim()}` : "- Local: escolha um ambiente cotidiano coerente com o produto",
      `- Estilo UGC: ${estilo}`,
      `- Câmera: ${CAMERAS.find(c => c.id === camera)?.rotulo ?? camera}`,
      extras.trim() ? `- Instruções especiais: ${extras.trim()}` : "",
      fotos.length ? `- Fotos anexadas: ${fotos.join("; ")}` : "- Sem fotos anexadas",
      "",
      "Devolva o esboço (fase 1) para eu aprovar.",
    ].filter(Boolean);

    onEnviar({ texto: linhas.join("\n"), imagens, referencias });
  };

  return (
    <form className="est-brief" onSubmit={e => { e.preventDefault(); enviar(); }}>
      <div className="est-brief__topo">
        <h2>Briefing do vídeo UGC</h2>
        <p>Preencha o que você já sabe. O assistente devolve um esboço (ângulo, hook, roteiro e fluxo) para você aprovar antes do prompt de produção.</p>
      </div>

      <div className="est-brief__grade">
        <label className="est-brief__campo est-brief__campo--largo">
          <span>Personagem</span>
          <select className="est-campo" value={personagemId} disabled={ocupado} onChange={e => setPersonagemId(e.target.value)}>
            <option value="">{ativos.length ? "Descrever a pessoa (sem foto)" : "Nenhum personagem com foto — descreva a pessoa"}</option>
            {ativos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        {!personagem && (
          <label className="est-brief__campo est-brief__campo--largo">
            <span>Quem aparece</span>
            <input className="est-campo" value={descricaoPessoa} disabled={ocupado} placeholder="Ex.: mulher de uns 30 anos, cabelo cacheado, estilo casual" onChange={e => setDescricaoPessoa(e.target.value)} />
          </label>
        )}

        <label className="est-brief__campo">
          <span>Produto</span>
          <input className="est-campo" value={produtoNome} disabled={ocupado} placeholder="Nome do produto (opcional)" onChange={e => setProdutoNome(e.target.value)} />
        </label>
        <div className="est-brief__campo">
          <span>Fotos</span>
          <div className="est-brief__fotos">
            {personagem && (
              <div className="est-brief__foto">
                <div className="est-brief__foto-prev est-brief__foto-prev--fixa">
                  <img src={personagem.fotos[personagem.fotos.length - 1]} alt={personagem.nome} />
                </div>
              </div>
            )}
            <CampoFoto rotulo="Produto" url={produtoFoto} ocupado={subindo === "produto"} onEscolher={escolher("produto")} onLimpar={() => setProdutoFoto(null)} />
            <CampoFoto rotulo="Cenário" url={cenarioFoto} ocupado={subindo === "cenario"} onEscolher={escolher("cenario")} onLimpar={() => setCenarioFoto(null)} />
          </div>
        </div>

        <label className="est-brief__campo est-brief__campo--largo">
          <span>Ideia do vídeo *</span>
          <textarea className="est-campo" rows={3} value={ideia} disabled={ocupado} placeholder="Ex.: ela mostra o sérum que usa há uma semana e conta o que mudou na pele" onChange={e => setIdeia(e.target.value)} />
        </label>

        <label className="est-brief__campo">
          <span>Hook (primeiros 1,5 s)</span>
          <input className="est-campo" value={hook} disabled={ocupado} placeholder="Deixe vazio para o assistente propor" onChange={e => setHook(e.target.value)} />
        </label>
        <label className="est-brief__campo">
          <span>Duração</span>
          <select className="est-campo" value={duracao} disabled={ocupado} onChange={e => setDuracao(Number(e.target.value))}>
            {DURACOES.map(d => <option key={d} value={d}>{d} segundos</option>)}
          </select>
        </label>

        <label className="est-brief__campo est-brief__campo--largo">
          <span>Roteiro (a fala)</span>
          <textarea className="est-campo" rows={3} value={roteiro} disabled={ocupado} placeholder="Deixe vazio para o assistente escrever" onChange={e => setRoteiro(e.target.value)} />
        </label>

        <label className="est-brief__campo">
          <span>Local</span>
          <input className="est-campo" value={local} disabled={ocupado} placeholder="Ex.: banheiro com luz da janela" onChange={e => setLocal(e.target.value)} />
        </label>
        <label className="est-brief__campo">
          <span>Câmera</span>
          <select className="est-campo" value={camera} disabled={ocupado} onChange={e => setCamera(e.target.value as typeof camera)}>
            {CAMERAS.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
          </select>
        </label>

        <div className="est-brief__campo est-brief__campo--largo">
          <span>Estilo UGC</span>
          <div className="est-brief__chips" role="radiogroup" aria-label="Estilo UGC">
            {ESTILOS.map(s => (
              <button key={s} type="button" role="radio" aria-checked={estilo === s} className={`est-chip${estilo === s ? " is-active" : ""}`} disabled={ocupado} onClick={() => setEstilo(s)}>{s}</button>
            ))}
          </div>
        </div>

        <label className="est-brief__campo est-brief__campo--largo">
          <span>Instruções especiais</span>
          <input className="est-campo" value={extras} disabled={ocupado} placeholder="Ex.: sem música; mostrar o rótulo de perto no fim" onChange={e => setExtras(e.target.value)} />
        </label>
      </div>

      {erro && <p className="est-msg__erro">{erro}</p>}

      <div className="est-brief__rodape">
        <span className="est-brief__nota">Nada é gerado aqui. As fotos viram nós quando você montar no grafo.</span>
        <button type="submit" className="est-botao est-botao--principal" disabled={!podeEnviar}>
          {ocupado ? "Pensando…" : "Pedir o esboço"}
        </button>
      </div>
    </form>
  );
}
