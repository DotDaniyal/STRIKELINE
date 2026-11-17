import * as THREE from 'three';
import type { MovementState, TeamId, WeaponId } from '../../../shared/types/game.ts';
import { COSMETIC_CATALOG } from '../../../shared/constants/catalog.ts';
import { createRadialContactShadowTexture } from '../engine/Textures.ts';
import { buildWeaponModel, type WeaponViewModel } from './WeaponModels.ts';

export class OperatorRig {
  public readonly root: THREE.Group;
  private bodyGroup: THREE.Group;
  private headGroup: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private weaponMount: THREE.Group;
  private weaponModel: WeaponViewModel;
  private shadowDisc: THREE.Mesh;
  private nameplate: THREE.Sprite | null = null;
  private currentWeaponId: WeaponId;
  private currentSkinId: string;
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private ragdollActive = false;
  private ragdollVel = new THREE.Vector3();
  private ragdollTimer = 0;

  constructor(opts: {
    username?: string;
    team: TeamId;
    operatorSkin: string;
    weaponId: WeaponId;
    weaponSkin: string;
    isBot?: boolean;
  }) {
    this.root = new THREE.Group();
    this.currentWeaponId = opts.weaponId;
    this.currentSkinId = opts.weaponSkin;

    const skinCfg = COSMETIC_CATALOG.find((c) => c.id === opts.operatorSkin);
    const armorColor = skinCfg?.previewColor ?? '#252d3a';
    const underColor = skinCfg?.secondaryColor ?? '#141922';
    const teamAccent =
      opts.team === 'alpha' ? '#38bdf8' : opts.team === 'bravo' ? '#f43f5e' : '#f59e0b';

    const armorMat = new THREE.MeshStandardMaterial({
      color: armorColor,
      roughness: 0.42,
      metalness: 0.35,
    });
    const underMat = new THREE.MeshStandardMaterial({
      color: underColor,
      roughness: 0.78,
      metalness: 0.1,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: teamAccent,
      emissive: teamAccent,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.6,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: teamAccent,
      emissive: teamAccent,
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.9,
    });
    this.materials.push(armorMat, underMat, accentMat, visorMat);

    // Ground contact shadow disc (bottom-center pivot y=0)
    const shadowGeo = new THREE.PlaneGeometry(1.1, 1.1);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createRadialContactShadowTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.geometries.push(shadowGeo);
    this.materials.push(shadowMat);
    this.shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowDisc.rotation.x = -Math.PI / 2;
    this.shadowDisc.position.y = 0.02;
    this.root.add(this.shadowDisc);

    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    // Torso plate carrier + backpack
    const torsoGeo = new THREE.BoxGeometry(0.46, 0.56, 0.28);
    const chestPlateGeo = new THREE.BoxGeometry(0.48, 0.34, 0.31);
    const packGeo = new THREE.BoxGeometry(0.32, 0.38, 0.16);
    const beltGeo = new THREE.BoxGeometry(0.47, 0.08, 0.29);
    this.geometries.push(torsoGeo, chestPlateGeo, packGeo, beltGeo);

    const torso = new THREE.Mesh(torsoGeo, underMat);
    torso.position.y = 1.04;
    torso.castShadow = true;
    const chest = new THREE.Mesh(chestPlateGeo, armorMat);
    chest.position.set(0, 1.1, 0);
    chest.castShadow = true;
    const pack = new THREE.Mesh(packGeo, armorMat);
    pack.position.set(0, 1.1, 0.2);
    const belt = new THREE.Mesh(beltGeo, accentMat);
    belt.position.set(0, 0.78, 0);
    this.bodyGroup.add(torso, chest, pack, belt);

    // Head + Helmet + Visor
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.46, 0);
    const helmetGeo = new THREE.BoxGeometry(0.28, 0.26, 0.3);
    const visorGeo = new THREE.BoxGeometry(0.26, 0.09, 0.06);
    this.geometries.push(helmetGeo, visorGeo);
    const helmet = new THREE.Mesh(helmetGeo, armorMat);
    helmet.position.y = 0.1;
    helmet.castShadow = true;
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.1, -0.14);
    this.headGroup.add(helmet, visor);
    this.bodyGroup.add(this.headGroup);

    // Arms + Weapon Mount
    const armGeo = new THREE.BoxGeometry(0.14, 0.48, 0.15);
    const shoulderGeo = new THREE.BoxGeometry(0.18, 0.14, 0.2);
    this.geometries.push(armGeo, shoulderGeo);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.31, 1.24, 0);
    const lArmMesh = new THREE.Mesh(armGeo, underMat);
    lArmMesh.position.y = -0.2;
    const lShoulder = new THREE.Mesh(shoulderGeo, armorMat);
    this.leftArm.add(lArmMesh, lShoulder);
    this.leftArm.rotation.x = 1.1;
    this.leftArm.rotation.z = -0.25;

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.31, 1.24, 0);
    const rArmMesh = new THREE.Mesh(armGeo, underMat);
    rArmMesh.position.y = -0.2;
    const rShoulder = new THREE.Mesh(shoulderGeo, armorMat);
    this.rightArm.add(rArmMesh, rShoulder);
    this.rightArm.rotation.x = 1.25;

    this.weaponMount = new THREE.Group();
    this.weaponMount.position.set(0.16, 1.16, -0.24);
    this.weaponModel = buildWeaponModel(opts.weaponId, opts.weaponSkin, false);
    this.weaponModel.root.scale.setScalar(0.85);
    this.weaponMount.add(this.weaponModel.root);

    this.bodyGroup.add(this.leftArm, this.rightArm, this.weaponMount);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.72, 0.19);
    const kneeGeo = new THREE.BoxGeometry(0.19, 0.12, 0.21);
    this.geometries.push(legGeo, kneeGeo);

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.13, 0.74, 0);
    const lLegMesh = new THREE.Mesh(legGeo, underMat);
    lLegMesh.position.y = -0.36;
    lLegMesh.castShadow = true;
    const lKnee = new THREE.Mesh(kneeGeo, armorMat);
    lKnee.position.y = -0.34;
    this.leftLeg.add(lLegMesh, lKnee);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.13, 0.74, 0);
    const rLegMesh = new THREE.Mesh(legGeo, underMat);
    rLegMesh.position.y = -0.36;
    rLegMesh.castShadow = true;
    const rKnee = new THREE.Mesh(kneeGeo, armorMat);
    rKnee.position.y = -0.34;
    this.rightLeg.add(rLegMesh, rKnee);

    this.bodyGroup.add(this.leftLeg, this.rightLeg);

    if (opts.username) {
      this.nameplate = this.createNameplate(opts.username, teamAccent);
      this.nameplate.position.set(0, 2.08, 0);
      this.root.add(this.nameplate);
    }
  }

  private createNameplate(label: string, accentHex: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 56;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(11, 14, 20, 0.78)';
    ctx.fillRect(10, 8, 236, 40);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 8, 236, 40);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px Chakra Petch, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.slice(0, 16), 128, 29);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    this.materials.push(mat);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.35, 0.3, 1);
    return sprite;
  }

  public setWeapon(weaponId: WeaponId, skinId: string) {
    if (this.currentWeaponId === weaponId && this.currentSkinId === skinId) return;
    this.currentWeaponId = weaponId;
    this.currentSkinId = skinId;
    this.weaponMount.remove(this.weaponModel.root);
    this.weaponModel.dispose();
    this.weaponModel = buildWeaponModel(weaponId, skinId, false);
    this.weaponModel.root.scale.setScalar(0.85);
    this.weaponMount.add(this.weaponModel.root);
  }

  public triggerRagdoll(impulse: { x: number; y: number; z: number }) {
    this.ragdollActive = true;
    this.ragdollTimer = 0;
    this.ragdollVel.set(impulse.x, impulse.y, impulse.z);
    if (this.nameplate) this.nameplate.visible = false;
  }

  public resetAlive() {
    this.ragdollActive = false;
    this.bodyGroup.rotation.set(0, 0, 0);
    this.bodyGroup.position.set(0, 0, 0);
    if (this.nameplate) this.nameplate.visible = true;
  }

  public update(dt: number, elapsed: number, state: MovementState, pitch: number) {
    if (this.ragdollActive) {
      this.ragdollTimer += dt;
      if (this.ragdollTimer < 0.55) {
        this.root.position.addScaledVector(this.ragdollVel, dt * 0.45);
        this.ragdollVel.y -= 16 * dt;
        if (this.root.position.y < 0) this.root.position.y = 0;
        this.bodyGroup.rotation.x = THREE.MathUtils.lerp(this.bodyGroup.rotation.x, -Math.PI / 2, dt * 10);
        this.bodyGroup.position.y = THREE.MathUtils.lerp(this.bodyGroup.position.y, 0.25, dt * 10);
      }
      return;
    }

    this.headGroup.rotation.x = THREE.MathUtils.clamp(pitch * 0.7, -0.7, 0.7);
    this.weaponMount.rotation.x = THREE.MathUtils.clamp(pitch * 0.7, -0.7, 0.7);

    const isCrouch = state === 'crouch';
    const isSlide = state === 'slide';
    const targetY = isSlide ? -0.35 : isCrouch ? -0.28 : 0;
    this.bodyGroup.position.y = THREE.MathUtils.damp(this.bodyGroup.position.y, targetY, 14, dt);
    this.bodyGroup.rotation.x = THREE.MathUtils.damp(this.bodyGroup.rotation.x, isSlide ? -0.45 : 0, 12, dt);

    if (state === 'walk' || state === 'sprint') {
      const freq = state === 'sprint' ? 11.5 : 7.5;
      const amp = state === 'sprint' ? 0.65 : 0.42;
      this.leftLeg.rotation.x = Math.sin(elapsed * freq) * amp;
      this.rightLeg.rotation.x = -Math.sin(elapsed * freq) * amp;
    } else if (isSlide) {
      this.leftLeg.rotation.x = -0.9;
      this.rightLeg.rotation.x = 0.35;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, 0, 12, dt);
      this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, 0, 12, dt);
    }
  }

  public dispose() {
    this.weaponModel.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) {
      if ((m as THREE.SpriteMaterial).map) (m as THREE.SpriteMaterial).map?.dispose();
      m.dispose();
    }
  }
}
