import * as THREE from 'three';
import type { FlagRuntimeState, ObjectiveRuntimeState, TagDrop, TeamId } from '../../../shared/types/game.ts';

export class ObjectiveSyncManager {
  private scene: THREE.Scene;
  private objectiveMeshes = new Map<string, THREE.Mesh>();
  private tagMeshes = new Map<string, THREE.Mesh>();
  private flagMeshes = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public sync(
    objectives: ObjectiveRuntimeState[],
    tags: TagDrop[],
    flags: FlagRuntimeState[],
    localTeam: TeamId
  ) {
    this.syncObjectives(objectives);
    this.syncTags(tags, localTeam);
    this.syncFlags(flags);
  }

  public update(dt: number, elapsed: number) {
    for (const m of this.tagMeshes.values()) {
      m.rotation.y += dt * 2.4;
      m.position.y = 0.55 + Math.sin(elapsed * 3.5) * 0.12;
    }
  }

  private syncObjectives(objectives: ObjectiveRuntimeState[]) {
    const activeIds = new Set<string>();
    for (const o of objectives) {
      activeIds.add(o.id);
      let mesh = this.objectiveMeshes.get(o.id);
      if (!mesh) {
        const geo = new THREE.CylinderGeometry(o.radius, o.radius, 0.16, 32, 1, true);
        const mat = new THREE.MeshBasicMaterial({
          color: '#f59e0b',
          transparent: true,
          opacity: 0.48,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(o.x, o.y + 0.1, o.z);
        this.scene.add(mesh);
        this.objectiveMeshes.set(o.id, mesh);
      }
      mesh.visible = o.active;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(
        o.contested ? '#f59e0b' : o.owner === 'alpha' ? '#38bdf8' : o.owner === 'bravo' ? '#f43f5e' : '#eab308'
      );
    }
    for (const [id, m] of this.objectiveMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        this.objectiveMeshes.delete(id);
      }
    }
  }

  private syncTags(tags: TagDrop[], localTeam: TeamId) {
    const ids = new Set<string>();
    for (const t of tags) {
      ids.add(t.id);
      let m = this.tagMeshes.get(t.id);
      if (!m) {
        const geo = new THREE.OctahedronGeometry(0.32, 0);
        const mat = new THREE.MeshStandardMaterial({
          color: t.victimTeam === localTeam ? '#38bdf8' : '#ef4444',
          emissive: t.victimTeam === localTeam ? '#38bdf8' : '#ef4444',
          emissiveIntensity: 0.6,
          metalness: 0.8,
          roughness: 0.2,
        });
        m = new THREE.Mesh(geo, mat);
        m.position.set(t.x, t.y, t.z);
        this.scene.add(m);
        this.tagMeshes.set(t.id, m);
      }
    }
    for (const [id, m] of this.tagMeshes.entries()) {
      if (!ids.has(id)) {
        this.scene.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        this.tagMeshes.delete(id);
      }
    }
  }

  private syncFlags(flags: FlagRuntimeState[]) {
    for (const f of flags) {
      let grp = this.flagMeshes.get(f.team);
      if (!grp) {
        grp = new THREE.Group();
        const color = f.team === 'alpha' ? '#38bdf8' : '#f43f5e';
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8),
          new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 })
        );
        pole.position.y = 1.2;
        const banner = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.5, 0.05),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45 })
        );
        banner.position.set(0.4, 2.1, 0);
        grp.add(pole, banner);
        this.scene.add(grp);
        this.flagMeshes.set(f.team, grp);
      }
      grp.position.set(f.x, f.y, f.z);
    }
  }

  public dispose() {
    for (const m of this.objectiveMeshes.values()) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.objectiveMeshes.clear();
    for (const m of this.tagMeshes.values()) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.tagMeshes.clear();
    for (const grp of this.flagMeshes.values()) {
      this.scene.remove(grp);
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }
    this.flagMeshes.clear();
  }
}
