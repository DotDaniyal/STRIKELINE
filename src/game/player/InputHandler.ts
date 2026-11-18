import type { PlayerSettings } from '../../../shared/types/game.ts';

export interface MovementSample {
  moveFwd: number;
  moveRight: number;
  wantCrouch: boolean;
  wantSprint: boolean;
  jumpPressed: boolean;
  slideRequested: boolean;
  gamepadLookX: number;
  gamepadLookY: number;
}

export class InputHandler {
  private keys = new Set<string>();
  public touchMoveX = 0;
  public touchMoveY = 0;

  private pendingJump = false;
  private pendingSlide = false;

  public setKey(code: string, down: boolean, settings: PlayerSettings) {
    if (down) {
      if (code === settings.keybinds.jump && !this.keys.has(code)) {
        this.pendingJump = true;
      }
      if (code === settings.keybinds.crouch && !this.keys.has(code)) {
        this.pendingSlide = true;
      }
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  public clearKeys() {
    this.keys.clear();
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.pendingJump = false;
    this.pendingSlide = false;
  }

  public triggerJump() {
    this.pendingJump = true;
  }

  public triggerSlide() {
    this.pendingSlide = true;
  }

  public sampleMovement(settings: PlayerSettings, isAds: boolean, touchCrouch: boolean): MovementSample {
    const kb = settings.keybinds;
    let moveFwd = (this.keys.has(kb.forward) ? 1 : 0) - (this.keys.has(kb.backward) ? 1 : 0);
    let moveRight = (this.keys.has(kb.right) ? 1 : 0) - (this.keys.has(kb.left) ? 1 : 0);

    if (Math.abs(this.touchMoveX) > 0.08 || Math.abs(this.touchMoveY) > 0.08) {
      moveRight += this.touchMoveX;
      moveFwd -= this.touchMoveY;
    }

    let gamepadLookX = 0;
    let gamepadLookY = 0;
    let jumpPressed = this.pendingJump;
    let slideRequested = this.pendingSlide;
    this.pendingJump = false;
    this.pendingSlide = false;

    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[0];
    if (pad) {
      const dz = settings.gamepadDeadzone;
      if (Math.abs(pad.axes[0]) > dz) moveRight += pad.axes[0];
      if (Math.abs(pad.axes[1]) > dz) moveFwd -= pad.axes[1];
      if (Math.abs(pad.axes[2]) > dz || Math.abs(pad.axes[3]) > dz) {
        const rx = Math.abs(pad.axes[2]) > dz ? pad.axes[2] : 0;
        const ry = Math.abs(pad.axes[3]) > dz ? pad.axes[3] : 0;
        gamepadLookX = rx * 18 * settings.gamepadSensitivity;
        gamepadLookY = ry * 14 * settings.gamepadSensitivity;
      }
      if (pad.buttons[0]?.pressed) jumpPressed = true;
      if (pad.buttons[1]?.pressed) slideRequested = true;
    }

    const inputLen = Math.hypot(moveFwd, moveRight);
    if (inputLen > 1) {
      moveFwd /= inputLen;
      moveRight /= inputLen;
    }

    const wantCrouch = this.keys.has(kb.crouch) || touchCrouch;
    const wantSprint = this.keys.has(kb.sprint) && moveFwd > 0.3 && !wantCrouch && !isAds;

    return {
      moveFwd,
      moveRight,
      wantCrouch,
      wantSprint,
      jumpPressed,
      slideRequested,
      gamepadLookX,
      gamepadLookY,
    };
  }
}
