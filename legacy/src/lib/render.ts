import type { EditorDoc } from '../types/studio'
import { aspectValue } from '../types/studio'

type Palette = { a: string; b: string; c: string }

const palettes: Record<string, Palette> = {
  aurora: { a: '#ff8a98', b: '#7148cc', c: '#402559' },
  chrome: { a: '#c7efff', b: '#596a92', c: '#202b43' },
  petal: { a: '#ffb574', b: '#a62b62', c: '#501b3c' },
  orbit: { a: '#be93ff', b: '#4c39b4', c: '#271961' },
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, from: string, to: string) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(radius, 1))
  gradient.addColorStop(0, from)
  gradient.addColorStop(1, to)
  return gradient
}

/**
 * Redesenha a composição do artboard em canvas. Não é uma captura do DOM:
 * as mesmas variáveis que o CSS usa alimentam os gradientes aqui, para que
 * o PNG exportado corresponda ao que está na tela.
 */
export function renderArtboard(doc: EditorDoc, options: { width?: number } = {}) {
  const ratio = aspectValue(doc.aspectRatio)
  const width = options.width ?? (doc.upscaled ? 2160 : 1080)
  const height = Math.round(width / ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE')

  const palette = palettes[doc.art] ?? palettes.aurora
  const artLayer = doc.layers.find((layer) => layer.kind === 'art')
  const showArt = artLayer ? artLayer.visible : true

  /* fundo — xadrez quando o fundo foi removido, como num editor real */
  if (doc.bgRemoved) {
    const cell = Math.round(width / 26)
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        ctx.fillStyle = ((x / cell) + (y / cell)) % 2 === 0 ? '#2a2d31' : '#212427'
        ctx.fillRect(x, y, cell, cell)
      }
    }
  } else {
    ctx.fillStyle = '#0a0b0d'
    ctx.fillRect(0, 0, width, height)
  }

  ctx.save()
  ctx.filter = `saturate(${doc.temperature / 50}) contrast(${doc.contrast / 50})`

  if (showArt && !doc.bgRemoved) {
    ctx.fillStyle = radial(ctx, width * 0.5, height * 0.5, width * 0.65, palette.c, '#0a0b0d')
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = radial(ctx, width * 0.49, height * 0.42, width * 0.3, palette.b, withAlpha(palette.b, 0))
    ctx.fillRect(0, 0, width, height)
  }

  if (showArt) {
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.rotate((doc.rotation * Math.PI) / 180)
    ctx.translate(-width / 2, -height / 2)

    /* glows */
    ctx.globalAlpha = 0.38
    ctx.fillStyle = radial(ctx, width * 0.78, height * 0.26, width * 0.26, palette.a, withAlpha(palette.a, 0))
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = radial(ctx, width * 0.24, height * 0.8, width * 0.24, palette.b, withAlpha(palette.b, 0))
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1

    /* núcleo de vidro */
    const cx = width * 0.6
    const cy = height * 0.42
    const rx = width * 0.2
    const ry = height * 0.19
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((-18 * Math.PI) / 180)
    const core = ctx.createLinearGradient(-rx, -ry, rx, ry)
    core.addColorStop(0, 'rgba(255,255,255,0.9)')
    core.addColorStop(0.18, palette.a)
    core.addColorStop(0.43, 'rgba(255,255,255,0.08)')
    core.addColorStop(0.7, palette.b)
    core.addColorStop(1, 'rgba(255,255,255,0.65)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()

    /* anéis */
    ctx.lineWidth = Math.max(width * 0.011, 2)
    ctx.strokeStyle = palette.a
    ctx.beginPath()
    ctx.ellipse(0, 0, rx * 1.6, ry * 0.62, (17 * Math.PI) / 180, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = palette.b
    ctx.beginPath()
    ctx.ellipse(0, 0, rx * 0.72, ry * 1.55, (-31 * Math.PI) / 180, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    ctx.restore()
  }

  ctx.restore()

  /* camadas de texto e forma */
  for (const layer of doc.layers) {
    if (!layer.visible) continue
    const x = ((layer.x ?? 8) / 100) * width
    const y = ((layer.y ?? 50) / 100) * height

    if (layer.kind === 'text' && layer.text) {
      const size = ((layer.size ?? 40) / 1000) * width
      const isTitle = (layer.size ?? 0) >= 60
      ctx.fillStyle = isTitle ? '#ffffff' : 'rgba(255,255,255,0.7)'
      ctx.font = isTitle
        ? `700 ${size}px "Space Grotesk", system-ui, sans-serif`
        : `400 ${size}px Inter, system-ui, sans-serif`
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(isTitle ? layer.text.toUpperCase() : layer.text, x, y)
    }

    if (layer.kind === 'shape') {
      ctx.fillStyle = layer.color ?? '#be93ff'
      const size = ((layer.size ?? 20) / 100) * width
      if (layer.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(x, y, size, size * 0.7)
      }
    }
  }

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('BLOB_FAILED'))), 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  /* O anchor sai no próximo tick e a URL só é revogada bem depois:
     revogar cedo demais pode abortar a gravação de blobs grandes. */
  window.setTimeout(() => anchor.remove(), 0)
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'pitch-studio'
}

export async function exportDoc(doc: EditorDoc, name: string) {
  if (document.fonts?.ready) await document.fonts.ready
  const canvas = renderArtboard(doc)
  const blob = await canvasToBlob(canvas)
  const filename = `${slug(name)}.png`
  downloadBlob(blob, filename)
  return filename
}

/** Miniatura usada na Biblioteca e no download de um asset avulso. */
export async function exportArt(art: string, name: string) {
  const doc: EditorDoc = {
    art,
    aspectRatio: '1:1',
    layers: [{ id: 'art', kind: 'art', name: 'Arte', visible: true }],
    temperature: 58,
    contrast: 52,
    rotation: 0,
    upscaled: false,
    bgRemoved: false,
  }
  if (document.fonts?.ready) await document.fonts.ready
  const blob = await canvasToBlob(renderArtboard(doc))
  downloadBlob(blob, `${slug(name)}.png`)
}
