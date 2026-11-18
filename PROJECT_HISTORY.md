# STRIKELINE Project History & Engineering Documentation

This centralized document records the verified engineering history, architectural structure, codebase cleanup, design/UX standards enforcement, security posture, and launch readiness of **STRIKELINE**.

---

## 1. Chronological History & Contributors

1. **Initial Workspace & Core Application Implementation (AI-Assisted Engineering)**
   - Established Express + Vite + WebSocket (`ws`) full-stack runtime on port `3000` (`server.ts`).
   - Implemented the 3D Three.js FPS client (`src/game/`), 7 procedural weapons (`shared/constants/weapons.ts`), 8 competitive multiplayer modes plus the interactive Proving Grounds Training Range (`shared/constants/modes.ts`), 7 3D maps (`shared/maps/`), WebAudio procedural synthesis (`src/game/audio/AudioEngine.ts`), and pure-WASM SQLite persistence (`sql.js`).
   - Built React 19 lobby, arsenal, cosmetic shop, social/squads, leaderboards, career progression, admin moderation, settings/crosshair studio, and mobile touch/gamepad controls.
   - Created baseline git checkpoint commit `4b0c4be` (`Pre-refactor baseline checkpoint`, 54 files) prior to architectural reorganization.
2. **Codebase Reorganization & Clean Architecture Refactoring (AI-Assisted Engineering)**
   - Audited the full 54-file repository and decomposed monolithic server, shared, and client modules without altering gameplay balance, visual quality, or database compatibility.
3. **Website Quality Control, UI/UX Polish & Launch Readiness (AI-Assisted Engineering)**
   - Enforced strict design standards (removed em dashes across UI/HTML/constants, removed decorative gradients and pill-shaped mobile controls), added favicon, SEO metadata, `robots.txt`, Schema.org `VideoGame` JSON-LD, WebGL context-loss handlers, and complete Privacy Policy and Terms & Conditions routes (`/privacy`, `/terms`).
4. **Complete Visual Overhaul, Design System & 3D Engine Polish (AI-Assisted Engineering)**
   - Replaced generic card templates with a cohesive tactical design system (`src/index.css` CSS tokens + `.sl-chamfer` / `.sl-chamfer-sm`, `src/utils/theme.ts` colorblind/rarity palettes, `src/components/ui/`: `TacticalButton`, `TacticalPanel`, `StatBar`, `SegmentedControl`, `ModalShell`, `BootSplash`).
   - Upgraded 3D rendering in `GameEngine.ts` (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `VignetteShader`, `OutputPass`, atmospheric particles, sprint/slide FOV kick and slide roll) and `LobbyScene.ts` (interactive turntable drag rotation, focus presets for weapon/operator views).
   - Overhauled all screens (`TitleAuthScreen`, `LobbyWorkspace`, all 8 lobby tabs, `SettingsModal`, `LegalDocumentModal`, `MobileControls`, and `MatchHud` with live rotating `Minimap`, `WeaponHotbar`, center reload progress bar, and low-HP critical edge vignette) plus ambient/UI/match audio hooks in `AudioEngine.ts`.

---

## 2. Final Modular Architecture

### Shared Layer (`/shared/`)
- `shared/types/game.ts`: Canonical data contracts for accounts, settings, loadouts, weapons, maps, modes, matches, parties, and client/server messages.
- `shared/physics/ballistics.ts`: Pure math raycast, capsule hitbox (`head`, `body`, `limb`), AABB wall occlusion, and inclined ramp surface solver shared by both client prediction and authoritative server validation.
- `shared/maps/`: Per-map geometry modules (`foundry.ts`, `crossroads.ts`, `dustbasin.ts`, `depot.ts`, `bastion.ts`, `apexArena.ts`, `trainingRange.ts`), shared builder helpers (`helpers.ts`), and registry (`index.ts`).
- `shared/protocol/messages.ts`: Protocol versioning (`PROTOCOL_VERSION = 1`), message type constants, and runtime `isValidClientMessage()` validation guard.
- `shared/constants/`: Tuned weapon definitions (`weapons.ts`), mode rulesets and default settings (`modes.ts`), cosmetic catalog (`catalog.ts`), and 5-language translations (`i18n.ts`).

### Authoritative Server Layer (`/server/`)
- `server/persistence/`: Modular SQLite `sql.js` engine (`sqlite.ts`), authentication/session/password-reset repository (`authRepo.ts`), profile/loadout/shop/match-history repository (`profileRepo.ts`), and friends/clans/news/moderation repository (`socialRepo.ts`) re-exported via `index.ts`.
- `server/api/`: Express middleware (`middleware.ts` for rate limiting, bearer session verification, and moderator/admin RBAC) and REST routes (`routes.ts`).
- `server/game/`:
  - `MatchInstance.ts`: Authoritative 25Hz match simulation orchestrator.
  - `combat.ts`, `bots.ts`, `modes.ts`, `types.ts`: Extracted ballistics/hit resolution, tactical bot AI, mode/objective scoring, and runtime match types.
  - `RoomManager.ts` & `partyManager.ts`: WebSocket connection handling (with runtime protocol validation), public matchmaking queues, private rooms with mutators, and 4-player squad parties.
- `server/security/anticheat.ts`: Server-side movement speed clamping, weapon fire-rate cadence checks, magazine depletion & reload lockouts, and audit logging.

### Client Layer (`/src/`)
- `src/game/player/`: `InputHandler.ts` (keyboard, touch, gamepad input sampling) and `PlayerController.ts` (FPS kinematics, slide-jump physics, swept AABB collision, ramp stepping, headbob, recoil recovery).
- `src/game/engine/`: `GameEngine.ts`, `CombatVfx.ts` (pooled tracers, sparks, spray decals), `ObjectiveSync.ts` (zones, dog tags, CTF flags), `TrainingRangeManager.ts` (aim trainer drills), `LobbyScene.ts`, and `Textures.ts`. Includes `webglcontextlost` and `webglcontextrestored` handling.
- `src/network/`: `SocketClient.ts` (auto-reconnecting WS client with RTT ping) and `VoiceChat.ts` (optional peer-to-peer WebRTC squad audio manager).
- `src/components/`: `TitleAuthScreen.tsx`, `LobbyWorkspace.tsx`, `LegalDocumentModal.tsx` (Privacy Policy & Terms & Conditions), `SettingsModal.tsx`, `MobileControls.tsx`, `hud/` (`MatchHud.tsx`, `CrosshairView.tsx`, `ScoreboardOverlay.tsx`, `MatchResultsModal.tsx`), and `lobby/` (`PlayTab.tsx`, `PrivateAndBotsPanel.tsx`, `RoomBrowserCard.tsx`, `ArsenalTab.tsx`, `ShopTab.tsx`, `SocialTab.tsx`, `LeaderboardAndCareerTabs.tsx`, `AdminTab.tsx`).

---

## 3. Codebase Cleanup, Bug Fixes & Design Standards

### Removed / Consolidated Files
- Deleted `server/game/physics.ts` -> moved to `shared/physics/ballistics.ts` so the client no longer imports from `server/`.
- Deleted `shared/constants/maps.ts` -> split into individual map files under `shared/maps/`.
- Deleted `server/database/db.ts` -> split into `server/persistence/`.
- Deleted `src/game/physics/PlayerController.ts` -> moved and split into `src/game/player/`.
- Deleted `src/components/MatchHud.tsx` & `src/components/CrosshairView.tsx` -> moved and split into `src/components/hud/`.
- Deleted `docs/ARCHITECTURE.md` -> consolidated into `PROJECT_HISTORY.md` to prevent duplicate documentation drift.
- Deleted `tests/core.test.ts` -> reorganized into `tests/unit/` and `tests/integration/`.
- Removed `data/strikeline.db` from Git tracking (`git rm --cached`) and ignored `data/*.db` and `data/*.sqlite` in `.gitignore`.

### Security, Integrity & Stability Improvements
- Added runtime WebSocket payload validation (`isValidClientMessage`) at `RoomManager` entry before message dispatch.
- Preserved scrypt password hashing with per-user salts, token expiry checks, per-route rate limiting, server-authoritative hit/ammo/speed validation, and audit logging.
- Added WebGL `webglcontextlost` and `webglcontextrestored` recovery handlers in both `GameEngine` and `LobbyScene`.
- Converted `TitleAuthScreen` and `index.html` body overflow rules so mobile and short desktop viewports scroll cleanly without clipping auth or legal forms.

### UI/UX & Launch Compliance Fixes
- Replaced all em dashes across `index.html`, HUD, lobby panels, mode descriptions, admin queue, and MVP fallback strings.
- Removed decorative gradient background from the Crosshair preview panel and converted mobile touch controls from pill circles to clean tactical pads (`rounded-xl`/`rounded-2xl`).
- Added `/public/favicon.svg`, `/public/robots.txt`, Schema.org `VideoGame` JSON-LD, OpenGraph/Twitter tags, and accessible `/privacy` and `/terms` legal pages linked from both login and lobby footers.

---

## 4. Verification Status

- Automated test suites live under `tests/unit/configs.test.ts`, `tests/unit/physics_anticheat.test.ts`, `tests/unit/theme.test.ts`, and `tests/integration/persistence_rooms.test.ts` (run via `npx tsx --test tests/unit/*.test.ts tests/integration/*.test.ts`).
- TypeScript compilation (`tsc --noEmit`), Vite production build (`npm run build`), and live Express + WebSocket runtime checks are run as part of final release verification.

---

## 5. External Production Prerequisites (Cannot Be Automated Inside Sandbox)

- **Custom Domain & DNS/TLS**: Connect the deployed Cloud Run / VPS service to your custom domain DNS (`A`/`CNAME` records), update `APP_URL` in environment secrets, and terminate HTTPS/WSS TLS via your hosting load balancer or reverse proxy.
- **Persistent Volume Mount**: Mount `data/` on durable block/cloud storage in production so `strikeline.db` persists across container restarts.
