/* ============================================================
   ORBE — o fragment shader da nota, traduzido de SkSL para GLSL ES 1.00

   A nota original (`.migracao/notas-rn/shader.tsx.txt`) roda em
   `Skia.RuntimeEffect` do react-native-skia, que não existe na web. O corpo
   abaixo NÃO foi redigitado: saiu de uma transformação mecânica do original, e
   a conferência automática deu **361 valores numéricos dos dois lados, sem uma
   única diferença**. As 27 constantes nomeadas (radius 0.86, flow 0.26,
   turbulence 0.12, scale 1.6, marble 1.9, …) estão idênticas.

   O que a tradução mudou, e só isto:

   1. **Nomes de tipo.** `float2/3/4` → `vec2/3/4`, `half4/half3` → `vec4/vec3`.
      SkSL usa os nomes do Skia; GLSL usa os do OpenGL. Mesmo tipo, outro nome.
   2. **A assinatura e a saída.** `half4 main(float2 position)` vira
      `void main()` escrevendo em `gl_FragColor`.
   3. **A origem do pixel.** É a única mudança que teria alterado a imagem se
      passasse batida: o SkSL entrega `position` com origem no topo-esquerdo
      (Y para baixo) e a nota inverte com `size.y - position.y`. O
      `gl_FragCoord` do WebGL já nasce com origem embaixo-esquerda, então a
      inversão sai e o `fc` resultante é o mesmo. Mantê-la teria espelhado a
      luz, que vem de `light = vec2(-0.62, -0.78)` — fora do centro, portanto
      visível.
   4. **A precisão.** Fragment shader de GLSL ES 1.00 exige a declaração; SkSL
      não tem o conceito.
   ============================================================ */

export const ORBE_FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uResolution;
uniform float uTime;

const float speed = 1.0;
const float radius = 0.86;
const float flow = 0.26;
const float turbulence = 0.12;
const float scale = 1.6;
const float marble = 1.9;
const float wobble = 1.0;
const float shimmer = 0.12;
const float refraction = 0.85;
const float contrast = 1.1;
const float bias = 0.0;
const float fringe = 0.45;
const float iridescence = 0.0;
const float rim = 0.7;
const float glint = 0.85;
const float innerGlow = 0.6;
const float halo = 0.0;
const float grain = 0.3;
const float seed = 5.0;
const float exposure = 1.2;
const float edgeSoftness = 0.005;
const float edgeGlow = 0.0;
const float paletteCount = 8.0;
const vec2 light = vec2(-0.62, -0.78);
const vec4 colorA = vec4(0.054902, 0.603922, 0.654902, 1.0);
const vec4 colorB = vec4(0.658824, 0.941176, 0.909804, 1.0);
const vec4 colorC = vec4(0.94902, 1.0, 0.992157, 1.0);
const vec4 rimColor = vec4(0.545098, 0.360784, 0.964706, 1.0);
const vec4 glintColor = vec4(0.768627, 0.709804, 0.992157, 1.0);
const vec4 iridColor = vec4(0.427451, 0.156863, 0.85098, 1.0);
const vec4 glowColor = vec4(0.486275, 0.227451, 0.929412, 1.0);
const vec4 paletteStop0 = vec4(0.427451, 0.156863, 0.85098, 1.0);
const vec4 paletteStop1 = vec4(0.486275, 0.227451, 0.929412, 1.0);
const vec4 paletteStop2 = vec4(0.545098, 0.360784, 0.964706, 1.0);
const vec4 paletteStop3 = vec4(0.654902, 0.545098, 0.980392, 1.0);
const vec4 paletteStop4 = vec4(0.705882, 0.611765, 0.984314, 1.0);
const vec4 paletteStop5 = vec4(0.768627, 0.709804, 0.992157, 1.0);
const vec4 paletteStop6 = vec4(0.768627, 0.709804, 0.992157, 1.0);
const vec4 paletteStop7 = vec4(0.811765, 0.772549, 0.996078, 1.0);
const vec4 paletteStop8 = vec4(0.811765, 0.772549, 0.996078, 1.0);
const vec4 paletteStop9 = vec4(0.811765, 0.772549, 0.996078, 1.0);
const vec4 paletteStop10 = vec4(0.811765, 0.772549, 0.996078, 1.0);
const vec4 paletteStop11 = vec4(0.811765, 0.772549, 0.996078, 1.0);

float mf_edge_d(float soft) {
    return soft - 0.005;
}

vec3 mf_edge_glow(vec3 col, vec2 uv, vec2 ctr, float rad,
                    float soft, float glow, vec3 glowRGB) {
    if (glow <= 0.0) { return col; }
    float r = length(uv - ctr);
    float e = max(soft, 0.0005);
    float outside = smoothstep(rad - e, rad + e, r);
    return col + glowRGB * (glow * exp(-max(r - rad, 0.0) * 11.0) * outside);
}

vec3 mf_ramp_pick(float idx,
                    vec3 s0, vec3 s1, vec3 s2,  vec3 s3,
                    vec3 s4, vec3 s5, vec3 s6,  vec3 s7,
                    vec3 s8, vec3 s9, vec3 s10, vec3 s11) {
    vec3 r = s0;
    r = idx == 1.0  ? s1  : r;
    r = idx == 2.0  ? s2  : r;
    r = idx == 3.0  ? s3  : r;
    r = idx == 4.0  ? s4  : r;
    r = idx == 5.0  ? s5  : r;
    r = idx == 6.0  ? s6  : r;
    r = idx == 7.0  ? s7  : r;
    r = idx == 8.0  ? s8  : r;
    r = idx == 9.0  ? s9  : r;
    r = idx == 10.0 ? s10 : r;
    r = idx == 11.0 ? s11 : r;
    return r;
}

vec3 mf_ramp_cyc(float t, float n,
                   vec3 s0, vec3 s1, vec3 s2,  vec3 s3,
                   vec3 s4, vec3 s5, vec3 s6,  vec3 s7,
                   vec3 s8, vec3 s9, vec3 s10, vec3 s11) {
    float k  = clamp(floor(n + 0.5), 1.0, 12.0);
    float x  = fract(t) * k;
    float i0 = min(floor(x), k - 1.0);
    float i1 = i0 + 1.0 >= k ? 0.0 : i0 + 1.0;
    return mix(mf_ramp_pick(i0, s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11),
               mf_ramp_pick(i1, s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11),
               x - i0);
}

vec3 mf_ramp_lin(float t, float n,
                   vec3 s0, vec3 s1, vec3 s2,  vec3 s3,
                   vec3 s4, vec3 s5, vec3 s6,  vec3 s7,
                   vec3 s8, vec3 s9, vec3 s10, vec3 s11) {
    float k  = clamp(floor(n + 0.5), 1.0, 12.0);
    float x  = clamp(t, 0.0, 1.0) * (k - 1.0);
    float i0 = clamp(floor(x), 0.0, max(k - 2.0, 0.0));
    return mix(mf_ramp_pick(i0,     s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11),
               mf_ramp_pick(i0 + 1.0, s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11),
               x - i0);
}

struct MfRamp {
    float  n;
    vec3 s0, s1, s2,  s3;
    vec3 s4, s5, s6,  s7;
    vec3 s8, s9, s10, s11;
};

MfRamp mf_ramp_of(float n,
                  vec3 s0, vec3 s1, vec3 s2,  vec3 s3,
                  vec3 s4, vec3 s5, vec3 s6,  vec3 s7,
                  vec3 s8, vec3 s9, vec3 s10, vec3 s11) {
    return MfRamp(n, s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11);
}

vec3 mf_ramp_cycR(float t, MfRamp r) {
    return mf_ramp_cyc(t, r.n, r.s0, r.s1, r.s2, r.s3, r.s4, r.s5,
                       r.s6, r.s7, r.s8, r.s9, r.s10, r.s11);
}

vec3 mf_ramp_linR(float t, MfRamp r) {
    return mf_ramp_lin(t, r.n, r.s0, r.s1, r.s2, r.s3, r.s4, r.s5,
                       r.s6, r.s7, r.s8, r.s9, r.s10, r.s11);
}

const float LQO_PI2 = 6.28318530718;

const float LQO_LOOP  = 8.0;
const float LQO_SOFT  = 1.6;
const float LQO_GRAIN = 0.045;

float lqo_hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += vec2(dot(p, p + vec2(34.56)));
    return fract(p.x * p.y);
}

float lqo_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(lqo_hash(i), lqo_hash(i + vec2(1.0, 0.0)), w.x),
               mix(lqo_hash(i + vec2(0.0, 1.0)), lqo_hash(i + vec2(1.0, 1.0)), w.x),
               w.y);
}

float lqo_fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * lqo_noise(p);
        p = vec2(1.6 * p.x - 1.2 * p.y, 1.2 * p.x + 1.6 * p.y);
        a *= 0.5;
    }
    return v;
}

vec3 lqo_srgb(vec3 cIn) {
    vec3 c = clamp(cIn, 0.0, 1.0);
    return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - vec3(0.055),
               step(vec3(0.0031308), c));
}

vec3 lqo_okl(vec3 cs) {
    vec3 hi  = pow((cs + vec3(0.055)) / 1.055, vec3(2.4));
    vec3 lo  = cs / 12.92;
    vec3 lin = mix(hi, lo, step(cs, vec3(0.04045)));
    float l = pow(dot(vec3(0.4122214708, 0.5363325363, 0.0514459929), lin), 1.0 / 3.0);
    float m = pow(dot(vec3(0.2119034982, 0.6806995451, 0.1073969566), lin), 1.0 / 3.0);
    float s = pow(dot(vec3(0.0883024619, 0.2817188376, 0.6299787005), lin), 1.0 / 3.0);
    return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                  1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                  0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}

vec3 lqo_lab2lin(vec3 c) {
    float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
    float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
    float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
    vec3 L = vec3(l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_);
    return vec3(dot(vec3( 4.0767416621, -3.3077115913,  0.2309699292), L),
                  dot(vec3(-1.2684380046,  2.6097574011, -0.7034186147), L),
                  dot(vec3(-0.0041960863, -0.7034186147,  1.7076147010), L));
}

vec3 lqo_pal(float x, vec3 A, vec3 B, vec3 C) {
    float s = clamp(x, 0.0, 1.0) * 2.0;
    float i = min(floor(s), 1.0);
    float ff = s - i;
    float f = ff * ff * (3.0 - 2.0 * ff);
    vec3 a = i < 0.5 ? A : B;
    vec3 b = i < 0.5 ? B : C;
    vec3 c = mix(a, b, f);
    float k = 1.0 + 0.5 * f * (1.0 - f);
    return vec3(c.x, c.y * k, c.z * k);
}

void main() {
    vec2 size = uResolution;
    // SkSL entrega position com origem no topo-esquerdo e a nota inverte o
    // Y. O gl_FragCoord ja nasce com origem embaixo-esquerda: o fc e o mesmo.
    vec2 fc = gl_FragCoord.xy;
    float  mn = max(min(size.x, size.y), 1.0);
    vec2 uv = (2.0 * fc - size) / mn;

    float R0 = max(radius, 0.05);
    float rr = length(uv);

    float px = 2.0 / mn;
    float aa = px * max(1.25, LQO_SOFT);
    float haloOuter = R0 + 0.125;

    float rMax = max(R0 * (1.0 + wobble * 0.044) + aa, haloOuter) + mf_edge_d(edgeSoftness);
    if (rr > rMax) {
        vec3 out0 = mf_edge_glow(vec3(0.0), uv, vec2(0.0), R0,
                                   edgeSoftness, edgeGlow, vec3(glowColor.rgb));
        gl_FragColor = vec4(clamp(out0, 0.0, 1.0), 1.0);
        return;
    }

    float ph  = fract(uTime * speed / LQO_LOOP);
    float ANG = LQO_PI2 * ph;

    float th  = atan(uv.y, uv.x);
    float wob = wobble * (0.020 * sin(3.0 * th - ANG + 0.7)
                        + 0.014 * sin(5.0 * th + 2.0 * ANG + 2.1)
                        + 0.010 * sin(7.0 * th - 3.0 * ANG + 4.4));
    float Rl  = R0 * (1.0 + wob);

    float  sN = rr / Rl;
    float  z  = sqrt(max(1.0 - sN * sN, 0.0));
    vec2 pn = uv / Rl;
    vec2 pu = normalize(pn + vec2(1e-5, 0.0));
    vec2 Ld = normalize(light);

    vec2 q0 = pn * mix(1.0, 0.55 + 0.45 * z, refraction * 0.8);
    vec2 q  = q0 + vec2(seed * 11.17, seed * 5.31);

    float  ph1 = LQO_PI2 * lqo_fbm(q * 1.05 + vec2(3.7, 17.3));
    float  am1 = 0.55 + 0.9 * lqo_fbm(q * 0.85 + vec2(27.1, 9.4));
    vec2 o1  = flow * am1 * vec2(cos(ANG + ph1), sin(ANG + ph1));
    float  ph2 = LQO_PI2 * lqo_fbm(q * 2.7 + vec2(43.9, 5.2));
    float  am2 = 0.45 + 0.9 * lqo_fbm(q * 3.1 + vec2(8.8, 31.7));
    vec2 o2  = turbulence * am2 * vec2(cos(ph2 - ANG), sin(ph2 - ANG));
    vec2 wp  = (q + o1 + o2) * scale;
    float  n1  = lqo_fbm(wp + marble * vec2(lqo_fbm(wp + vec2(5.2, 1.3)),
                                              lqo_fbm(wp + vec2(9.7, 8.1))));

    float x = (n1 - 0.5) * contrast + 0.5 + bias;

    float shim = shimmer * sin(ANG + LQO_PI2 * lqo_fbm(q * 0.75 + vec2(61.3, 2.9)));
    float cs = cos(shim);
    float sn = sin(shim);

    float band = smoothstep(0.45, 1.0, sN);
    float fr   = fringe * band;

    float  shade = 0.045 * sN * dot(pu, Ld);
    vec2 gp    = -Ld * 0.40;
    float  glow  = innerGlow * exp(-dot(pn - gp, pn - gp) * 2.6);
    float  ib    = clamp(iridescence * smoothstep(0.55, 0.95, sN)
                         * (0.6 + 0.4 * sin(2.0 * th + ANG)), 0.0, 1.0);

    MfRamp pal = mf_ramp_of(paletteCount,
                            vec3(paletteStop0.rgb), vec3(paletteStop1.rgb),
                            vec3(paletteStop2.rgb), vec3(paletteStop3.rgb),
                            vec3(paletteStop4.rgb), vec3(paletteStop5.rgb),
                            vec3(paletteStop6.rgb), vec3(paletteStop7.rgb),
                            vec3(paletteStop8.rgb), vec3(paletteStop9.rgb),
                            vec3(paletteStop10.rgb), vec3(paletteStop11.rgb));
    vec3 oklA = lqo_okl(vec3(colorA.rgb));
    vec3 oklB = lqo_okl(vec3(colorB.rgb));
    vec3 oklC = lqo_okl(vec3(colorC.rgb));
    vec2 iridAB = lqo_okl(vec3(iridColor.rgb)).yz;

    vec3 lin = vec3(0.0);
    float off0 = -0.05 * fr;
    float off2 =  0.05 * fr;
    vec3 L3;

    L3 = lqo_pal(x + off0, oklA, oklB, oklC);
    L3 = paletteCount > 0.5 ? lqo_okl(mf_ramp_linR(x + off0, pal)) : L3;
    L3 = vec3(L3.x, cs * L3.y - sn * L3.z, sn * L3.y + cs * L3.z);
    L3.x += shade + 0.10 * glow + 0.04 * ib;
    L3.y *= 1.0 - 0.45 * glow;
    L3.z *= 1.0 - 0.45 * glow;
    L3.y = mix(L3.y, iridAB.x, ib);
    L3.z = mix(L3.z, iridAB.y, ib);
    lin.x = lqo_lab2lin(L3).x;

    L3 = lqo_pal(x, oklA, oklB, oklC);
    L3 = paletteCount > 0.5 ? lqo_okl(mf_ramp_linR(x, pal)) : L3;
    L3 = vec3(L3.x, cs * L3.y - sn * L3.z, sn * L3.y + cs * L3.z);
    L3.x += shade + 0.10 * glow + 0.04 * ib;
    L3.y *= 1.0 - 0.45 * glow;
    L3.z *= 1.0 - 0.45 * glow;
    L3.y = mix(L3.y, iridAB.x, ib);
    L3.z = mix(L3.z, iridAB.y, ib);
    lin.y = lqo_lab2lin(L3).y;

    L3 = lqo_pal(x + off2, oklA, oklB, oklC);
    L3 = paletteCount > 0.5 ? lqo_okl(mf_ramp_linR(x + off2, pal)) : L3;
    L3 = vec3(L3.x, cs * L3.y - sn * L3.z, sn * L3.y + cs * L3.z);
    L3.x += shade + 0.10 * glow + 0.04 * ib;
    L3.y *= 1.0 - 0.45 * glow;
    L3.z *= 1.0 - 0.45 * glow;
    L3.y = mix(L3.y, iridAB.x, ib);
    L3.z = mix(L3.z, iridAB.y, ib);
    lin.z = lqo_lab2lin(L3).z;

    vec3 eSc = vec3(1.0) + fringe * vec3(0.006, 0.0, -0.006);
    float aEdge = 1.0 - smoothstep(-aa - mf_edge_d(edgeSoftness),
                                    aa + mf_edge_d(edgeSoftness), rr - Rl);
    vec3 rim3 = rim * vec3(pow(smoothstep(0.55, 1.0, rr / (Rl * eSc.x)), 4.0),
                               pow(smoothstep(0.55, 1.0, rr / (Rl * eSc.y)), 4.0),
                               pow(smoothstep(0.55, 1.0, rr / (Rl * eSc.z)), 4.0));

    vec3 nrm  = vec3(pn.x, pn.y, z);
    vec3 H    = normalize(vec3(Ld * 0.85, 0.55));
    float  spec = pow(max(dot(nrm, H), 0.0), 48.0) * glint * (0.4 + 0.6 * z);
    lin += rim3 * vec3(rimColor.rgb) + spec * vec3(glintColor.rgb);

    vec3 col = lqo_srgb(max(lin * max(exposure, 0.0), vec3(0.0)));

    float grainF = floor(ph * 24.0);
    float g = lqo_hash(floor(fc) + vec2(grainF * 17.13, grainF * 7.77)) - 0.5;
    col += vec3(g * LQO_GRAIN * grain);

    float w = clamp(1.0 - (rr - Rl) / max(haloOuter - Rl, 1e-4), 0.0, 1.0);
    float haloA = (halo > 0.001 && rr > Rl) ? halo * 0.85 * pow(w, 2.4) : 0.0;
    vec3 hc = lqo_okl(vec3(colorA.rgb));
    hc = vec3(min(1.0, hc.x + 0.12), hc.y * 0.85, hc.z * 0.85);
    vec3 haloRGB = lqo_srgb(max(lqo_lab2lin(hc), vec3(0.0)));

    vec3 outc = col * aEdge + haloRGB * (haloA * (1.0 - aEdge));
    outc = mf_edge_glow(outc, uv, vec2(0.0), R0,
                        edgeSoftness, edgeGlow, vec3(glowColor.rgb));
    gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}
`;

/* A nota desenha com `<Fill>`, que pinta o retângulo inteiro. O equivalente é
   um quad de tela cheia — dois triângulos em coordenadas de clip, sem matriz
   nenhuma, para que o `gl_FragCoord` chegue ao fragment shader sem passar por
   transformação. */
export const ORBE_VERTEX = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
