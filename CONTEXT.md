# Project: Dynamic Island for Windows (Mino)

## What
A glossy black floating "island" pill at top-centre of the screen that morphs
between states (idle, compact, listening, expanded, alert) like iPhone Dynamic Island.

## Stack
Electron + React + TypeScript + Vite + Framer Motion + XState (state machine).
Offline voice: vosk-browser (WASM) running in the renderer. No cloud APIs.

## Rules
- Window: frameless, transparent, always-on-top, skipTaskbar, focusable:false,
  click-through when idle except over the pill.
- All animation = spring (stiffness ~300, damping ~25); animate transform/opacity/size only.
- Style: pure glossy black. Gradient top highlight, 1px inner top border rgba(255,255,255,.2),
  soft shadow, coloured glow per state.
- Modules live in electron/modules/<name>/ and talk to UI via IPC events
  (preload exposes window.mino API). UI never uses Node directly.
- Priority for who owns the island: alert > voice > pomodoro/timer > media > idle.
- Keep code small, typed, commented only where non-obvious.
- Config in config/default.json, user overrides in %APPDATA%/dynamic-island/config.json.
- License: MIT. Avoid paid or key-based dependencies.

## Folder layout
electron/ (main.ts, preload.ts, ipc.ts, modules/*)
src/ (App.tsx, island/*, widgets/*, styles/*)
config/default.json
assets/

## Features (v1)
Idle pill, hover/click expand, clock, battery, media controls (SMTC), timer,
Pomodoro focus mode, listening state, offline voice (wake word "hey island" + hotkey
Ctrl+Alt+Space), voice "open <app>" via Start Menu index + fuzzy match.

## Progress log (update at end of every milestone)
- [x] M0: Scaffolded Mino (Electron + React + Vite + TS + XState + Framer Motion), verified running, preload exposes window.mino, NSIS dist script configured.
- [x] M1: Transparent frameless always-on-top window (640x300, y=8, screen-saver level), black pill 140x36, click-through with hover toggle via IPC, re-centres on display change.
