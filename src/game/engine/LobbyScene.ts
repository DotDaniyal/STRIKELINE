import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { WeaponId } from '../../../shared/types/game.ts';
import { buildWeaponModel, type WeaponViewModel } from '../models/WeaponModels.ts';
import { OperatorRig } from '../models/OperatorModel.ts';
import { createRadialContactShadowTexture } from './Textures.ts';

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
  private clock = new THREE.Clock();

  private pedestalGroup: THREE.Group;
  private weaponShowcase: WeaponViewModel | null = null;
  private operatorRig: OperatorRig | null = null;
  private currentWeaponId: WeaponId = 'vanguard_ar';
  private currentWeaponSkin = 'skin_standard_matte';
  private currentOperatorSkin = 'op_slate_vanguard';
  private mouseNormX = 0;
  private mouseNormY = 0;

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
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0e14');
    this.scene.fog = new THREE.FogExp2('#0b0e14', 0.045);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 1280) / (container.clientHeight || 720),
      0.1,
      100
    );
    this.camera.position.set(0.4, 1.45, 3.6);
    this.camera.lookAt(0.25, 1.05, 0);

    // Three-point warm/cool studio lighting
    const hemi = new THREE.HemisphereLight('#7dd3fc', '#1e1b18', 0.85);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#ffcf96', 2.2);
    key.position.set(4, 6, 4);
    key.castShadow = !this.isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight('#38bdf8', 1.4);
    rim.position.set(-4, 4, -3);
    this.scene.add(rim);

    // Tactical Armory Pedestal
    this.pedestalGroup = new THREE.Group();
    const baseGeo = new THREE.CylinderGeometry(1.35, 1.55, 0.22, 32);
    const baseMat = new THREE.MeshStandardMaterial({ color: '#141a24', metalness: 0.78, roughness: 0.35 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.11;
    baseMesh.receiveShadow = true;

    const ringGeo = new THREE.RingGeometry(1.32, 1.38, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#f59e0b', side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.225;

    const shadowGeo = new THREE.PlaneGeometry(4.2, 4.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createRadialContactShadowTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.01;

    // Floor plane
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#0d1118', roughness: 0.65, metalness: 0.25 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    this.pedestalGroup.add(baseMesh, ringMesh, shadowMesh, floor);
    this.scene.add(this.pedestalGroup);

    this.rebuildSubjects();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointerMove);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.tick();
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
    this.weaponShowcase.root.scale.setScalar(1.35);
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

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
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
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    if (this.weaponShowcase) {
      this.weaponShowcase.root.position.y = 1.08 + Math.sin(elapsed * 1.4) * 0.035;
      this.weaponShowcase.root.rotation.y = 0.65 + Math.sin(elapsed * 0.6) * 0.28;
    }
    if (this.operatorRig) {
      this.operatorRig.update(dt, elapsed, 'idle', 0);
    }

    const targetCamX = 0.35 + this.mouseNormX * 0.25;
    const targetCamY = 1.45 - this.mouseNormY * 0.12;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 4, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 4, dt);
    this.camera.lookAt(0.15, 1.08, 0);

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
    this.operatorRig?.dispose();
    this.weaponShowcase?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
