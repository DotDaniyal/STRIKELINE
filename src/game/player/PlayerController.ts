import type { MapDefinition, MovementState, PlayerSettings, Vec3 } from '../../../shared/types/game.ts';
import { getSurfaceHeightAt } from '../../../shared/physics/ballistics.ts';
import { audioEngine } from '../audio/AudioEngine.ts';
import { InputHandler } from './InputHandler.ts';

export class PlayerController {
  public x = 0;
  public y = 0;
  public z = 0;
  public vx = 0;
  public vy = 0;
  public vz = 0;
  public yaw = 0;
  public pitch = 0;
  public eyeHeight = 1.62;
  public grounded = true;
  public movementState: MovementState = 'idle';

  public readonly input = new InputHandler();

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private slideTimer = 0;
  private slideCooldown = 0;
  private slideDirX = 0;
  private slideDirZ = 0;
  private stepTimer = 0;
  private bobPhase = 0;
  private landingDip = 0;
  public shakeAmount = 0;
  public recoilPitch = 0;
  public recoilYaw = 0;

  private map: MapDefinition;
  private destructibles: Map<string, number>;
  private speedScale = 1;
  private gravityScale = 1;

  constructor(map: MapDefinition, destructibles: Map<string, number>) {
    this.map = map;
    this.destructibles = destructibles;
  }

  public get touchMoveX(): number {
    return this.input.touchMoveX;
  }
  public set touchMoveX(val: number) {
    this.input.touchMoveX = val;
  }
  public get touchMoveY(): number {
    return this.input.touchMoveY;
  }
  public set touchMoveY(val: number) {
    this.input.touchMoveY = val;
  }

  public setMap(map: MapDefinition, destructibles: Map<string, number>) {
    this.map = map;
    this.destructibles = destructibles;
  }

  public setMutators(speedScale = 1, gravityScale = 1) {
    this.speedScale = speedScale;
    this.gravityScale = gravityScale;
  }

  public teleport(x: number, y: number, z: number, yaw: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = yaw;
    this.pitch = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.slideTimer = 0;
    this.grounded = true;
  }

  public setKey(code: string, down: boolean, settings: PlayerSettings) {
    this.input.setKey(code, down, settings);
  }

  public clearKeys() {
    this.input.clearKeys();
  }

  public triggerJump() {
    this.jumpBufferTimer = 0.14;
  }

  public tryStartSlide() {
    const horizSpeed = Math.hypot(this.vx, this.vz);
    if (this.grounded && horizSpeed > 5.2 && this.slideTimer <= 0 && this.slideCooldown <= 0) {
      this.slideTimer = 0.58;
      this.slideCooldown = 0.75;
      this.slideDirX = this.vx / horizSpeed;
      this.slideDirZ = this.vz / horizSpeed;
      this.vx = this.slideDirX * 14.5 * this.speedScale;
      this.vz = this.slideDirZ * 14.5 * this.speedScale;
    }
  }

  public applyLookDelta(dx: number, dy: number, settings: PlayerSettings, isAds: boolean, adsFov: number) {
    const adsScale = isAds ? settings.adsSensitivityMultiplier * (adsFov / settings.fov) : 1.0;
    const sens = 0.0021 * settings.sensitivity * adsScale;
    this.yaw -= dx * sens;
    const ySign = settings.invertY ? 1 : -1;
    this.pitch = Math.max(-1.52, Math.min(1.52, this.pitch + dy * sens * ySign));
  }

  public addRecoil(vKick: number, hKick: number) {
    this.recoilPitch += vKick;
    this.recoilYaw += (Math.random() - 0.5) * hKick * 2;
    this.shakeAmount = Math.min(0.05, this.shakeAmount + vKick * 0.45);
  }

  public update(dt: number, settings: PlayerSettings, weaponSpeedMult: number, isAds: boolean, touchCrouch = false) {
    const sample = this.input.sampleMovement(settings, isAds, touchCrouch);
    if (sample.gamepadLookX !== 0 || sample.gamepadLookY !== 0) {
      this.applyLookDelta(sample.gamepadLookX, sample.gamepadLookY, settings, isAds, 55);
    }
    if (sample.jumpPressed) {
      this.jumpBufferTimer = 0.14;
    }
    if (sample.slideRequested) {
      this.tryStartSlide();
    }

    if (this.slideTimer > 0) this.slideTimer = Math.max(0, this.slideTimer - dt);
    if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (this.grounded) this.coyoteTimer = 0.12;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    // Direction vectors in XZ plane
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    const wishX = fwdX * sample.moveFwd + rightX * sample.moveRight;
    const wishZ = fwdZ * sample.moveFwd + rightZ * sample.moveRight;

    const baseSpeed =
      (sample.wantCrouch ? 3.8 : sample.wantSprint ? 9.4 : isAds ? 4.8 : 6.8) *
      weaponSpeedMult *
      this.speedScale;

    if (this.slideTimer > 0) {
      const decay = Math.exp(-2.6 * dt);
      this.vx *= decay;
      this.vz *= decay;
    } else if (this.grounded) {
      const accel = 16;
      this.vx = this.vx + (wishX * baseSpeed - this.vx) * Math.min(1, accel * dt);
      this.vz = this.vz + (wishZ * baseSpeed - this.vz) * Math.min(1, accel * dt);
    } else {
      const airAccel = 4.8;
      this.vx += wishX * baseSpeed * airAccel * dt;
      this.vz += wishZ * baseSpeed * airAccel * dt;
      const curAir = Math.hypot(this.vx, this.vz);
      const maxAir = Math.max(baseSpeed * 1.35, 11.5 * this.speedScale);
      if (curAir > maxAir) {
        this.vx = (this.vx / curAir) * maxAir;
        this.vz = (this.vz / curAir) * maxAir;
      }
    }

    // Jump (with coyote time & slide-jump boost)
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = 8.4;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      if (this.slideTimer > 0) {
        this.slideTimer = 0;
        this.vx *= 1.12;
        this.vz *= 1.12;
      }
    }

    // Gravity
    this.vy -= 22.5 * this.gravityScale * dt;

    // Horizontal swept collision (resolve X then Z for crisp wall sliding)
    const radius = 0.42;
    const playerHeight = sample.wantCrouch || this.slideTimer > 0 ? 1.15 : 1.82;

    const tryMoveAxis = (nx: number, nz: number): boolean => {
      if (
        nx < this.map.bounds.minX + 1.0 + radius ||
        nx > this.map.bounds.maxX - 1.0 - radius ||
        nz < this.map.bounds.minZ + 1.0 + radius ||
        nz > this.map.bounds.maxZ - 1.0 - radius
      ) {
        return false;
      }
      for (const col of this.map.colliders) {
        if (col.destructible && (this.destructibles.get(col.id) ?? 0) <= 0) continue;
        if (
          nx + radius > col.min.x &&
          nx - radius < col.max.x &&
          nz + radius > col.min.z &&
          nz - radius < col.max.z
        ) {
          if (col.min.y < this.y + playerHeight && col.max.y > this.y + 0.55) {
            return false;
          }
        }
      }
      return true;
    };

    const nextX = this.x + this.vx * dt;
    if (tryMoveAxis(nextX, this.z)) this.x = nextX;
    else this.vx = 0;

    const nextZ = this.z + this.vz * dt;
    if (tryMoveAxis(this.x, nextZ)) this.z = nextZ;
    else this.vz = 0;

    // Vertical & ramp/platform support
    const wasGrounded = this.grounded;
    const prevVy = this.vy;
    this.y += this.vy * dt;

    const supportY = getSurfaceHeightAt(this.map, this.x, this.z, this.y);
    if (this.y <= supportY) {
      this.y = supportY;
      this.vy = 0;
      this.grounded = true;
      if (!wasGrounded && prevVy < -5) {
        this.landingDip = Math.min(0.18, Math.abs(prevVy) * 0.012);
        audioEngine.playFootstep(this.map.floorMaterial, true);
      }
    } else {
      this.grounded = false;
    }

    // Eye height smoothing
    const targetEye = this.slideTimer > 0 ? 0.92 : sample.wantCrouch ? 1.12 : 1.62;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, 14 * dt);
    this.landingDip *= Math.exp(-12 * dt);
    this.shakeAmount *= Math.exp(-14 * dt);

    // Recoil recovery
    this.recoilPitch *= Math.exp(-9 * dt);
    this.recoilYaw *= Math.exp(-9 * dt);

    // Movement state & footsteps
    const horiz = Math.hypot(this.vx, this.vz);
    if (this.slideTimer > 0) this.movementState = 'slide';
    else if (!this.grounded) this.movementState = this.vy > 0 ? 'jump' : 'fall';
    else if (sample.wantCrouch) this.movementState = 'crouch';
    else if (horiz > 7.6) this.movementState = 'sprint';
    else if (horiz > 0.6) this.movementState = 'walk';
    else this.movementState = 'idle';

    if (this.grounded && horiz > 1.2 && this.slideTimer <= 0) {
      this.bobPhase += dt * (this.movementState === 'sprint' ? 13 : 9);
      this.stepTimer += dt * (this.movementState === 'sprint' ? 2.8 : 1.9);
      if (this.stepTimer >= 1) {
        this.stepTimer = 0;
        audioEngine.playFootstep(this.map.floorMaterial, this.movementState === 'sprint');
      }
    } else {
      this.stepTimer = 0.6;
    }
  }

  public getCameraOffset(settings: PlayerSettings): Vec3 {
    const horiz = Math.hypot(this.vx, this.vz);
    const bobAmp = settings.headBob && this.grounded && horiz > 1.2 && this.slideTimer <= 0 ? 0.035 : 0;
    const bobY = Math.sin(this.bobPhase) * bobAmp - this.landingDip;
    const shakeX = (Math.random() - 0.5) * this.shakeAmount;
    const shakeY = (Math.random() - 0.5) * this.shakeAmount;
    return {
      x: this.x + shakeX,
      y: this.y + this.eyeHeight + bobY + shakeY,
      z: this.z,
    };
  }
}
