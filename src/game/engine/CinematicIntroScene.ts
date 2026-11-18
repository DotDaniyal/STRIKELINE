import * as THREE from 'three';
import { detectSoftwareWebGL } from './LobbyScene.ts';

export class CinematicIntroScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  private coreGroup: THREE.Group;
  private outerRing: THREE.Mesh;
  private innerPolygon: THREE.Mesh;
  private coreGlow: THREE.Mesh;
  private particlePoints: THREE.Points;
  private particlePositions: Float32Array;

  private onComplete: () => void;
  private progress = 0; // 0 to 1

  constructor(container: HTMLElement, onComplete: () => void) {
    this.container = container;
    this.onComplete = onComplete;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05070b');
    this.scene.fog = new THREE.FogExp2('#05070b', 0.08);

    this.camera = new THREE.PerspectiveCamera(
      45,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      100
    );
    this.camera.position.set(0, 0, 7.5);

    // Atmospheric lighting
    const ambient = new THREE.AmbientLight('#111827', 1.2);
    this.scene.add(ambient);

    const amberKey = new THREE.PointLight('#f59e0b', 4.5, 18);
    amberKey.position.set(0, 0, 2);
    this.scene.add(amberKey);

    const cyanRim = new THREE.DirectionalLight('#38bdf8', 2.8);
    cyanRim.position.set(-5, 5, 4);
    this.scene.add(cyanRim);

    // Cinematic Emblem geometry
    this.coreGroup = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(1.8, 1.92, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#d97706',
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
      side: THREE.DoubleSide,
    });
    this.outerRing = new THREE.Mesh(ringGeo, ringMat);
    this.coreGroup.add(this.outerRing);

    const polyGeo = new THREE.BufferGeometry();
    // Hexagon shape
    const vertices = new Float32Array([
      0, 1.4, 0,
      1.2, 0.7, 0,
      1.2, -0.7, 0,
      0, -1.4, 0,
      -1.2, -0.7, 0,
      -1.2, 0.7, 0,
    ]);
    const indices = [
      0, 1, 5,
      1, 2, 5,
      2, 3, 4,
      2, 4, 5,
    ];
    polyGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    polyGeo.setIndex(indices);
    polyGeo.computeVertexNormals();

    const polyMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: '#1e293b',
      metalness: 0.85,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    this.innerPolygon = new THREE.Mesh(polyGeo, polyMat);
    this.coreGroup.add(this.innerPolygon);

    const coreGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
    this.coreGlow = new THREE.Mesh(coreGeo, coreMat);
    this.coreGroup.add(this.coreGlow);

    this.scene.add(this.coreGroup);
    this.coreGroup.scale.setScalar(0.01);

    // Atmospheric particles
    const particleCount = 200;
    const pGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      this.particlePositions[i] = (Math.random() - 0.5) * 14;
      this.particlePositions[i + 1] = (Math.random() - 0.5) * 14;
      this.particlePositions[i + 2] = (Math.random() - 0.5) * 12;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: '#fbbf24',
      size: 0.045,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particlePoints = new THREE.Points(pGeo, pMat);
    this.scene.add(this.particlePoints);

    window.addEventListener('resize', this.onResize);
    this.tick();
  }

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    this.progress = Math.min(1, elapsed / 4.8); // 4.8 second cinematic sequence

    // Camera dolly in
    const targetZ = THREE.MathUtils.lerp(7.5, 3.4, Math.pow(this.progress, 1.8));
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 6, dt);

    // Emblem scale & rotation reveal
    const targetScale = THREE.MathUtils.lerp(0.01, 1.15, this.progress < 0.2 ? 0 : Math.min(1, (this.progress - 0.2) * 1.6));
    const currentScale = this.coreGroup.scale.x;
    const nextScale = THREE.MathUtils.damp(currentScale, targetScale, 8, dt);
    this.coreGroup.scale.setScalar(nextScale);

    this.coreGroup.rotation.z = elapsed * 0.35;
    this.outerRing.rotation.z = -elapsed * 0.7;

    // Particle drift
    const posAttr = this.particlePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 1; i < this.particlePositions.length; i += 3) {
      this.particlePositions[i] += dt * 0.4;
      if (this.particlePositions[i] > 7) this.particlePositions[i] = -7;
    }
    posAttr.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);

    if (this.progress >= 1) {
      this.dispose();
      this.onComplete();
      return;
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
