"use client";

/* ============================================================
   ORBE — a nota do shader, em WebGL

   A nota original monta um `<Canvas><Fill><Shader source={SOURCE}/></Fill>`
   do react-native-skia e alimenta dois uniformes: `uResolution` com o tamanho
   da janela e `uTime` com o relógio em segundos. Aqui é a mesma coisa com as
   peças da web: um quad de tela cheia, o mesmo par de uniformes, e o GLSL
   traduzido em `orbe.glsl.ts` — onde está registrado, valor por valor, o que
   a tradução mudou (nada de numérico).

   Duas decisões que valem explicação:

   • **`uTime` em segundos.** A nota faz `clock.value / 1000`. Aqui é
     `performance.now() / 1000` menos o instante de montagem, para o tempo
     começar em zero como o relógio do Skia — o shader usa `fract(uTime *
     speed / 8.0)`, então um t0 grande não muda a fase, mas começar do zero
     torna a demonstração reproduzível.

   • **`uResolution` em pixels do buffer.** O `gl_FragCoord` vem em pixels do
     buffer de desenho, então `uResolution` tem de vir na mesma unidade ou a
     conta de `uv` sai errada. A forma do orbe é invariante a isso (o `uv` é
     normalizado por `min(size)`), mas o `grain` não: ele sorteia por
     `floor(fc)`, ou seja, uma vez por pixel. Ver `pixelRatio` abaixo.
   ============================================================ */

import * as React from "react";
import { ORBE_FRAGMENT, ORBE_VERTEX } from "./orbe.glsl";
import "./notas.css";

export interface PropsOrbe {
  /**
   * Densidade de pixels do desenho.
   *
   * A nota roda em pontos lógicos (o `useWindowDimensions` do RN devolve dp),
   * então o grão dela cai **um sorteio por ponto**. Em `1` o grão daqui é o
   * mesmo da nota. Subir para o `devicePixelRatio` deixa a borda mais nítida
   * numa tela retina e, no mesmo movimento, **afina o grão** — é a única
   * quantidade da nota que segue a grade de pixels. O padrão é 1 porque a
   * ordem desta leva é manter os números.
   */
  pixelRatio?: number;
  /** Congela o tempo num instante fixo — útil para comparar quadro a quadro. */
  tempoFixo?: number;
  className?: string;
  style?: React.CSSProperties;
}

type Falha = { motivo: string } | null;

function compilar(gl: WebGLRenderingContext, tipo: number, fonte: string): WebGLShader {
  const s = gl.createShader(tipo);
  if (!s) throw new Error("createShader devolveu null");
  gl.shaderSource(s, fonte);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? "sem log";
    gl.deleteShader(s);
    throw new Error(log);
  }
  return s;
}

export function OrbeShader({ pixelRatio = 1, tempoFixo, className, style }: PropsOrbe) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [falha, setFalha] = React.useState<Falha>(null);

  const dprRef = React.useRef(pixelRatio);
  const fixoRef = React.useRef(tempoFixo);

  /* Os valores vivos são lidos de dentro do laço de animação, que não
     re-renderiza: mudá-los não pode recriar o contexto. A cópia acontece em
     efeito, não no render — escrever numa ref durante o render é justamente o
     que quebra o modo concorrente do React. */
  React.useEffect(() => {
    dprRef.current = pixelRatio;
    fixoRef.current = tempoFixo;
  }, [pixelRatio, tempoFixo]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      antialias: false, // o shader tem a própria borda suave (`aa`, `edgeSoftness`)
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      setFalha({ motivo: "Este navegador não abriu um contexto WebGL." });
      return;
    }
    if (gl.isContextLost()) {
      setFalha({ motivo: "O contexto WebGL deste canvas já estava perdido." });
      return;
    }

    let programa: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    try {
      const vs = compilar(gl, gl.VERTEX_SHADER, ORBE_VERTEX);
      const fs = compilar(gl, gl.FRAGMENT_SHADER, ORBE_FRAGMENT);
      programa = gl.createProgram();
      if (!programa) throw new Error("createProgram devolveu null");
      gl.attachShader(programa, vs);
      gl.attachShader(programa, fs);
      gl.linkProgram(programa);
      if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(programa) ?? "sem log de link");
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    } catch (e) {
      setFalha({ motivo: e instanceof Error ? e.message : String(e) });
      return;
    }

    gl.useProgram(programa);

    /* Dois triângulos cobrindo o clip inteiro: é o `<Fill>` da nota. */
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(programa, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(programa, "uResolution");
    const uTime = gl.getUniformLocation(programa, "uTime");

    const t0 = performance.now();
    let anim = 0;
    let vivo = true;

    const perdeu = (e: Event) => {
      e.preventDefault();
      vivo = false;
      cancelAnimationFrame(anim);
      setFalha({ motivo: "O contexto WebGL foi perdido pelo navegador." });
    };
    canvas.addEventListener("webglcontextlost", perdeu);

    const quadro = () => {
      if (!vivo) return;
      const r = Math.max(0.1, dprRef.current);
      const larguraCss = canvas.clientWidth || 1;
      const alturaCss = canvas.clientHeight || 1;
      const w = Math.max(1, Math.round(larguraCss * r));
      const h = Math.max(1, Math.round(alturaCss * r));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uResolution, w, h);
      gl.uniform1f(uTime, fixoRef.current ?? (performance.now() - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      anim = requestAnimationFrame(quadro);
    };
    anim = requestAnimationFrame(quadro);

    return () => {
      vivo = false;
      cancelAnimationFrame(anim);
      canvas.removeEventListener("webglcontextlost", perdeu);
      if (buffer) gl.deleteBuffer(buffer);
      if (programa) gl.deleteProgram(programa);
      /* Aqui NÃO se chama `WEBGL_lose_context.loseContext()`. Parece higiene —
         devolver a memória da GPU na hora — mas `getContext` devolve sempre o
         MESMO objeto para um dado canvas: no remonte que o modo estrito faz em
         desenvolvimento, o segundo efeito receberia o contexto já perdido, e
         compilar nele falha com `COMPILE_STATUS` falso e log vazio. Foi
         exatamente o sintoma que apareceu aqui. O contexto morre com o canvas. */
    };
  }, []);

  if (falha) {
    return (
      <div className={`nota-falha${className ? ` ${className}` : ""}`} style={style} role="status">
        O orbe precisa de WebGL. {falha.motivo}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`nota-orbe${className ? ` ${className}` : ""}`}
      style={style}
      /* O desenho é decorativo: não há informação nele que o texto não dê. */
      aria-hidden
    />
  );
}
