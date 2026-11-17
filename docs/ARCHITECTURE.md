# STRIKELINE — Technical Architecture & Game Design Document

## 1. Game Identity & Vision
**STRIKELINE** is a fast-paced, skill-based, competitive 3D browser First-Person Shooter built around tight gunplay, fluid directional slide-jump movement, low-occlusion tactical HUD clarity, and real-time 25Hz authoritative multiplayer combat.

## 2. Core Gameplay Systems
- **First-Person Controller (`src/game/physics/PlayerController.ts`)**: Pointer-lock mouse look with sensitivity & ADS zoom scaling, walk/sprint, crouch, directional slide + slide-jump momentum, coyote time (110ms), jump input buffer (120ms), air strafe control, swept AABB + ramp collision, head-bob, recoil recovery, touch controls, and Gamepad API support.
- **Arsenal (7 Weapons in `shared/constants/weapons.ts`)**:
  1. `VX-47 Vanguard` (Assault Rifle — balanced auto)
  2. `S-9 Spectre` (SMG — 900 RPM close-quarters)
  3. `M98 Longshot` (Sniper Rifle — dual-stage optic, one-tap headshot)
  4. `MK-14 Warden` (Semi-Auto DMR)
  5. `BR-12 Breacher` (8-pellet Pump Shotgun)
  6. `HX-3 Helix` (3-round Burst Bullpup)
  7. `P-22 Viper` (Rapid-draw Sidearm)
- **8 Competitive Game Modes (`shared/constants/modes.ts`)**: Free For All, Team Deathmatch, Hardpoint, Kill Confirmed, Team Kill Confirmed, Domination, Capture the Flag, and 2v2 Competitive Ranked, plus the interactive **Training Range** (`Proving Grounds`) with Free, Flick, and Tracking aim drills.
- **7 3D Maps (`shared/constants/maps.ts`)**: Foundry (`foundry`), Crossroads (`crossroads`), Dustbasin (`dustbasin`), Cargo Depot (`depot`), Bastion Yard (`bastion`), Apex Arena (`apex_arena`), and Proving Grounds (`training_range`).

## 3. Authoritative Multiplayer & Security
- **Server Loop (`server/game/MatchInstance.ts`)**: Runs a 25Hz authoritative tick loop handling player movement validation, raycast occlusion & head/body/limb hitboxes (`server/game/physics.ts`), damage falloff, spawns, destructible cover, objectives, Practice Bots AI (`[BOT]`), assists, kill feed, and post-match map voting.
- **Anti-Cheat (`server/security/anticheat.ts`)**: Clamps illegal horizontal movement spikes/teleports, validates weapon fire-rate cadence, tracks server-side magazine depletion & reload lockouts, and logs violations to `audit_logs`.
- **Matchmaking, Rooms & Social (`server/game/RoomManager.ts`)**: Public queues matched by mode/region/ranked flag, private custom rooms with room codes (`SL-XXXX`), passwords, mutators (headshot-only, low gravity, speed multiplier, weapon category lock), 4-player Parties, moderated Match/Team/Party chat, and WebRTC peer-to-peer team voice signaling.

## 4. Persistence, Economy & Progression
- **Database (`server/database/db.ts`)**: Pure-WASM SQLite (`sql.js`) persisted to `data/strikeline.db`.
- **Accounts & Progression**: Username/password registration, login, instant Guest Play with Guest-to-Account upgrade, password reset tokens, XP/level curve, strictly cosmetic Shop & Loadouts, Daily & Weekly Challenges, Achievements, Leaderboards (Global/Ranked/Weekly/Monthly/Friends), Clans, Tournaments, News/Patch Notes, and Admin Moderation Console.

## 5. Development, Environment & Testing
- **Environment Variables**: See `.env.example` (`GEMINI_API_KEY`, `APP_URL`, `PORT`).
- **Build & Run**:
  - `npm run dev` — starts Express + Vite + WebSocket server on port `3000`.
  - `npm run build` — compiles client bundle into `dist/`.
  - `npm run lint` — runs TypeScript type checking (`tsc --noEmit`).
  - `npx tsx --test tests/core.test.ts` — executes automated unit & integration tests.
