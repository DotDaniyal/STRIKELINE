import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { WeaponId } from '../../../shared/types/game.ts';
import { buildWeaponModel, type WeaponViewModel } from '../models/WeaponModels.ts';
import { OperatorRig } from '../models/OperatorModel.ts';
import { createRadialContactShadowTexture } from './Textures.ts';

export type LobbyFocusMode = 'play' | 'arsenal' | 'operator';

export function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class LobbyScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private contextLost = false;
  private clock = new THREE.Clock();

  private pedestalGroup: THREE.Group;
  private weaponShowcase: WeaponViewModel | null = null;
  private operatorRig: OperatorRig | null = null;
  private particles: THREE.Points | null = null;
  private particlePositions: Float32Array | null = null;
  private disposables: Array<{ dispose: () => void }> = [];

  private currentWeaponId: WeaponId = 'vanguard_ar';
  private currentWeaponSkin = 'skin_standard_matte';
  private currentOperatorSkin = 'op_slate_vanguard';
  private focusMode: LobbyFocusMode = 'play';
  private dragYawOffset = 0;
  private targetDragYaw = 0;
  private mouseNormX = 0;
  private mouseNormY = 0;
  private lookTarget = new THREE.Vector3(0.15, 1.08, 0);

  constructor(container: HTMLElement, weaponId: WeaponId, weaponSkin: string, operatorSkin: string) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.currentWeaponId = weaponId;
    this.currentWeaponSkin = weaponSkin;
    this.currentOperatorSkin = operatorSkin;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090c12');
    this.scene.fog = new THREE.FogExp2('#090c12', 0.042);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.disposables.push(envTex);
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 1280) / (container.clientHeight || 720),
      0.1,
      100
    );
    this.camera.position.set(0.4, 1.45, 3.6);
    this.camera.lookAt(this.lookTarget);

    // Three-point warm/cool studio lighting
    const hemi = new THREE.HemisphereLight('#7dd3fc', '#1e1b18', 0.85);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#ffd49e', 2.35);
    key.position.set(4, 6, 4);
    key.castShadow = !this.isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight('#38bdf8', 1.55);
    rim.position.set(-4, 4, -3);
    this.scene.add(rim);

    // Tactical Armory Pedestal
    this.pedestalGroup = new THREE.Group();
    const baseGeo = new THREE.CylinderGeometry(1.38, 1.58, 0.22, 36);
    const baseMat = new THREE.MeshStandardMaterial({ color: '#141a24', metalness: 0.78, roughness: 0.34 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.11;
    baseMesh.receiveShadow = true;

    const ringGeo = new THREE.RingGeometry(1.34, 1.4, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#f59e0b', side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.225;

    const innerRingGeo = new THREE.RingGeometry(0.92, 0.94, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.224;

    const shadowGeo = new THREE.PlaneGeometry(4.4, 4.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createRadialContactShadowTexture(),
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.01;

    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#0b0f17', roughness: 0.65, metalness: 0.25 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    this.disposables.push(
      baseGeo,
      baseMat,
      ringGeo,
      ringMat,
      innerRingGeo,
      innerRingMat,
      shadowGeo,
      shadowMat,
      floorGeo,
      floorMat
    );
    this.pedestalGroup.add(baseMesh, ringMesh, innerRing, shadowMesh, floor);
    this.scene.add(this.pedestalGroup);

    if (!this.isSoftwareGl) {
      this.createAtmosphericMotes();
    }

    this.rebuildSubjects();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.tick();
  }

  private createAtmosphericMotes() {
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 1] = 0.3 + Math.random() * 3.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    this.particlePositions = positions;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#fbbf24',
      size: 0.032,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(geo, mat);
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  public setFocusMode(mode: LobbyFocusMode) {
    this.focusMode = mode;
  }

  public rotateShowcase(deltaRad: number) {
    this.targetDragYaw += deltaRad;
  }

  public resetShowcaseRotation() {
    this.targetDragYaw = 0;
  }

  public updateLoadout(weaponId: WeaponId, weaponSkin: string, operatorSkin: string) {
    if (
      this.currentWeaponId === weaponId &&
      this.currentWeaponSkin === weaponSkin &&
      this.currentOperatorSkin === operatorSkin
    ) {
      return;
    }
    this.currentWeaponId = weaponId;
    this.currentWeaponSkin = weaponSkin;
    this.currentOperatorSkin = operatorSkin;
    this.rebuildSubjects();
  }

  private rebuildSubjects() {
    if (this.operatorRig) {
      this.scene.remove(this.operatorRig.root);
      this.operatorRig.dispose();
    }
    if (this.weaponShowcase) {
      this.scene.remove(this.weaponShowcase.root);
      this.weaponShowcase.dispose();
    }

    this.operatorRig = new OperatorRig({
      team: 'none',
      operatorSkin: this.currentOperatorSkin,
      weaponId: this.currentWeaponId,
      weaponSkin: this.currentWeaponSkin,
    });
    this.operatorRig.root.position.set(0.55, 0.22, -0.35);
    this.operatorRig.root.rotation.y = -0.35;
    this.scene.add(this.operatorRig.root);

    this.weaponShowcase = buildWeaponModel(this.currentWeaponId, this.currentWeaponSkin, false);
    this.weaponShowcase.root.position.set(-0.55, 1.08, 0.55);
    this.weaponShowcase.root.scale.setScalar(1.38);
    this.weaponShowcase.root.rotation.y = 0.65;
    this.scene.add(this.weaponShowcase.root);
  }

  private onPointerMove = (e: PointerEvent) => {
    this.mouseNormX = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseNormY = (e.clientY / window.innerHeight) * 2 - 1;
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private onContextRestored = () => {
    this.contextLost = false;
    if (!this.disposed) {
      this.clock.getDelta();
      this.tick();
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed || this.contextLost) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed || this.contextLost) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    this.dragYawOffset = THREE.MathUtils.damp(this.dragYawOffset, this.targetDragYaw, 10, dt);

    if (this.weaponShowcase) {
      this.weaponShowcase.root.position.y = 1.08 + Math.sin(elapsed * 1.4) * 0.032;
      this.weaponShowcase.root.rotation.y = 0.65 + Math.sin(elapsed * 0.55) * 0.22 + this.dragYawOffset;
    }
    if (this.operatorRig) {
      this.operatorRig.root.rotation.y = -0.35 + this.dragYawOffset * 0.45;
      this.operatorRig.update(dt, elapsed, 'idle', 0);
    }

    if (this.particles && this.particlePositions) {
      const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.particlePositions.length; i += 3) {
        this.particlePositions[i + 1] += dt * 0.14;
        if (this.particlePositions[i + 1] > 3.7) {
          this.particlePositions[i + 1] = 0.3;
        }
      }
      posAttr.needsUpdate = true;
    }

    let baseCamX = 0.35;
    let baseCamY = 1.45;
    let baseCamZ = 3.6;
    let lookX = 0.15;
    let lookY = 1.08;
    let lookZ = 0;

    if (this.focusMode === 'arsenal') {
      baseCamX = -0.45;
      baseCamY = 1.24;
      baseCamZ = 2.15;
      lookX = -0.48;
      lookY = 1.07;
      lookZ = 0.45;
    } else if (this.focusMode === 'operator') {
      baseCamX = 0.65;
      baseCamY = 1.4;
      baseCamZ = 2.65;
      lookX = 0.52;
      lookY = 1.08;
      lookZ = -0.25;
    }

    const targetCamX = baseCamX + this.mouseNormX * 0.18;
    const targetCamY = baseCamY - this.mouseNormY * 0.09;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 4.5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 4.5, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, baseCamZ, 4.5, dt);
    this.lookTarget.x = THREE.MathUtils.damp(this.lookTarget.x, lookX, 5, dt);
    this.lookTarget.y = THREE.MathUtils.damp(this.lookTarget.y, lookY, 5, dt);
    this.lookTarget.z = THREE.MathUtils.damp(this.lookTarget.z, lookZ, 5, dt);
    this.camera.lookAt(this.lookTarget);

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.operatorRig?.dispose();
    this.weaponShowcase?.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
