import { encodeCanvas } from './images'

/**
 * Procedurally drawn sample artwork for the demo project and welcome screen.
 * Generated locally so the demo works offline and needs no third-party images.
 */

type Scene = 'dunes' | 'arch' | 'rings' | 'horizon' | 'peaks' | 'bands'

interface DemoSpec {
  name: string
  scene: Scene
  colors: [string, string, string, string]
}

export const DEMO_SPECS: DemoSpec[] = [
  { name: 'Golden dunes', scene: 'dunes', colors: ['#f3d9b1', '#e8a36b', '#c4693f', '#8a3b22'] },
  { name: 'Quiet arch', scene: 'arch', colors: ['#e9e1d4', '#b9c4b0', '#6f8466', '#f5efe6'] },
  { name: 'Coral rings', scene: 'rings', colors: ['#f6e7dc', '#ec9f86', '#d9664a', '#3c2a26'] },
  { name: 'Still sea', scene: 'horizon', colors: ['#dfe7ea', '#9fb7c0', '#4f6f7d', '#f2c4a0'] },
  { name: 'Sage peaks', scene: 'peaks', colors: ['#eef0e6', '#b8c2a5', '#7b8b6a', '#45523e'] },
  { name: 'Terracotta', scene: 'bands', colors: ['#f1e2cf', '#d98d5f', '#b6532f', '#2d2420'] },
  { name: 'Night arch', scene: 'arch', colors: ['#2a2733', '#4b4558', '#e8b07c', '#1d1b23'] },
  { name: 'Morning sea', scene: 'horizon', colors: ['#fbeee0', '#f3c3a1', '#d6876a', '#fff6ea'] },
  { name: 'Ink dunes', scene: 'dunes', colors: ['#e6e1d8', '#a9a196', '#5f5850', '#2b2724'] },
  { name: 'Olive rings', scene: 'rings', colors: ['#ecebdf', '#c9c59f', '#8d8a5c', '#3d3b29'] },
  { name: 'Clay peaks', scene: 'peaks', colors: ['#f7e6d8', '#e3b394', '#c07656', '#7a3f2b'] },
  { name: 'Dusk bands', scene: 'bands', colors: ['#2c2a35', '#5b4a5e', '#c97b63', '#f2c79b'] },
]

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, spec: DemoSpec, seed: number) {
  const [a, b, c, d] = spec.colors
  const rand = seeded(seed)
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, a)
  sky.addColorStop(1, b)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  switch (spec.scene) {
    case 'dunes': {
      ctx.fillStyle = d
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.arc(w * (0.3 + rand() * 0.4), h * 0.34, w * 0.13, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      const layers = [b, c, d]
      layers.forEach((color, i) => {
        const base = h * (0.55 + i * 0.13)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(0, base)
        ctx.bezierCurveTo(w * 0.3, base - h * (0.12 + rand() * 0.06), w * 0.6, base + h * 0.08, w, base - h * 0.06)
        ctx.lineTo(w, h)
        ctx.lineTo(0, h)
        ctx.closePath()
        ctx.fill()
      })
      break
    }
    case 'arch': {
      ctx.fillStyle = a
      ctx.fillRect(0, 0, w, h)
      const aw = w * 0.52
      const ax = (w - aw) / 2
      const top = h * 0.2
      const grad = ctx.createLinearGradient(0, top, 0, h)
      grad.addColorStop(0, b)
      grad.addColorStop(1, c)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(ax, h * 0.86)
      ctx.lineTo(ax, top + aw / 2)
      ctx.arc(w / 2, top + aw / 2, aw / 2, Math.PI, 0)
      ctx.lineTo(ax + aw, h * 0.86)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = d
      ctx.beginPath()
      ctx.arc(w / 2, top + aw * 0.62, aw * 0.16, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = c
      ctx.globalAlpha = 0.35
      ctx.fillRect(0, h * 0.86, w, h * 0.14)
      ctx.globalAlpha = 1
      break
    }
    case 'rings': {
      ctx.fillStyle = a
      ctx.fillRect(0, 0, w, h)
      const cx = w * (0.4 + rand() * 0.2)
      const cy = h * (0.45 + rand() * 0.1)
      ;[d, c, b, a, c].forEach((color, i) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, w * (0.46 - i * 0.085), 0, Math.PI * 2)
        ctx.fill()
      })
      break
    }
    case 'horizon': {
      const sea = ctx.createLinearGradient(0, h * 0.58, 0, h)
      sea.addColorStop(0, b)
      sea.addColorStop(1, c)
      ctx.fillStyle = d
      ctx.beginPath()
      ctx.arc(w * 0.5, h * 0.58, w * 0.16, Math.PI, 0)
      ctx.fill()
      ctx.fillStyle = sea
      ctx.fillRect(0, h * 0.58, w, h * 0.42)
      ctx.fillStyle = d
      for (let i = 0; i < 9; i++) {
        const y = h * (0.61 + i * 0.035)
        const lw = w * (0.3 - i * 0.025) * (0.8 + rand() * 0.4)
        ctx.globalAlpha = 0.55 - i * 0.05
        ctx.fillRect(w * 0.5 - lw / 2, y, lw, h * 0.008)
      }
      ctx.globalAlpha = 1
      break
    }
    case 'peaks': {
      ;[b, c, d].forEach((color, i) => {
        ctx.fillStyle = color
        ctx.beginPath()
        const base = h * (0.62 + i * 0.12)
        ctx.moveTo(0, base)
        const peaks = 3
        for (let p = 0; p <= peaks; p++) {
          const x = (w / peaks) * p + (rand() - 0.5) * w * 0.1
          const y = base - h * (0.18 + rand() * 0.16) * (p % 2 === 0 ? 0.6 : 1)
          ctx.lineTo(x - w / peaks / 2, base - h * 0.02)
          ctx.lineTo(x, y)
        }
        ctx.lineTo(w, base)
        ctx.lineTo(w, h)
        ctx.lineTo(0, h)
        ctx.closePath()
        ctx.fill()
      })
      break
    }
    case 'bands': {
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(-Math.PI / 7)
      const colors = [a, b, c, d, c, b]
      const band = h * 0.2
      colors.forEach((color, i) => {
        ctx.fillStyle = color
        ctx.fillRect(-w, -h + i * band * 1.1, w * 2, band * 1.1)
      })
      ctx.restore()
      ctx.fillStyle = a
      ctx.beginPath()
      ctx.arc(w * 0.7, h * 0.3, w * 0.08, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }

  // Subtle film grain for a photographic finish.
  const image = ctx.getImageData(0, 0, w, h)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * 14
    data[i] += n
    data[i + 1] += n
    data[i + 2] += n
  }
  ctx.putImageData(image, 0, 0)
}

export async function generateDemoImage(spec: DemoSpec, seed: number, width = 1080, height = 1350): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser can’t generate the demo images.')
  drawScene(ctx, width, height, spec, seed)
  const blob = await encodeCanvas(canvas, 'image/jpeg', 0.9)
  canvas.width = 0
  canvas.height = 0
  return blob
}
