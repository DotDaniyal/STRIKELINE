import * as THREE from 'three';
import type { SprayDecal, Vec3 } from '../../../shared/types/game.ts';
import { getSprayTexture } from './Textures.ts';

interface TracerItem {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  life: number;
}

interface SparkItem {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

const _lookTarget = new THREE.Vector3();

export class CombatVfxManager {
  private scene: THREE.Scene;
  private isSoftwareGl: boolean;
  private tracers: TracerItem[] = [];
  private sparks: SparkItem[] = [];
  private sprayMeshes: THREE.Mesh[] = [];
  private sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  private sparkMat = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
  private sprayGeo = new THREE.PlaneGeometry(0.9, 0.9);

  constructor(scene: THREE.Scene, isSoftwareGl: boolean) {
    this.scene = scene;
    this.isSoftwareGl = isSoftwareGl;
  }

  public spawnTracer(from: Vec3, to: Vec3, color: string) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, mat, life: 0.08 });
  }

  public spawnSparks(at: Vec3) {
    const count = this.isSoftwareGl ? 2 : 5;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.set(at.x, at.y, at.z);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4.5, (Math.random() - 0.5) * 6),
        life: 0.24,
      });
    }
  }

  public placeSpray(decal: SprayDecal) {
    const mat = new THREE.MeshBasicMaterial({
      map: getSprayTexture(decal.sprayId),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const mesh = new THREE.Mesh(this.sprayGeo, mat);
    mesh.position.set(decal.x + decal.nx * 0.02, decal.y + decal.ny * 0.02, decal.z + decal.nz * 0.02);
    _lookTarget.set(decal.x + decal.nx, decal.y + decal.ny, decal.z + decal.nz);
    mesh.lookAt(_lookTarget);
    this.scene.add(mesh);
    this.sprayMeshes.push(mesh);
    if (this.sprayMeshes.length > 24) {
      const old = this.sprayMeshes.shift()!;
      this.scene.remove(old);
      (old.material as THREE.Material).dispose();
    }
  }

  public update(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      tr.mat.opacity = Math.max(0, tr.life / 0.08);
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.mat.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life -= dt;
      sp.vel.y -= 14 * dt;
      sp.mesh.position.addScaledVector(sp.vel, dt);
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        this.sparks.splice(i, 1);
      }
    }
  }

  public dispose() {
    for (const tr of this.tracers) {
      this.scene.remove(tr.line);
      tr.line.geometry.dispose();
      tr.mat.dispose();
    }
    this.tracers = [];
    for (const sp of this.sparks) {
      this.scene.remove(sp.mesh);
    }
    this.sparks = [];
    for (const sm of this.sprayMeshes) {
      this.scene.remove(sm);
      (sm.material as THREE.Material).dispose();
    }
    this.sprayMeshes = [];
    this.sparkGeo.dispose();
    this.sparkMat.dispose();
    this.sprayGeo.dispose();
  }
}
