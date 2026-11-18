import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import type {
  FlagRuntimeState,
  GameModeId,
  MapId,
  MatchSummaryInfo,
  MovementState,
  ObjectiveRuntimeState,
  PlayerSettings,
  PlayerSnapshot,
  SprayDecal,
  TagDrop,
  TeamId,
  Vec3,
  WeaponId,
} from '../../../shared/types/game.ts';
import { MAPS } from '../../../shared/maps/index.ts';
import { WEAPONS } from '../../../shared/constants/weapons.ts';
import { buildMapScene, type BuiltMapScene } from '../maps/MapBuilder.ts';
import { buildWeaponModel, type WeaponViewModel } from '../models/WeaponModels.ts';
import { OperatorRig } from '../models/OperatorModel.ts';
import { PlayerController } from '../player/PlayerController.ts';
import { CombatVfxManager } from './CombatVfx.ts';
import { ObjectiveSyncManager } from './ObjectiveSync.ts';
import { TrainingRangeManager, type RangeHudStats } from './TrainingRangeManager.ts';
import { detectSoftwareWebGL } from './LobbyScene.ts';
import { audioEngine } from '../audio/AudioEngine.ts';
import { socketClient } from '../../network/SocketClient.ts';

// Pre-allocated scratch objects outside animation loop (zero GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _raycaster = new THREE.Raycaster();

export interface HudTelemetry {
  hp: number;
  maxHp: number;
  ammo: number;
  magSize: number;
  reserve: number;
  weaponId: WeaponId;
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
  isReloading: boolean;
  reloadProgress: number;
  isAds: boolean;
  spreadRad: number;
  fps: number;
  pingMs: number;
  pointerLocked: boolean;
  spectatingName: string | null;
  pos: Vec3;
  yaw: number;
  movementState: MovementState;
  rangeStats?: RangeHudStats;
}

interface RemoteActor {
  rig: OperatorRig;
  targetPos: THREE.Vector3;
  targetYaw: number;
  snapshot: PlayerSnapshot;
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private envTexture: THREE.Texture | null = null;
  private dustPoints: THREE.Points | null = null;
  private dustPositions: Float32Array | null = null;
  private dustGeo: THREE.BufferGeometry | null = null;
  private dustMat: THREE.PointsMaterial | null = null;

  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private contextLost = false;
  private clock = new THREE.Clock();

  private mapId: MapId;
  private mode: GameModeId;
  private builtMap: BuiltMapScene | null = null;
  private destructibles = new Map<string, number>();
  private controller: PlayerController;
  private vfx: CombatVfxManager;
  private objectiveSync: ObjectiveSyncManager;
  private trainingRange: TrainingRangeManager;

  // Lighting refs
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private muzzleLight: THREE.PointLight;

  // First-person weapon state
  private weaponMount = new THREE.Group();
  private viewModel: WeaponViewModel | null = null;
  private primaryWeapon: WeaponId = 'vanguard_ar';
  private secondaryWeapon: WeaponId = 'viper_pistol';
  private currentWeapon: WeaponId = 'vanguard_ar';
  private weaponSkins: Partial<Record<WeaponId, string>> = {};
  private ammoState = new Map<WeaponId, { mag: number; reserve: number }>();
  private isReloading = false;
  private reloadStartedAt = 0;
  private reloadEndsAt = 0;
  private isAds = false;
  private isFiring = false;
  private nextFireAt = 0;
  private burstQueue = 0;
  private nextBurstAt = 0;
  private equipUntil = 0;
  private inspectUntil = 0;
  private recoilOffsetZ = 0;
  private muzzleFlashTimer = 0;
  private cameraRoll = 0;
  private lastInputSendAt = 0;
  private inputSeq = 0;
  private sprayCooldownAt = 0;
  private equippedSpray = 'spray_strikeline';

  // Local player match state
  public localId = '';
  public localTeam: TeamId = 'none';
  private localAlive = true;
  private localHp = 100;
  private paused = false;
  private spectateIndex = 0;
  private killerFocusPos: Vec3 | null = null;
  private killerFocusUntil = 0;

  private remotes = new Map<string, RemoteActor>();
  private touchCrouch = false;
  private pointerLocked = false;
  private fpsSamples: number[] = [];
  private lastHudPushAt = 0;

  private settings: PlayerSettings;
  private onHudUpdate: (hud: HudTelemetry) => void;
  private onLocalHitmarker?: (headshot: boolean, killed: boolean) => void;
  private onPauseToggle?: () => void;
  private onScoreboardToggle?: (show: boolean) => void;
  private onChatOpen?: (teamOnly: boolean) => void;

  constructor(opts: {
    container: HTMLElement;
    mapId: MapId;
    mode: GameModeId;
    primaryWeapon: WeaponId;
    secondaryWeapon: WeaponId;
    weaponSkins: Partial<Record<WeaponId, string>>;
    equippedSpray?: string;
    settings: PlayerSettings;
    onHudUpdate: (hud: HudTelemetry) => void;
    onLocalHitmarker?: (headshot: boolean, killed: boolean) => void;
    onPauseToggle?: () => void;
    onScoreboardToggle?: (show: boolean) => void;
    onChatOpen?: (teamOnly: boolean) => void;
  }) {
    this.container = opts.container;
    this.mapId = opts.mapId;
    this.mode = opts.mode;
    this.primaryWeapon = opts.primaryWeapon;
    this.secondaryWeapon = opts.secondaryWeapon;
    this.currentWeapon = opts.primaryWeapon;
    this.weaponSkins = opts.weaponSkins;
    if (opts.equippedSpray) this.equippedSpray = opts.equippedSpray;
    this.settings = opts.settings;
    this.onHudUpdate = opts.onHudUpdate;
    this.onLocalHitmarker = opts.onLocalHitmarker;
    this.onPauseToggle = opts.onPauseToggle;
    this.onScoreboardToggle = opts.onScoreboardToggle;
    this.onChatOpen = opts.onChatOpen;

    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && opts.settings.graphicsPreset !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    const scale = opts.settings.renderScale || 1.0;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2) * scale
    );
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && opts.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      opts.settings.fov,
      (this.container.clientWidth || 1280) / (this.container.clientHeight || 720),
      0.08,
      360
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.camera.add(this.weaponMount);
    this.muzzleLight = new THREE.PointLight('#fbbf24', 0, 6);
    this.muzzleLight.position.set(0.18, -0.1, -0.7);
    this.camera.add(this.muzzleLight);

    this.hemiLight = new THREE.HemisphereLight('#94a3b8', '#334155', 0.9);
    this.scene.add(this.hemiLight);
    this.keyLight = new THREE.DirectionalLight('#fff5e0', 2.0);
    this.keyLight.castShadow = !this.isSoftwareGl && opts.settings.shadows;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -45;
    this.keyLight.shadow.camera.right = 45;
    this.keyLight.shadow.camera.top = 45;
    this.keyLight.shadow.camera.bottom = -45;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const mapDef = MAPS[this.mapId];
    this.controller = new PlayerController(mapDef, this.destructibles);
    this.vfx = new CombatVfxManager(this.scene, this.isSoftwareGl);
    this.objectiveSync = new ObjectiveSyncManager(this.scene);
    this.trainingRange = new TrainingRangeManager(this.scene);

    this.resetAmmo();
    this.loadMap(this.mapId);
    this.equipWeapon(this.currentWeapon);

    if (this.mode === 'training') {
      this.trainingRange.spawnTargets();
    }

    if (!this.isSoftwareGl) {
      this.initAmbientDust();
      if (this.settings.bloom) {
        this.initPostProcessing();
      }
    }

    this.bindEvents();
    audioEngine.applySettings(this.settings);
    audioEngine.setAmbientMode('match');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.tick();
  }

  private initPostProcessing() {
    if (this.composer || this.isSoftwareGl) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2))),
      0.32,
      0.35,
      0.88
    );
    composer.addPass(bloom);

    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms['offset'].value = 1.05;
    vignette.uniforms['darkness'].value = 0.92;
    composer.addPass(vignette);

    composer.addPass(new OutputPass());
    this.composer = composer;
    this.bloomPass = bloom;
  }

  private disposePostProcessing() {
    this.bloomPass?.dispose();
    this.bloomPass = null;
    this.composer?.dispose();
    this.composer = null;
  }

  private initAmbientDust() {
    const count = 140;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 56;
      positions[i * 3 + 1] = 0.5 + Math.random() * 8.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 56;
    }
    this.dustPositions = positions;
    this.dustGeo = new THREE.BufferGeometry();
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustMat = new THREE.PointsMaterial({
      color: '#e2e8f0',
      size: 0.055,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(this.dustGeo, this.dustMat);
    this.scene.add(this.dustPoints);
  }

  public updateSettings(next: PlayerSettings) {
    this.settings = next;
    audioEngine.applySettings(next);
    if (!this.isAds) {
      this.camera.fov = next.fov;
      this.camera.updateProjectionMatrix();
    }
    if (!this.isSoftwareGl) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * (next.renderScale || 1));
      this.renderer.shadowMap.enabled = next.shadows;
      this.keyLight.castShadow = next.shadows;
      if (next.bloom && !this.composer) {
        this.initPostProcessing();
      } else if (!next.bloom && this.composer) {
        this.disposePostProcessing();
      }
    }
  }

  public updateLoadout(
    primary: WeaponId,
    secondary: WeaponId,
    skins: Partial<Record<WeaponId, string>>,
    equippedSpray?: string
  ) {
    this.primaryWeapon = primary;
    this.secondaryWeapon = secondary;
    this.weaponSkins = skins;
    if (equippedSpray) this.equippedSpray = equippedSpray;
    this.resetAmmo();
    this.equipWeapon(primary);
  }

  private resetAmmo() {
    for (const w of Object.values(WEAPONS)) {
      this.ammoState.set(w.id, { mag: w.magSize, reserve: w.reserveMax });
    }
  }

  public loadMap(mapId: MapId) {
    this.mapId = mapId;
    const map = MAPS[mapId];
    if (this.builtMap) {
      this.scene.remove(this.builtMap.group);
      this.builtMap.dispose();
    }
    this.destructibles.clear();
    for (const c of map.colliders) {
      if (c.destructible) this.destructibles.set(c.id, c.maxHp ?? 90);
    }

    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    this.builtMap = buildMapScene(map, aniso, !this.isSoftwareGl && this.settings.shadows);
    this.scene.add(this.builtMap.group);
    this.controller.setMap(map, this.destructibles);

    this.scene.fog = new THREE.FogExp2(map.lighting.fogColor, map.lighting.fogDensity);
    this.scene.background = new THREE.Color(map.lighting.skyHorizon);
    this.hemiLight.color.set(map.lighting.hemiSky);
    this.hemiLight.groundColor.set(map.lighting.hemiGround);
    this.hemiLight.intensity = map.lighting.hemiIntensity;
    this.keyLight.color.set(map.lighting.sunColor);
    this.keyLight.intensity = map.lighting.sunIntensity;
    this.keyLight.position.set(map.lighting.sunPosition.x, map.lighting.sunPosition.y, map.lighting.sunPosition.z);

    const sp = map.spawns[0] ?? { x: 0, y: 0, z: 0, yaw: 0 };
    this.controller.teleport(sp.x, sp.y, sp.z, sp.yaw);
  }

  private equipWeapon(weaponId: WeaponId) {
    this.currentWeapon = weaponId;
    this.isReloading = false;
    this.isAds = false;
    this.burstQueue = 0;
    this.equipUntil = performance.now() + WEAPONS[weaponId].equipTimeSec * 1000;

    if (this.viewModel) {
      this.weaponMount.remove(this.viewModel.root);
      this.viewModel.dispose();
    }
    const skin = this.weaponSkins[weaponId] ?? 'skin_standard_matte';
    this.viewModel = buildWeaponModel(weaponId, skin, true);
    this.weaponMount.add(this.viewModel.root);

    if (this.mode !== 'training') {
      socketClient.send({ type: 'player_swap_weapon', weaponId });
    }
  }

  public swapToSlot(slot: 1 | 2) {
    const target = slot === 1 ? this.primaryWeapon : this.secondaryWeapon;
    if (this.currentWeapon !== target) {
      this.equipWeapon(target);
    }
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    this.isFiring = false;
    this.isAds = false;
    this.controller.clearKeys();
    if (paused && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  public requestPointerLock() {
    if (!this.paused && document.pointerLockElement !== this.renderer.domElement) {
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  // Mobile Touch API
  public setTouchMove(x: number, y: number) {
    this.controller.touchMoveX = x;
    this.controller.touchMoveY = y;
  }
  public addTouchLook(dx: number, dy: number) {
    if (!this.localAlive || this.paused) return;
    this.controller.applyLookDelta(dx, dy, this.settings, this.isAds, WEAPONS[this.currentWeapon].adsFov);
  }
  public setTouchFire(firing: boolean) {
    this.isFiring = firing;
    if (firing) this.tryFireSingleOrBurst();
  }
  public setTouchAds(ads: boolean) {
    this.isAds = ads;
  }
  public triggerJump() {
    this.controller.triggerJump();
  }
  public toggleTouchCrouch() {
    this.touchCrouch = !this.touchCrouch;
    if (this.touchCrouch) this.controller.tryStartSlide();
  }
  public triggerReload() {
    this.startReload();
  }
  public swapWeaponSlot() {
    this.equipWeapon(this.currentWeapon === this.primaryWeapon ? this.secondaryWeapon : this.primaryWeapon);
  }

  // Training Range Drills
  public startAimDrill(drill: 'free' | 'flick' | 'tracking') {
    this.trainingRange.startDrill(drill);
  }

  // Server state ingestion
  public applyMatchState(msg: {
    match: MatchSummaryInfo;
    players: PlayerSnapshot[];
    objectives: ObjectiveRuntimeState[];
    tags: TagDrop[];
    flags: FlagRuntimeState[];
    destructibles: Record<string, number>;
  }) {
    if (msg.match.mapId !== this.mapId) {
      this.loadMap(msg.match.mapId);
    }
    this.controller.setMutators(msg.match.mutators.speedMultiplier ?? 1, msg.match.mutators.lowGravity ? 0.55 : 1);

    for (const [cid, hp] of Object.entries(msg.destructibles)) {
      this.destructibles.set(cid, hp);
      const mesh = this.builtMap?.destructibleMeshes.get(cid);
      if (mesh) mesh.visible = hp > 0;
    }

    const seen = new Set<string>();
    for (const p of msg.players) {
      if (p.id === this.localId) {
        this.localTeam = p.team;
        this.localHp = p.hp;
        this.localAlive = p.alive;
        continue;
      }
      seen.add(p.id);
      let actor = this.remotes.get(p.id);
      if (!actor) {
        const rig = new OperatorRig({
          username: p.username,
          team: p.team,
          operatorSkin: p.operatorSkin,
          weaponId: p.weaponId,
          weaponSkin: p.weaponSkin,
          isBot: p.isBot,
        });
        rig.root.position.set(p.x, p.y, p.z);
        this.scene.add(rig.root);
        actor = {
          rig,
          targetPos: new THREE.Vector3(p.x, p.y, p.z),
          targetYaw: p.yaw,
          snapshot: p,
        };
        this.remotes.set(p.id, actor);
      } else {
        const wasAlive = actor.snapshot.alive;
        actor.snapshot = p;
        actor.targetPos.set(p.x, p.y, p.z);
        actor.targetYaw = p.yaw;
        actor.rig.setWeapon(p.weaponId, p.weaponSkin);
        if (!wasAlive && p.alive) {
          actor.rig.resetAlive();
          actor.rig.root.position.set(p.x, p.y, p.z);
        }
      }
    }

    for (const [id, actor] of this.remotes.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(actor.rig.root);
        actor.rig.dispose();
        this.remotes.delete(id);
      }
    }

    this.objectiveSync.sync(msg.objectives, msg.tags, msg.flags, this.localTeam);
  }

  public onPlayerRespawned(x: number, y: number, z: number, yaw: number) {
    this.localAlive = true;
    this.localHp = 100;
    this.killerFocusPos = null;
    this.resetAmmo();
    this.controller.teleport(x, y, z, yaw);
  }

  public onPlayerDied(victimId: string, attackerId: string, impulse: Vec3) {
    if (victimId === this.localId) {
      this.localAlive = false;
      this.isFiring = false;
      this.isAds = false;
      const killer = this.remotes.get(attackerId);
      if (killer) {
        this.killerFocusPos = {
          x: killer.rig.root.position.x,
          y: killer.rig.root.position.y + 1.5,
          z: killer.rig.root.position.z,
        };
        this.killerFocusUntil = performance.now() + 1800;
      }
    } else {
      const actor = this.remotes.get(victimId);
      actor?.rig.triggerRagdoll(impulse);
    }
  }

  public onRemoteShot(shooterId: string, weaponId: WeaponId, origin: Vec3, endPoints: Vec3[], tracerColor: string) {
    const isLocal = shooterId === this.localId;
    if (!isLocal) {
      audioEngine.playGunshot(
        weaponId,
        false,
        { x: this.controller.x, y: this.controller.y + 1.6, z: this.controller.z },
        this.controller.yaw,
        origin
      );
    }
    if (!this.settings.showTracers) return;
    for (const end of endPoints) {
      this.vfx.spawnTracer(origin, end, tracerColor);
      this.vfx.spawnSparks(end);
    }
  }

  public onSprayPlaced(decal: SprayDecal) {
    this.vfx.placeSpray(decal);
  }

  private startReload() {
    if (!this.localAlive || this.isReloading) return;
    const ammo = this.ammoState.get(this.currentWeapon);
    const w = WEAPONS[this.currentWeapon];
    if (!ammo || ammo.mag >= w.magSize || ammo.reserve <= 0) return;

    this.isReloading = true;
    this.isAds = false;
    const now = performance.now();
    this.reloadStartedAt = now;
    this.reloadEndsAt = now + w.reloadTimeSec * 1000;
    audioEngine.playReload();
    if (this.mode !== 'training') {
      socketClient.send({ type: 'player_reload', weaponId: this.currentWeapon });
    }
  }

  private computeCurrentSpread(): number {
    const w = WEAPONS[this.currentWeapon];
    let spread = this.isAds ? w.adsSpread : w.hipSpread;
    const horiz = Math.hypot(this.controller.vx, this.controller.vz);
    if (horiz > 1.0) spread += w.moveSpreadPenalty * Math.min(1, horiz / 8);
    if (!this.controller.grounded) spread += w.airSpreadPenalty;
    if (this.controller.movementState === 'crouch') spread *= 0.72;
    return spread;
  }

  private tryFireSingleOrBurst() {
    const w = WEAPONS[this.currentWeapon];
    if (w.fireMode === 'burst') {
      if (this.burstQueue <= 0 && performance.now() >= this.nextFireAt) {
        this.burstQueue = w.burstCount ?? 3;
        this.nextBurstAt = performance.now();
        this.nextFireAt = performance.now() + (60000 / w.rpm) * (w.burstCount ?? 3);
      }
    } else {
      this.fireOnce();
    }
  }

  private fireOnce() {
    const now = performance.now();
    if (!this.localAlive || this.paused || this.isReloading || now < this.equipUntil || now < this.nextFireAt) {
      return;
    }

    const w = WEAPONS[this.currentWeapon];
    const ammo = this.ammoState.get(this.currentWeapon)!;
    if (ammo.mag <= 0) {
      audioEngine.playDryFire();
      this.nextFireAt = now + 260;
      this.startReload();
      return;
    }

    ammo.mag -= 1;
    this.nextFireAt = now + 60000 / w.rpm;

    audioEngine.playGunshot(w.id, true);
    this.recoilOffsetZ = 0.085;
    this.muzzleFlashTimer = 0.045;
    this.muzzleLight.intensity = 3.5;
    if (this.viewModel) this.viewModel.muzzleFlash.visible = true;

    const spread = this.computeCurrentSpread();
    this.controller.addRecoil(w.recoilVertical * (this.isAds ? 0.72 : 1), w.recoilHorizontal);

    const camPos = this.camera.getWorldPosition(_v1);
    const camDir = this.camera.getWorldDirection(_v2);
    const origin: Vec3 = { x: camPos.x, y: camPos.y, z: camPos.z };

    const pelletDirs: Vec3[] = [];
    for (let i = 0; i < w.pellets; i++) {
      const rx = (Math.random() - 0.5) * 2 * spread;
      const ry = (Math.random() - 0.5) * 2 * spread;
      _dir.copy(camDir);
      _dir.x += rx;
      _dir.y += ry;
      _dir.z += (Math.random() - 0.5) * spread;
      _dir.normalize();
      pelletDirs.push({ x: _dir.x, y: _dir.y, z: _dir.z });
    }

    if (this.mode === 'training') {
      this.trainingRange.handleShot(
        this.currentWeapon,
        origin,
        pelletDirs,
        w.tracerColor,
        this.settings.showTracers,
        this.builtMap?.raycastTargets ?? [],
        this.vfx,
        this.onLocalHitmarker
      );
    } else {
      socketClient.send({
        type: 'player_shoot',
        weaponId: w.id,
        origin,
        direction: pelletDirs[0],
        pelletDirections: w.pellets > 1 ? pelletDirs : undefined,
        clientTime: Date.now(),
      });
    }

    if (ammo.mag === 0) {
      this.startReload();
    }
  }

  private trySpray() {
    const now = performance.now();
    if (now < this.sprayCooldownAt || !this.builtMap) return;
    _raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    _raycaster.far = 4.5;
    const hits = _raycaster.intersectObjects(this.builtMap.raycastTargets, false);
    if (hits[0] && hits[0].face) {
      this.sprayCooldownAt = now + 2500;
      const p = hits[0].point;
      const n = hits[0].face.normal;
      const decal: SprayDecal = {
        id: 'local_' + now,
        sprayId: this.equippedSpray,
        playerId: this.localId,
        x: p.x,
        y: p.y,
        z: p.z,
        nx: n.x,
        ny: n.y,
        nz: n.z,
        createdAt: now,
      };
      if (this.mode === 'training') this.onSprayPlaced(decal);
      else socketClient.send({ type: 'player_spray', x: p.x, y: p.y, z: p.z, nx: n.x, ny: n.y, nz: n.z, sprayId: decal.sprayId });
    }
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

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

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked) {
      this.isFiring = false;
      this.isAds = false;
      this.controller.clearKeys();
    }
  };

  private onWindowBlur = () => {
    this.isFiring = false;
    this.isAds = false;
    this.controller.clearKeys();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked || this.paused || !this.localAlive) return;
    this.controller.applyLookDelta(
      e.movementX,
      e.movementY,
      this.settings,
      this.isAds,
      WEAPONS[this.currentWeapon].adsFov
    );
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.paused) return;
    if (!this.pointerLocked) {
      this.requestPointerLock();
      return;
    }
    if (e.button === 0) {
      this.isFiring = true;
      this.tryFireSingleOrBurst();
    } else if (e.button === 2) {
      this.isAds = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.isFiring = false;
    else if (e.button === 2) this.isAds = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const kb = this.settings.keybinds;

    if (e.code === 'Escape') {
      this.onPauseToggle?.();
      return;
    }
    if (e.code === kb.scoreboard) {
      e.preventDefault();
      this.onScoreboardToggle?.(true);
      return;
    }
    if (e.code === kb.chat) {
      e.preventDefault();
      this.onChatOpen?.(false);
      return;
    }
    if (e.code === kb.teamChat) {
      e.preventDefault();
      this.onChatOpen?.(true);
      return;
    }

    if (this.paused) return;

    if (!this.localAlive && (e.code === 'Space' || e.code === 'KeyD' || e.code === 'KeyA')) {
      this.spectateIndex += 1;
      return;
    }

    this.controller.setKey(e.code, true, this.settings);

    if (e.code === kb.reload) this.startReload();
    else if (e.code === kb.primaryWeapon && this.currentWeapon !== this.primaryWeapon) {
      this.equipWeapon(this.primaryWeapon);
    } else if (e.code === kb.secondaryWeapon && this.currentWeapon !== this.secondaryWeapon) {
      this.equipWeapon(this.secondaryWeapon);
    } else if (e.code === kb.inspect) {
      this.inspectUntil = performance.now() + 900;
    } else if (e.code === kb.spray) {
      this.trySpray();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const kb = this.settings.keybinds;
    if (e.code === kb.scoreboard) {
      this.onScoreboardToggle?.(false);
    }
    this.controller.setKey(e.code, false, this.settings);
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)));
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
    const now = performance.now();

    if (dt > 0) {
      this.fpsSamples.push(1 / dt);
      if (this.fpsSamples.length > 20) this.fpsSamples.shift();
    }

    if (this.isReloading && now >= this.reloadEndsAt) {
      this.isReloading = false;
      const w = WEAPONS[this.currentWeapon];
      const ammo = this.ammoState.get(this.currentWeapon)!;
      const needed = w.magSize - ammo.mag;
      const take = Math.min(needed, ammo.reserve);
      ammo.mag += take;
      ammo.reserve -= take;
    }

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[0];
    if (pad) {
      if (pad.buttons[6]?.pressed) this.isAds = true;
      if (pad.buttons[7]?.pressed) this.fireOnce();
      if (pad.buttons[2]?.pressed) this.startReload();
    }

    const wCfg = WEAPONS[this.currentWeapon];
    if (this.burstQueue > 0 && now >= this.nextBurstAt) {
      this.burstQueue -= 1;
      this.nextBurstAt = now + (wCfg.burstIntervalMs ?? 65);
      this.fireOnce();
    } else if (this.isFiring && wCfg.fireMode === 'auto') {
      this.fireOnce();
    }

    let spectatingName: string | null = null;
    if (this.localAlive) {
      this.controller.update(dt, this.settings, wCfg.moveSpeedMultiplier, this.isAds, this.touchCrouch);
      const camOffset = this.controller.getCameraOffset(this.settings);
      this.camera.position.set(camOffset.x, camOffset.y, camOffset.z);

      const targetRoll = this.controller.movementState === 'slide' ? -0.032 : 0;
      this.cameraRoll = THREE.MathUtils.damp(this.cameraRoll, targetRoll, 12, dt);

      _euler.set(
        this.controller.pitch + this.controller.recoilPitch,
        this.controller.yaw + this.controller.recoilYaw,
        this.cameraRoll,
        'YXZ'
      );
      this.camera.quaternion.setFromEuler(_euler);
    } else {
      const aliveActors = Array.from(this.remotes.values()).filter((a) => a.snapshot.alive);
      if (this.killerFocusPos && now < this.killerFocusUntil) {
        this.camera.position.set(this.controller.x, this.controller.y + 1.4, this.controller.z);
        this.camera.lookAt(this.killerFocusPos.x, this.killerFocusPos.y, this.killerFocusPos.z);
      } else if (aliveActors.length > 0) {
        const spec = aliveActors[this.spectateIndex % aliveActors.length];
        spectatingName = spec.snapshot.username;
        const backX = Math.sin(spec.rig.root.rotation.y) * 2.8;
        const backZ = Math.cos(spec.rig.root.rotation.y) * 2.8;
        this.camera.position.set(
          spec.rig.root.position.x + backX,
          spec.rig.root.position.y + 2.1,
          spec.rig.root.position.z + backZ
        );
        this.camera.lookAt(spec.rig.root.position.x, spec.rig.root.position.y + 1.4, spec.rig.root.position.z);
      }
    }

    const targetFov = this.isAds
      ? wCfg.adsFov
      : this.controller.movementState === 'slide'
      ? Math.min(118, this.settings.fov + 6)
      : this.controller.movementState === 'sprint'
      ? Math.min(115, this.settings.fov + 4.5)
      : this.settings.fov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, wCfg.adsZoomSpeed, dt);
      this.camera.updateProjectionMatrix();
    }

    this.weaponMount.visible = this.localAlive;
    if (this.localAlive && this.viewModel) {
      const targetX = this.isAds ? 0.0 : 0.22;
      const targetY = this.isAds
        ? -0.095
        : this.isReloading
        ? -0.26
        : now < this.equipUntil
        ? -0.22
        : -0.17;
      const targetZ = (this.isAds ? -0.32 : -0.42) + this.recoilOffsetZ;
      this.recoilOffsetZ = THREE.MathUtils.damp(this.recoilOffsetZ, 0, 18, dt);

      const swayX = Math.sin(elapsed * 2.1) * (this.isAds ? 0.001 : 0.004);
      const swayY = Math.cos(elapsed * 4.2) * (this.isAds ? 0.001 : 0.004);

      this.weaponMount.position.x = THREE.MathUtils.damp(this.weaponMount.position.x, targetX + swayX, 16, dt);
      this.weaponMount.position.y = THREE.MathUtils.damp(this.weaponMount.position.y, targetY + swayY, 16, dt);
      this.weaponMount.position.z = THREE.MathUtils.damp(this.weaponMount.position.z, targetZ, 18, dt);

      const targetRotY =
        this.controller.movementState === 'sprint' && !this.isAds
          ? 0.45
          : now < this.inspectUntil
          ? 0.8
          : 0;
      const targetRotX = this.isReloading ? -0.45 : this.recoilOffsetZ * 1.8;
      this.weaponMount.rotation.y = THREE.MathUtils.damp(this.weaponMount.rotation.y, targetRotY, 12, dt);
      this.weaponMount.rotation.x = THREE.MathUtils.damp(this.weaponMount.rotation.x, targetRotX, 14, dt);
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleLight.intensity = 0;
        if (this.viewModel) this.viewModel.muzzleFlash.visible = false;
      }
    }

    if (this.dustPoints && this.dustPositions) {
      const posAttr = this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.dustPositions.length; i += 3) {
        this.dustPositions[i + 1] += dt * 0.16;
        if (this.dustPositions[i + 1] > 9.0) this.dustPositions[i + 1] = 0.5;
      }
      posAttr.needsUpdate = true;
    }

    for (const actor of this.remotes.values()) {
      actor.rig.root.position.lerp(actor.targetPos, Math.min(1, dt * 15));
      let diff = actor.targetYaw - actor.rig.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      actor.rig.root.rotation.y += diff * Math.min(1, dt * 15);
      actor.rig.update(dt, elapsed, actor.snapshot.movementState, actor.snapshot.pitch);
    }

    this.objectiveSync.update(dt, elapsed);
    if (this.mode === 'training') {
      this.trainingRange.update(elapsed, now);
    }
    this.vfx.update(dt);

    if (this.mode !== 'training' && now - this.lastInputSendAt >= 33) {
      this.lastInputSendAt = now;
      this.inputSeq += 1;
      socketClient.send({
        type: 'player_input',
        seq: this.inputSeq,
        x: this.controller.x,
        y: this.controller.y,
        z: this.controller.z,
        yaw: this.controller.yaw,
        pitch: this.controller.pitch,
        vx: this.controller.vx,
        vy: this.controller.vy,
        vz: this.controller.vz,
        movementState: this.controller.movementState,
        weaponId: this.currentWeapon,
        isAds: this.isAds,
        isReloading: this.isReloading,
      });
    }

    if (now - this.lastHudPushAt >= 66) {
      this.lastHudPushAt = now;
      const ammo = this.ammoState.get(this.currentWeapon) ?? { mag: 0, reserve: 0 };
      const avgFps =
        this.fpsSamples.length > 0
          ? Math.round(this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length)
          : 60;
      const reloadProgress =
        this.isReloading && this.reloadEndsAt > this.reloadStartedAt
          ? Math.max(0, Math.min(1, (now - this.reloadStartedAt) / (this.reloadEndsAt - this.reloadStartedAt)))
          : 0;
      this.onHudUpdate({
        hp: this.localHp,
        maxHp: 100,
        ammo: ammo.mag,
        magSize: wCfg.magSize,
        reserve: ammo.reserve,
        weaponId: this.currentWeapon,
        primaryWeapon: this.primaryWeapon,
        secondaryWeapon: this.secondaryWeapon,
        isReloading: this.isReloading,
        reloadProgress,
        isAds: this.isAds,
        spreadRad: this.computeCurrentSpread(),
        fps: avgFps,
        pingMs: socketClient.pingMs,
        pointerLocked: this.pointerLocked,
        spectatingName,
        pos: { x: this.controller.x, y: this.controller.y, z: this.controller.z },
        yaw: this.controller.yaw,
        movementState: this.controller.movementState,
        rangeStats: this.mode === 'training' ? this.trainingRange.getStats(now) : undefined,
      });
    }

    if (this.composer && !this.isSoftwareGl && this.settings.bloom) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    audioEngine.setAmbientMode('off');
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.disposePostProcessing();
    this.dustGeo?.dispose();
    this.dustMat?.dispose();
    this.envTexture?.dispose();
    this.vfx.dispose();
    this.objectiveSync.dispose();
    this.trainingRange.dispose();
    this.builtMap?.dispose();
    this.viewModel?.dispose();
    for (const a of this.remotes.values()) a.rig.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
