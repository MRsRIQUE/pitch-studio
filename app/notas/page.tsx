"use client";

/* ============================================================
   /notas — a bancada das duas notas portadas

   Não é tela de produto. É o lugar de olhar o orbe e o loop lado a lado com
   os números que vieram das notas em React Native, para conferir a tradução
   antes de decidir onde eles entram — decisão que é do usuário, não minha.
   ============================================================ */

import * as React from "react";
import { OrbeShader } from "@/components/notas/OrbeShader";
import { GyroLoop } from "@/components/notas/GyroLoop";
import { GyroNaCaixa } from "@/components/notas/GyroNaCaixa";
import { NOTA } from "@/components/notas/gyro";
import "@/components/notas/notas.css";

const NUMEROS_DO_ORBE: [string, string][] = [
  ["radius", "0.86"],
  ["flow", "0.26"],
  ["turbulence", "0.12"],
  ["scale", "1.6"],
  ["marble", "1.9"],
  ["refraction", "0.85"],
  ["contrast", "1.1"],
  ["fringe", "0.45"],
  ["rim", "0.7"],
  ["glint", "0.85"],
  ["innerGlow", "0.6"],
  ["grain", "0.3"],
  ["exposure", "1.2"],
  ["edgeSoftness", "0.005"],
  ["paletteCount", "8.0"],
  ["light", "(-0.62, -0.78)"],
  ["LQO_LOOP", "8.0 s"],
  ["LQO_GRAIN", "0.045"],
];

const NUMEROS_DO_GYRO: [string, string][] = [
  ["período", `${NOTA.periodo} s`],
  ["pontos", `${NOTA.pontos}`],
  ["anéis", "3 × 40, raios 1.0 / 0.78 / 0.56"],
  ["núcleo", "38 pontos, escala 0.3"],
  ["voltas por loop", "1, 2, 3 e −2 (núcleo)"],
  ["bola", `${NOTA.bola} px`],
  ["escala do ponto", "0.4"],
  ["vão · padding", `${NOTA.vao} · 7/22/7/8`],
  ["fonte do rótulo", `${NOTA.fonte} px, opacidade ${NOTA.opacidadeDoRotulo}`],
];

function Numeros({ lista }: { lista: [string, string][] }) {
  return (
    <div className="notas-demo__numeros">
      {lista.map(([k, v]) => (
        <div key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

export default function PaginaNotas() {
  const [congelado, setCongelado] = React.useState(false);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="notas-demo">
        <h1 className="notas-demo__titulo">Notas portadas</h1>

        <section className="notas-demo__cartao">
          <div className="notas-demo__cabecalho">
            <h2 className="notas-demo__nome">Orbe</h2>
            <span className="notas-demo__origem">
              shader.tsx · Skia.RuntimeEffect → WebGL (GLSL ES 1.00)
            </span>
          </div>
          <div className="notas-demo__palco">
            <OrbeShader tempoFixo={congelado ? 2.5 : undefined} />
          </div>
          <label className="notas-demo__origem" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={congelado}
              onChange={e => setCongelado(e.target.checked)}
            />
            Congelar em uTime = 2,5 s (para comparar quadro a quadro)
          </label>
          <Numeros lista={NUMEROS_DO_ORBE} />
        </section>

        <section className="notas-demo__cartao">
          <div className="notas-demo__cabecalho">
            <h2 className="notas-demo__nome">Gyro</h2>
            <span className="notas-demo__origem">
              gyro.tsx · Skia.Picture → canvas 2D · {NOTA.pontos} pontos
            </span>
          </div>

          <div className="notas-demo__linha">
            <GyroLoop />
            <GyroLoop rotulo="Alinhando…" />
            <GyroLoop comPilula={false} />
            <GyroLoop comRotulo={false} />
          </div>

          {/* Quatro instantes do loop, congelados, para conferir que as quatro
              rotações fecham juntas: 0 e 1 têm de ser o mesmo desenho. */}
          <div className="notas-demo__linha">
            {[0, 0.25, 0.5, 0.75].map(f => (
              <GyroLoop key={f} faseFixa={f} comPilula={false} comRotulo={false} />
            ))}
          </div>

          <Numeros lista={NUMEROS_DO_GYRO} />

          {/* A prova do cuidado que o usuário pediu: a caixa reservada é de
              quem hospeda, e o loop entra DENTRO dela sem mexer no tamanho.
              As três caixas abaixo têm as medidas de artefatos reais. */}
          <div className="notas-demo__linha">
            {[[332, 187], [332, 443], [96, 96]].map(([w, h]) => (
              <div key={`${w}x${h}`} style={{ textAlign: "center" }}>
                <div
                  data-caixa={`${w}x${h}`}
                  style={{
                    position: "relative",
                    width: w,
                    height: h,
                    overflow: "hidden",
                    borderRadius: 8,
                    background: "hsl(var(--ms-gray-2))",
                  }}
                >
                  <GyroNaCaixa />
                </div>
                <span className="notas-demo__origem">
                  caixa reservada {w}×{h}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
