"use client";

/* ============================================================
   PÍLULA 5 — O MODO AGENTE

   Na referência é a pílula `Auto`, e o popover dela tem duas linhas,
   nesta ordem e com estas alturas (medidas em
   `estados/composer-modelos-custom.png`):

     Agent        Standard >     36px
     -------------------------    1px, com 8 de margem
     Multi-modal  [Auto|Custom]  40px  (o segmento de 28 é quem manda)
     Image/Video/UI/3D           32px cada
     padding                      8px
     ------------------------------------
     total em Custom                237px

   `Agent` é quem RACIOCINA; `Multi-modal` é quem DESENHA. Aqui vale o
   mesmo corte: `Agente` são os modelos de `lib/models.ts` — o mesmo que
   escreve o "melhorar o prompt" e conversa no `/chat` —, e a parte
   multimodal é o modelo de imagem ou de vídeo que gera a mídia.

   Onde a referência mostra `0.59x`, `2.00x`, `2.20x`, mostramos o
   rótulo real de cada modelo (`Best`, `Powerful`, `Fast`). Não cobramos
   por modelo: um multiplicador aqui seria número inventado, e é o único
   ponto do bloco em que a referência mostra um dado que não temos.

   Onde eles têm quatro linhas (`Image`, `Video`, `UI`, `3D`), nós temos
   **duas** — `Imagem` e `Vídeo`, os dois meios que existem aqui. `UI` e
   `3D` não entram: seriam botões mortos.

   Este popover também guarda os três controles que só nós temos —
   parâmetros de geração, formato do prompt e vários prompts. Eles
   ocupavam a barra e a deixavam com 11 controles contra os 8 da
   referência. A regra da v2 é fidelidade, e a referência dobra tudo
   atrás do `Auto`: eles continuam existindo e funcionando, só não
   ocupam a barra.

   Uma diferença assumida em relação ao `preview.html`: lá as linhas de
   mídia são `.only-custom` e somem no modo `Auto`. Aqui elas ficam
   SEMPRE visíveis, porque no Miora o `Auto` deduz o meio a partir do
   prompt e nós não deduzimos — este popover é o único lugar do app que
   troca entre imagem e vídeo. Escondê-las em `Auto` deixaria o vídeo
   inalcançável.
   ============================================================ */

import * as React from "react";
import { Check } from "@/components/icones";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODEL_GROUPS } from "@/lib/models";
import { ParamFieldRow, type ParamField } from "./ParamsPill";
import "@/app/gallery/composer.css";

export type ModelOption = {
  value: string;
  label: string;
  /** Nome do provedor — vira cabeçalho de grupo na lista. */
  group?: string;
  icon?: React.ReactNode;
};

/** Uma linha do bloco multimodal: um meio, com o modelo em efeito nele. */
export type LinhaMidia = {
  id: string;
  /** "Imagem" ou "Vídeo". */
  rotulo: string;
  /** O modelo em efeito neste meio — o da aba, ou o guardado do outro. */
  valor: string;
  opcoes: ModelOption[];
  /** Escolher aqui troca o modelo E, se for o outro meio, troca a aba. */
  onEscolher: (modelId: string) => void;
  /** Verdadeiro no meio que a aba está usando agora. */
  ativa: boolean;
};

export type BackendChoice = {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
};

/** O ícone de controles deslizantes, literal do data-URI do site. */
function IconeSliders() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.334 11.333h-6" />
        <path d="M12.666 4.667h-6" />
        <path d="M11.334 13.333a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path d="M4.666 6.667a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </g>
    </svg>
  );
}

/** O segmento de formato do prompt, que era a terceira pílula da barra. */
export type Formato<T extends string = string> = {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
};

export function ModelPill({
  value,
  onChange,
  backend,
  disabled,
  padrao,
  midias,
  agente,
  onAgenteChange,
  parametros,
  formato,
  multi,
}: {
  value: string;
  onChange: (value: string) => void;
  backend?: BackendChoice | null;
  disabled?: boolean;
  /** O modelo que a aba usa por padrão — o alvo do "Automático". */
  padrao: string;
  /** As duas linhas do bloco multimodal: Imagem e Vídeo. */
  midias: LinhaMidia[];
  /** O agente que raciocina: `lib/models.ts`. */
  agente: string;
  onAgenteChange: (value: string) => void;
  /** Os parâmetros dependentes de modelo, dobrados para dentro. */
  parametros?: ParamField[];
  /** O formato do prompt: Txt · JSON · YAML. */
  formato?: Formato;
  /** Vários prompts numa tacada. */
  multi?: { ligado: boolean; onChange: (v: boolean) => void };
}) {
  const midiaAtiva = midias.find((m) => m.ativa) ?? midias[0];
  const current = midiaAtiva?.opcoes.find((o) => o.value === value);
  const automatico = value === padrao;

  const currentBackend = backend?.options.find((b) => b.value === backend.value);
  const agenteAtual = MODEL_GROUPS.flatMap((g) => g.models).find((m) => m.id === agente);

  return (
    <DropdownMenu>
      {/* A pílula da referência mede 70 e diz `Auto` — o nome do modelo
          não cabe ali, e é justamente por isso que ele mora no popover.
          Sem chevron, como no `preview.html`: ícone + rótulo e mais nada. */}
      <DropdownMenuTrigger
        className="pc-pill pc-pill--agente group"
        aria-label="Modo agente"
        title={automatico ? "Automático" : current?.label ?? "Modelo"}
        data-custom={!automatico ? "true" : undefined}
        disabled={disabled}
      >
        <IconeSliders />
        <span>{automatico ? "Auto" : "Manual"}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-[250px] p-2">
        {/* Agente: quem raciocina */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="pcx-pop-linha pcx-pop-linha--agente">
            <span className="pcx-pop-rotulo">Agente</span>
            <span className="pcx-pop-valor">{agenteAtual?.label ?? "—"}</span>
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent className="max-h-[420px] w-[300px] overflow-y-auto">
            {MODEL_GROUPS.map((g) => (
              <DropdownMenuGroup key={g.label}>
                {/* O rótulo do Base UI é uma peça de grupo: fora de um
                    `Menu.Group` ele lança e derruba o popover. */}
                <DropdownMenuLabel className="px-2 text-ms-sm font-normal text-ms-text-tertiary">
                  {g.label}
                </DropdownMenuLabel>
                {g.models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onAgenteChange(m.id)}
                    className="pcx-item"
                    data-escolhido={m.id === agente ? "true" : undefined}
                  >
                    <span className="pcx-item-nome">{m.label}</span>
                    {/* Onde a referência põe o multiplicador de cobrança,
                        vai o rótulo real do modelo. */}
                    <span className="pcx-item-marca">{m.desc}</span>
                    {m.id === agente && (
                      <Check size={14} strokeWidth={2.2} className="shrink-0 text-ms-icon-brand" />
                    )}
                  </button>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <div className="pcx-pop-sep" role="separator" />

        {/* Multimodal: quem desenha */}
        <div className="pcx-pop-linha pcx-pop-linha--mm">
          <span className="pcx-pop-rotulo">Multimodal</span>
          <div className="pc-segment" role="group" aria-label="Escolha do modelo de mídia">
            <button
              type="button"
              className="pc-segment-item"
              data-active={automatico ? "true" : undefined}
              aria-pressed={automatico}
              onClick={() => onChange(padrao)}
            >
              Automático
            </button>
            <button
              type="button"
              className="pc-segment-item"
              data-active={!automatico ? "true" : undefined}
              aria-pressed={!automatico}
              onClick={() => {
                /* Sair do automático sem escolher nada não teria efeito;
                   cai no primeiro modelo que não seja o padrão. */
                const outro = midiaAtiva?.opcoes.find((o) => o.value !== padrao);
                if (outro) onChange(outro.value);
              }}
            >
              Personalizado
            </button>
          </div>
        </div>

        {/* As duas linhas de mídia. Diferente do `preview.html`, elas não
            são `.only-custom`: ver a nota do cabeçalho. A marcada é a do
            meio que a aba está usando. */}
        {midias.map((m) => (
          <LinhaDeMidia key={m.id} midia={m} />
        ))}

        {/* Só existe quando há mais de um provedor servindo este modelo. */}
        {backend && backend.options.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="pcx-pop-linha">
                <span className="pcx-pop-rotulo">Backend</span>
                <span className="pcx-pop-valor">{currentBackend?.label ?? "—"}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-[220px]">
                {backend.options.map((b) => (
                  <ListRow
                    key={b.value}
                    icon={b.icon}
                    label={b.label}
                    checked={b.value === backend.value}
                    onClick={() => backend.onChange(b.value)}
                  />
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        {/* ── Os três que saíram da barra ──────────────────────────
            A referência não os tem; nós temos, e eles são reais. O que
            muda é o lugar: atrás do `Auto`, com o resto. */}
        {(parametros?.length || formato || multi) && <div className="pcx-pop-sep" role="separator" />}

        {parametros?.map((f) => <ParamFieldRow key={f.id} field={f} />)}

        {formato && (
          <div className="pcx-pop-linha pcx-pop-linha--mm">
            <span className="pcx-pop-rotulo">Formato</span>
            <div className="pc-segment" role="group" aria-label="Formato do prompt">
              {formato.opcoes.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className="pc-segment-item"
                  data-active={formato.valor === o.valor ? "true" : undefined}
                  aria-pressed={formato.valor === o.valor}
                  onClick={() => formato.onChange(o.valor)}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {multi && (
          <button
            type="button"
            className="pcx-pop-linha pcx-pop-linha--acao"
            role="menuitemcheckbox"
            aria-checked={multi.ligado}
            onClick={() => multi.onChange(!multi.ligado)}
          >
            <span className="pcx-pop-rotulo">Vários prompts</span>
            <span className="pcx-pop-valor">{multi.ligado ? "Ligado" : "Desligado"}</span>
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Uma linha de mídia com o submenu dos modelos daquele meio. */
function LinhaDeMidia({ midia }: { midia: LinhaMidia }) {
  const atual = midia.opcoes.find((o) => o.value === midia.valor);

  /* Agrupa preservando a ordem em que os grupos aparecem na lista. */
  const grupos = React.useMemo(() => {
    const out: { name: string | undefined; items: ModelOption[] }[] = [];
    for (const o of midia.opcoes) {
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.name === o.group) ultimo.items.push(o);
      else out.push({ name: o.group, items: [o] });
    }
    return out;
  }, [midia.opcoes]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="pcx-pop-linha" data-ativa={midia.ativa ? "true" : undefined}>
        <span className="pcx-pop-rotulo">{midia.rotulo}</span>
        <span className="pcx-pop-valor">{atual?.label ?? "—"}</span>
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="max-h-[400px] w-[242px] overflow-y-auto">
        {grupos.map((g, gi) => (
          <DropdownMenuGroup key={g.name ?? `grupo-${gi}`}>
            {g.name && (
              <DropdownMenuLabel className="px-2 text-ms-sm font-normal text-ms-text-tertiary">
                {g.name}
              </DropdownMenuLabel>
            )}
            {g.items.map((o) => (
              <ListRow
                key={o.value}
                icon={o.icon}
                label={o.label}
                checked={midia.ativa && o.value === midia.valor}
                onClick={() => midia.onEscolher(o.value)}
              />
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/* O item marcado fica em cor de marca com peso 600 e o check à direita —
   o mesmo desenho do AcervoHeader, para as duas listas do app não
   divergirem. Como lá, a comparação é feita aqui: nesta versão do Radix
   o `data-state` fica no indicador interno, não no item. */
function ListRow({
  icon,
  label,
  checked,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex h-8 w-full items-center gap-2 rounded-ms px-2 text-ms-base transition-colors hover:bg-ms-bg-hover " +
        (checked ? "font-semibold text-ms-text-brand" : "text-ms-text")
      }
    >
      {icon}
      <span className="truncate">{label}</span>
      {checked && (
        <Check size={14} strokeWidth={2.2} className="ml-auto shrink-0 text-ms-icon-brand" />
      )}
    </button>
  );
}
