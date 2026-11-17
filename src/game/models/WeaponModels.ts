import * as THREE from 'three';
import type { WeaponId } from '../../../shared/types/game.ts';
import { COSMETIC_CATALOG } from '../../../shared/constants/catalog.ts';

export interface WeaponViewModel {
  root: THREE.Group;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  magazine: THREE.Mesh;
  slideOrBolt: THREE.Mesh;
  dispose: () => void;
}

function getSkinMaterials(skinId: string) {
  const item = COSMETIC_CATALOG.find((i) => i.id === skinId);
  const primary = item?.previewColor ?? '#2b323d';
  const secondary = item?.secondaryColor ?? '#161a21';
  const accent = item?.accentColor ?? '#f59e0b';
  const metalness = item?.metalness ?? 0.72;
  const roughness = item?.roughness ?? 0.42;

  const receiverMat = new THREE.MeshStandardMaterial({
    color: primary,
    metalness,
    roughness,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: '#181c23',
    metalness: 0.9,
    roughness: 0.25,
  });
  const polymerMat = new THREE.MeshStandardMaterial({
    color: secondary,
    metalness: 0.15,
    roughness: 0.72,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.8,
    roughness: 0.25,
    emissive: accent,
    emissiveIntensity: 0.2,
  });
  const opticGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#38bdf8',
    metalness: 0.1,
    roughness: 0.08,
    transparent: true,
    opacity: 0.55,
    clearcoat: 1.0,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#1e242d',
    metalness: 0.05,
    roughness: 0.85,
  });

  return { receiverMat, barrelMat, polymerMat, accentMat, opticGlassMat, gloveMat };
}

export function buildWeaponModel(weaponId: WeaponId, skinId = 'skin_standard_matte', withHands = true): WeaponViewModel {
  const root = new THREE.Group();
  const mats = getSkinMaterials(skinId);
  const disposables: Array<{ dispose: () => void }> = [
    mats.receiverMat,
    mats.barrelMat,
    mats.polymerMat,
    mats.accentMat,
    mats.opticGlassMat,
    mats.gloveMat,
  ];

  const addPart = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], rot?: [number, number, number]) => {
    disposables.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    root.add(m);
    return m;
  };

  let barrelLen = 0.42;
  let magMesh: THREE.Mesh;
  let slideMesh: THREE.Mesh;

  if (weaponId === 'viper_pistol') {
    barrelLen = 0.22;
    addPart(new THREE.BoxGeometry(0.038, 0.042, 0.22), mats.polymerMat, [0, 0.01, -0.04]); // frame
    slideMesh = addPart(new THREE.BoxGeometry(0.04, 0.036, 0.24), mats.receiverMat, [0, 0.046, -0.05]); // slide
    addPart(new THREE.BoxGeometry(0.032, 0.11, 0.048), mats.polymerMat, [0, -0.065, 0.03], [0.22, 0, 0]); // grip
    magMesh = addPart(new THREE.BoxGeometry(0.026, 0.1, 0.038), mats.barrelMat, [0, -0.068, 0.03], [0.22, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), mats.barrelMat, [0, 0.042, -0.18], [Math.PI / 2, 0, 0]);
    addPart(new THREE.BoxGeometry(0.008, 0.012, 0.015), mats.accentMat, [0, 0.07, -0.15]); // front sight
  } else if (weaponId === 'spectre_smg') {
    barrelLen = 0.32;
    addPart(new THREE.BoxGeometry(0.054, 0.075, 0.34), mats.receiverMat, [0, 0.02, -0.05]); // upper
    addPart(new THREE.BoxGeometry(0.048, 0.055, 0.22), mats.polymerMat, [0, 0.015, -0.24]); // shroud
    slideMesh = addPart(new THREE.BoxGeometry(0.02, 0.018, 0.06), mats.accentMat, [0.03, 0.035, -0.08]); // charging handle
    addPart(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 12), mats.barrelMat, [0, 0.025, -0.38], [Math.PI / 2, 0, 0]); // suppressor-style barrel
    magMesh = addPart(new THREE.BoxGeometry(0.03, 0.18, 0.042), mats.barrelMat, [0, -0.1, -0.14], [-0.15, 0, 0]); // vertical mag
    addPart(new THREE.BoxGeometry(0.034, 0.11, 0.044), mats.polymerMat, [0, -0.07, 0.06], [0.22, 0, 0]); // grip
    addPart(new THREE.BoxGeometry(0.036, 0.065, 0.18), mats.polymerMat, [0, 0.015, 0.19]); // compact stock
    // Reflex optic
    addPart(new THREE.BoxGeometry(0.044, 0.034, 0.075), mats.barrelMat, [0, 0.078, -0.02]);
    addPart(new THREE.PlaneGeometry(0.032, 0.024), mats.opticGlassMat, [0, 0.078, 0.019]);
  } else if (weaponId === 'longshot_sr') {
    barrelLen = 0.72;
    addPart(new THREE.BoxGeometry(0.058, 0.085, 0.44), mats.receiverMat, [0, 0.02, -0.04]);
    addPart(new THREE.BoxGeometry(0.048, 0.055, 0.36), mats.polymerMat, [0, 0.015, -0.34]); // forend
    addPart(new THREE.CylinderGeometry(0.014, 0.016, 0.42, 12), mats.barrelMat, [0, 0.032, -0.58], [Math.PI / 2, 0, 0]);
    addPart(new THREE.BoxGeometry(0.032, 0.032, 0.065), mats.accentMat, [0, 0.032, -0.78]); // muzzle brake
    slideMesh = addPart(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 10), mats.barrelMat, [0.028, 0.04, 0.02], [Math.PI / 2, 0, 0]); // bolt
    magMesh = addPart(new THREE.BoxGeometry(0.036, 0.1, 0.09), mats.barrelMat, [0, -0.065, -0.09]);
    addPart(new THREE.BoxGeometry(0.042, 0.11, 0.05), mats.polymerMat, [0, -0.075, 0.11], [0.22, 0, 0]);
    addPart(new THREE.BoxGeometry(0.045, 0.09, 0.28), mats.polymerMat, [0, 0.005, 0.28]); // sniper stock
    // Long-range scope
    addPart(new THREE.CylinderGeometry(0.024, 0.024, 0.26, 14), mats.barrelMat, [0, 0.098, -0.04], [Math.PI / 2, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.032, 0.026, 0.06, 14), mats.receiverMat, [0, 0.098, -0.18], [Math.PI / 2, 0, 0]);
    addPart(new THREE.CircleGeometry(0.022, 14), mats.opticGlassMat, [0, 0.098, 0.092]);
  } else if (weaponId === 'breacher_sg') {
    barrelLen = 0.52;
    addPart(new THREE.BoxGeometry(0.062, 0.088, 0.34), mats.receiverMat, [0, 0.02, -0.02]);
    addPart(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 12), mats.barrelMat, [0, 0.04, -0.36], [Math.PI / 2, 0, 0]); // barrel
    addPart(new THREE.CylinderGeometry(0.014, 0.014, 0.38, 10), mats.barrelMat, [0, 0.005, -0.33], [Math.PI / 2, 0, 0]); // tube mag
    slideMesh = addPart(new THREE.BoxGeometry(0.055, 0.05, 0.18), mats.polymerMat, [0, 0.0, -0.28]); // pump forend
    magMesh = addPart(new THREE.BoxGeometry(0.04, 0.02, 0.1), mats.accentMat, [0, -0.02, -0.02]); // shell port
    addPart(new THREE.BoxGeometry(0.042, 0.11, 0.05), mats.polymerMat, [0, -0.075, 0.1], [0.26, 0, 0]);
    addPart(new THREE.BoxGeometry(0.046, 0.095, 0.24), mats.polymerMat, [0, 0.0, 0.25]);
  } else {
    // Assault Rifle / DMR / Burst Rifle modular chassis
    barrelLen = weaponId === 'warden_dmr' ? 0.58 : 0.48;
    addPart(new THREE.BoxGeometry(0.058, 0.088, 0.36), mats.receiverMat, [0, 0.02, -0.02]); // upper/lower receiver
    addPart(new THREE.BoxGeometry(0.05, 0.062, 0.28), mats.polymerMat, [0, 0.022, -0.32]); // MLOK handguard
    addPart(new THREE.BoxGeometry(0.044, 0.012, 0.58), mats.barrelMat, [0, 0.068, -0.15]); // picatinny rail
    addPart(new THREE.CylinderGeometry(0.013, 0.014, barrelLen - 0.16, 12), mats.barrelMat, [0, 0.025, -0.42 - (barrelLen - 0.48) * 0.5], [Math.PI / 2, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.018, 0.016, 0.055, 10), mats.accentMat, [0, 0.025, -barrelLen - 0.1], [Math.PI / 2, 0, 0]); // muzzle brake
    slideMesh = addPart(new THREE.BoxGeometry(0.018, 0.016, 0.065), mats.accentMat, [0.032, 0.042, -0.03]); // bolt carrier
    const magLen = weaponId === 'warden_dmr' ? 0.13 : 0.17;
    magMesh = addPart(new THREE.BoxGeometry(0.032, magLen, 0.068), mats.barrelMat, [0, -0.09, -0.1], [0.16, 0, 0]);
    addPart(new THREE.BoxGeometry(0.036, 0.115, 0.046), mats.polymerMat, [0, -0.075, 0.08], [0.24, 0, 0]); // pistol grip
    addPart(new THREE.BoxGeometry(0.044, 0.095, 0.24), mats.polymerMat, [0, 0.01, 0.25]); // adjustable stock
    // Holographic / ACOG optic
    const opticLen = weaponId === 'warden_dmr' ? 0.14 : 0.08;
    addPart(new THREE.BoxGeometry(0.048, 0.042, opticLen), mats.barrelMat, [0, 0.094, -0.02]);
    addPart(new THREE.PlaneGeometry(0.034, 0.026), mats.opticGlassMat, [0, 0.094, opticLen / 2 - 0.019]);
  }

  if (withHands) {
    // Gloved tactical left support hand & right trigger hand
    addPart(new THREE.BoxGeometry(0.055, 0.052, 0.09), mats.gloveMat, [-0.02, -0.025, -0.26], [0, 0.18, 0]);
    addPart(new THREE.BoxGeometry(0.048, 0.07, 0.06), mats.gloveMat, [0.005, -0.065, 0.08], [0.22, 0, 0]);
  }

  // Muzzle point & flash mesh
  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.03, -barrelLen - 0.12);
  root.add(muzzlePoint);

  const flashGeo = new THREE.OctahedronGeometry(0.085, 0);
  const flashMat = new THREE.MeshBasicMaterial({
    color: '#fde047',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(flashGeo, flashMat);
  const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.scale.set(0.8, 0.8, 2.2);
  muzzleFlash.visible = false;
  muzzlePoint.add(muzzleFlash);

  return {
    root,
    muzzlePoint,
    muzzleFlash,
    magazine: magMesh,
    slideOrBolt: slideMesh,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
