import * as THREE from 'three';
import type { MaterialTag } from '../../../shared/types/game.ts';

const textureCache = new Map<string, THREE.CanvasTexture>();

function createCanvas(w = 256, h = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

export function getProceduralTexture(
  kind: MaterialTag | 'floor_grid',
  tintHex: string,
  anisotropy = 4
): THREE.CanvasTexture {
  const key = `${kind}_${tintHex}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = tintHex;
  ctx.fillRect(0, 0, 256, 256);

  if (kind === 'concrete' || kind === 'asphalt') {
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const alpha = Math.random() * 0.08;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 252, 252);
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.stroke();
  } else if (kind === 'metal') {
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, y, 256, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 248);
    // Corner rivets
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    [14, 242].forEach((rx) =>
      [14, 242].forEach((ry) => {
        ctx.beginPath();
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
        ctx.fill();
      })
    );
  } else if (kind === 'crate') {
    // Corrugated cargo container ribs
    for (let x = 0; x < 256; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x, 0, 6, 256);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 6, 0, 3, 256);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, 256, 256);
  } else if (kind === 'wood') {
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y, 256, 2);
    }
    ctx.strokeStyle = 'rgba(30,20,10,0.45)';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, 244, 244);
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(246, 246);
    ctx.stroke();
  } else if (kind === 'sand') {
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,240,210,0.07)' : 'rgba(90,55,20,0.07)';
      ctx.fillRect(x, y, 2, 2);
    }
  } else if (kind === 'hazard' || kind === 'floor_grid') {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    if (kind === 'hazard') {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      for (let x = -256; x < 256; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 14, 0);
        ctx.lineTo(x + 44, 30);
        ctx.lineTo(x + 30, 30);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function getSprayTexture(sprayId: string): THREE.CanvasTexture {
  const key = `spray_${sprayId}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const [canvas, ctx] = createCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);

  ctx.translate(128, 128);
  ctx.lineWidth = 10;

  if (sprayId === 'spray_skull_crown') {
    ctx.strokeStyle = '#fbbf24';
    ctx.fillStyle = 'rgba(17,24,39,0.72)';
    ctx.beginPath();
    ctx.arc(0, 0, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-55, 35);
    ctx.lineTo(-65, -35);
    ctx.lineTo(-25, 0);
    ctx.lineTo(0, -55);
    ctx.lineTo(25, 0);
    ctx.lineTo(65, -35);
    ctx.lineTo(55, 35);
    ctx.closePath();
    ctx.fill();
  } else if (sprayId === 'spray_hazard_x') {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(-75, -75);
    ctx.lineTo(75, 75);
    ctx.moveTo(75, -75);
    ctx.lineTo(-75, 75);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeRect(-92, -92, 184, 184);
  } else {
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = 'rgba(15,23,42,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.lineTo(-42, 0);
    ctx.moveTo(42, 0);
    ctx.lineTo(110, 0);
    ctx.moveTo(0, -110);
    ctx.lineTo(0, -42);
    ctx.moveTo(0, 42);
    ctx.lineTo(0, 110);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const key = 'contact_shadow';
  const existing = textureCache.get(key);
  if (existing) return existing;

  const [canvas, ctx] = createCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  textureCache.set(key, tex);
  return tex;
}
