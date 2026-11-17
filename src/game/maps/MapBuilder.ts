import * as THREE from 'three';
import type { MapDefinition, MaterialTag } from '../../../shared/types/game.ts';
import { getProceduralTexture } from '../engine/Textures.ts';

export interface BuiltMapScene {
  group: THREE.Group;
  destructibleMeshes: Map<string, THREE.Mesh>;
  raycastTargets: THREE.Object3D[];
  dispose: () => void;
}

function getDefaultTint(mat: MaterialTag): string {
  switch (mat) {
    case 'concrete':
      return '#5c6470';
    case 'asphalt':
      return '#383e47';
    case 'metal':
      return '#334155';
    case 'crate':
      return '#b45309';
    case 'wood':
      return '#8a6642';
    case 'sand':
      return '#c29b6c';
    case 'glass':
      return '#7dd3fc';
    case 'hazard':
      return '#262f3d';
  }
}

export function buildMapScene(
  map: MapDefinition,
  anisotropy: number,
  enableShadows: boolean
): BuiltMapScene {
  const group = new THREE.Group();
  const destructibleMeshes = new Map<string, THREE.Mesh>();
  const raycastTargets: THREE.Object3D[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 1. Procedural Gradient Sky Dome
  const skyGeo = new THREE.SphereGeometry(240, 24, 16);
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 16;
  skyCanvas.height = 128;
  const sCtx = skyCanvas.getContext('2d')!;
  const grad = sCtx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, map.lighting.skyTop);
  grad.addColorStop(0.55, map.lighting.skyHorizon);
  grad.addColorStop(1, map.lighting.fogColor);
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 16, 128);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
  geometries.push(skyGeo);
  materials.push(skyMat);
  group.add(new THREE.Mesh(skyGeo, skyMat));

  // 2. Arena Ground + Extended Perimeter Skirt (never floating in void)
  const w = map.bounds.maxX - map.bounds.minX;
  const d = map.bounds.maxZ - map.bounds.minZ;
  const cx = (map.bounds.minX + map.bounds.maxX) / 2;
  const cz = (map.bounds.minZ + map.bounds.maxZ) / 2;

  const floorTex = getProceduralTexture(map.floorMaterial, getDefaultTint(map.floorMaterial), anisotropy).clone();
  floorTex.needsUpdate = true;
  floorTex.repeat.set(Math.max(4, w / 4), Math.max(4, d / 4));
  const floorGeo = new THREE.PlaneGeometry(w + 4, d + 4);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: map.floorMaterial === 'sand' ? 0.92 : 0.78,
    metalness: map.floorMaterial === 'metal' ? 0.45 : 0.08,
  });
  geometries.push(floorGeo);
  materials.push(floorMat);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(cx, 0, cz);
  floorMesh.receiveShadow = enableShadows;
  group.add(floorMesh);
  raycastTargets.push(floorMesh);

  // Outer perimeter ground extending to horizon fog
  const outerGeo = new THREE.RingGeometry(45, 220, 32);
  const outerMat = new THREE.MeshStandardMaterial({
    color: map.lighting.fogColor,
    roughness: 0.95,
    metalness: 0.02,
  });
  geometries.push(outerGeo);
  materials.push(outerMat);
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.rotation.x = -Math.PI / 2;
  outerMesh.position.set(cx, -0.05, cz);
  group.add(outerMesh);

  // Surrounding distant skyline / canyon silhouettes (InstancedMesh)
  const silCount = 32;
  const silGeo = new THREE.BoxGeometry(1, 1, 1);
  const silMat = new THREE.MeshStandardMaterial({
    color: map.environment === 'desert' ? '#8c6642' : '#1b2432',
    roughness: 0.9,
    metalness: 0.1,
  });
  geometries.push(silGeo);
  materials.push(silMat);
  const silInst = new THREE.InstancedMesh(silGeo, silMat, silCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < silCount; i++) {
    const angle = (i / silCount) * Math.PI * 2;
    const dist = 68 + (i % 4) * 14;
    const h = map.environment === 'desert' ? 14 + (i % 5) * 6 : 18 + (i % 6) * 9;
    const bw = 10 + (i % 3) * 5;
    dummy.position.set(cx + Math.cos(angle) * dist, h / 2 - 1, cz + Math.sin(angle) * dist);
    dummy.rotation.y = angle + (i % 3) * 0.2;
    dummy.scale.set(bw, h, bw);
    dummy.updateMatrix();
    silInst.setMatrixAt(i, dummy.matrix);
  }
  silInst.computeBoundingSphere();
  group.add(silInst);

  // 3. Map Box Colliders
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const getBoxMaterial = (kind: MaterialTag, colorHex?: string) => {
    const tint = colorHex || getDefaultTint(kind);
    const key = `${kind}_${tint}`;
    const cached = matCache.get(key);
    if (cached) return cached;

    if (kind === 'glass') {
      const m = new THREE.MeshStandardMaterial({
        color: tint,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.2,
      });
      materials.push(m);
      matCache.set(key, m);
      return m;
    }

    const tex = getProceduralTexture(kind, tint, anisotropy);
    const m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: kind === 'metal' || kind === 'crate' ? 0.42 : kind === 'sand' ? 0.9 : 0.72,
      metalness: kind === 'metal' ? 0.72 : kind === 'crate' ? 0.45 : 0.08,
    });
    materials.push(m);
    matCache.set(key, m);
    return m;
  };

  for (const col of map.colliders) {
    const sx = col.max.x - col.min.x;
    const sy = col.max.y - col.min.y;
    const sz = col.max.z - col.min.z;
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    geometries.push(geo);
    const mat = getBoxMaterial(col.material, col.color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((col.min.x + col.max.x) / 2, (col.min.y + col.max.y) / 2, (col.min.z + col.max.z) / 2);
    mesh.castShadow = enableShadows && col.material !== 'glass';
    mesh.receiveShadow = enableShadows;
    mesh.userData.materialTag = col.material;
    group.add(mesh);
    raycastTargets.push(mesh);

    if (col.destructible) {
      destructibleMeshes.set(col.id, mesh);
    }
  }

  // 4. Ramps / Stairs (inclined plane boxes)
  for (const r of map.ramps) {
    const rise = r.yEnd - r.yStart;
    const run = r.direction === 'north' || r.direction === 'south' ? r.length : r.width;
    const hyp = Math.hypot(run, rise);
    const angle = Math.atan2(rise, run);
    const wRamp = r.direction === 'north' || r.direction === 'south' ? r.width : r.length;

    const geo = new THREE.BoxGeometry(wRamp, 0.25, hyp);
    geometries.push(geo);
    const mat = getBoxMaterial(r.material, '#475569');
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(r.x, (r.yStart + r.yEnd) / 2 - 0.12, r.z);
    if (r.direction === 'north') mesh.rotation.x = angle;
    else if (r.direction === 'south') mesh.rotation.x = -angle;
    else if (r.direction === 'east') {
      mesh.rotation.y = -Math.PI / 2;
      mesh.rotation.x = angle;
    } else {
      mesh.rotation.y = Math.PI / 2;
      mesh.rotation.x = angle;
    }
    mesh.castShadow = enableShadows;
    mesh.receiveShadow = enableShadows;
    group.add(mesh);
    raycastTargets.push(mesh);
  }

  // 5. Environment-Specific Architectural Storytelling Props
  if (map.id === 'foundry') {
    // Overhead steel crane beams + molten glow core
    const beamGeo = new THREE.BoxGeometry(60, 0.9, 1.2);
    const beamMat = getBoxMaterial('metal', '#1f2937');
    geometries.push(beamGeo);
    for (const zPos of [-22, 0, 22]) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 9.2, zPos);
      group.add(beam);
    }
    const coreGeo = new THREE.CylinderGeometry(1.8, 2.2, 1.2, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
    geometries.push(coreGeo);
    materials.push(coreMat);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 4.4, 0);
    group.add(core);
  } else if (map.id === 'dustbasin') {
    // Communications lattice tower on central bunker
    const mastGeo = new THREE.CylinderGeometry(0.18, 0.55, 11, 6);
    const mastMat = getBoxMaterial('metal', '#64748b');
    geometries.push(mastGeo);
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 8.8, 0);
    group.add(mast);
  } else if (map.id === 'training_range') {
    // Distance lane markers on floor (10m, 20m, 30m, 40m)
    const lineGeo = new THREE.PlaneGeometry(24, 0.18);
    const lineMat = new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.7 });
    geometries.push(lineGeo);
    materials.push(lineMat);
    [-6, -16, -26, -34].forEach((zLine) => {
      const strip = new THREE.Mesh(lineGeo, lineMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0, 0.02, zLine);
      group.add(strip);
    });
  }

  return {
    group,
    destructibleMeshes,
    raycastTargets,
    dispose: () => {
      floorTex.dispose();
      skyTex.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
