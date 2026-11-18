import * as THREE from 'three';
import type { Vec3, WeaponId } from '../../../shared/types/game.ts';
import { WEAPONS } from '../../../shared/constants/weapons.ts';
import { audioEngine } from '../audio/AudioEngine.ts';
import type { CombatVfxManager } from './CombatVfx.ts';

interface RangeTarget {
  id: string;
  group: THREE.Group;
  headMesh: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  moving: boolean;
  speed: number;
  phase: number;
  hp: number;
  respawnAt: number;
}

export interface RangeHudStats {
  hits: number;
  shots: number;
  headshots: number;
  targetsDown: number;
  drillMode: 'free' | 'flick' | 'tracking';
  drillScore: number;
  drillTimeLeft: number;
}

const _raycaster = new THREE.Raycaster();
const _origVec = new THREE.Vector3();
const _dirVec = new THREE.Vector3();

export class TrainingRangeManager {
  private scene: THREE.Scene;
  private targets: RangeTarget[] = [];
  private hits = 0;
  private shots = 0;
  private headshots = 0;
  private targetsDown = 0;
  private drillMode: 'free' | 'flick' | 'tracking' = 'free';
  private drillScore = 0;
  private drillEndsAt = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public startDrill(drill: 'free' | 'flick' | 'tracking') {
    this.drillMode = drill;
    this.drillScore = 0;
    this.hits = 0;
    this.shots = 0;
    this.headshots = 0;
    this.targetsDown = 0;
    this.drillEndsAt = drill === 'free' ? 0 : performance.now() + 30000;
    this.spawnTargets();
  }

  public spawnTargets() {
    this.dispose();

    const specs =
      this.drillMode === 'flick'
        ? [
            { x: -7, z: -12, moving: false, speed: 0 },
            { x: -2.5, z: -15, moving: false, speed: 0 },
            { x: 2.5, z: -15, moving: false, speed: 0 },
            { x: 7, z: -12, moving: false, speed: 0 },
            { x: 0, z: -20, moving: false, speed: 0 },
          ]
        : this.drillMode === 'tracking'
        ? [
            { x: -4, z: -14, moving: true, speed: 3.4 },
            { x: 4, z: -22, moving: true, speed: 4.2 },
            { x: 0, z: -28, moving: true, speed: 4.8 },
          ]
        : [
            { x: -6, z: -8, moving: false, speed: 0 },
            { x: 0, z: -14, moving: false, speed: 0 },
            { x: 6, z: -20, moving: false, speed: 0 },
            { x: -4, z: -24, moving: true, speed: 2.5 },
            { x: 4, z: -30, moving: true, speed: 3.2 },
          ];

    specs.forEach((sp, i) => {
      const grp = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.35 });
      const bodyMat = new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.4, metalness: 0.25 });
      const headMat = new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        emissive: '#f59e0b',
        emissiveIntensity: 0.35,
        roughness: 0.3,
      });

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 10), postMat);
      post.position.y = 0.45;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.14), bodyMat);
      body.position.y = 1.15;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), headMat);
      head.position.y = 1.68;
      grp.add(post, body, head);
      grp.position.set(sp.x, 0, sp.z);
      this.scene.add(grp);

      this.targets.push({
        id: `tgt_${i}`,
        group: grp,
        headMesh: head,
        bodyMesh: body,
        baseX: sp.x,
        baseZ: sp.z,
        moving: sp.moving,
        speed: sp.speed,
        phase: i * 1.4,
        hp: 100,
        respawnAt: 0,
      });
    });
  }

  public handleShot(
    weaponId: WeaponId,
    origin: Vec3,
    dirs: Vec3[],
    tracerColor: string,
    showTracers: boolean,
    raycastTargets: THREE.Object3D[],
    vfx: CombatVfxManager,
    onHitmarker?: (headshot: boolean, killed: boolean) => void
  ) {
    this.shots += 1;
    _origVec.set(origin.x, origin.y, origin.z);
    const activeTargets = this.targets.filter((t) => t.hp > 0);
    const targetMeshes = activeTargets.flatMap((t) => [t.headMesh, t.bodyMesh]);
    const allObjects = [...raycastTargets, ...targetMeshes];

    let anyHit = false;
    for (const d of dirs) {
      _dirVec.set(d.x, d.y, d.z);
      _raycaster.set(_origVec, _dirVec);
      _raycaster.far = 140;
      const hits = _raycaster.intersectObjects(allObjects, false);
      const end = hits[0]
        ? { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z }
        : { x: origin.x + d.x * 100, y: origin.y + d.y * 100, z: origin.z + d.z * 100 };

      if (showTracers) {
        vfx.spawnTracer(origin, end, tracerColor);
      }
      vfx.spawnSparks(end);

      if (hits[0]) {
        const hitObj = hits[0].object;
        const tgt = activeTargets.find((t) => t.headMesh === hitObj || t.bodyMesh === hitObj);
        if (tgt) {
          anyHit = true;
          const isHead = tgt.headMesh === hitObj;
          const w = WEAPONS[weaponId];
          const dmg = isHead ? w.damageHead : w.damageBody;
          tgt.hp = Math.max(0, tgt.hp - dmg);
          if (isHead) this.headshots += 1;
          const killed = tgt.hp <= 0;
          audioEngine.playHitmarker(isHead);
          onHitmarker?.(isHead, killed);
          if (killed) {
            this.targetsDown += 1;
            this.drillScore += isHead ? 150 : 100;
            tgt.group.visible = false;
            tgt.respawnAt = performance.now() + 1400;
            audioEngine.playElimination();
          }
        }
      }
    }
    if (anyHit) this.hits += 1;
  }

  public update(elapsed: number, now: number) {
    if (this.drillEndsAt > 0 && now >= this.drillEndsAt) {
      this.drillMode = 'free';
      this.drillEndsAt = 0;
    }
    for (const t of this.targets) {
      if (t.hp <= 0 && now >= t.respawnAt) {
        t.hp = 100;
        t.group.visible = true;
      }
      if (t.moving && t.hp > 0) {
        t.group.position.x = t.baseX + Math.sin(elapsed * t.speed + t.phase) * 4.5;
      }
    }
  }

  public getStats(now: number): RangeHudStats {
    return {
      hits: this.hits,
      shots: this.shots,
      headshots: this.headshots,
      targetsDown: this.targetsDown,
      drillMode: this.drillMode,
      drillScore: this.drillScore,
      drillTimeLeft: this.drillEndsAt > 0 ? Math.max(0, Math.ceil((this.drillEndsAt - now) / 1000)) : 0,
    };
  }

  public dispose() {
    for (const t of this.targets) {
      this.scene.remove(t.group);
      t.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }
    this.targets = [];
  }
}
