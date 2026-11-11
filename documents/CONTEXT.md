# 🏝️ Dynamic Island: Milestone Prompt Playbook

**Goal:** Build the whole project with the fewest tokens possible by using one small context file + one tight prompt per milestone.

**Locked decisions**
- OS: Windows 10/11
- Stack: **Electron + React + TypeScript + Vite + Framer Motion** (best for vibe coding)
- Voice: **100% offline** using **Vosk** (Apache-2.0, safe to release publicly later)
- Activation: **wake word "hey island" + hotkey `Ctrl+Alt+Space`**
- Theme: **pure glossy black**
- Features: all of 3.1 (idle pill, hover expand, open-app by voice, listening state, clock, battery, media controls, timer) + **wake word voice** + **Pomodoro focus mode**
- Release plan: personal first, public later (so MIT licence, clean installer, no paid-licence dependencies)

---

## 0. Token-Saving Rules (read once, follow always)

1. **Use Claude Code (or any agent with file access) in your project folder.** It reads files itself; you never paste code.
2. **One milestone = one session.** Finish, test, `git commit`, then start a fresh session (`/clear`). Old chat history is what burns tokens.
3. **Keep `CONTEXT.md` (Section 1) in the repo root** and begin every session with: *"Read CONTEXT.md first."* This replaces re-explaining the project.
4. **Never paste whole files or whole logs.** Paste only the **last 15-20 lines of an error** plus the file name.
5. **Ask for diffs, not rewrites:** end prompts with *"Change only what is needed. Do not rewrite unrelated files. Keep replies short."*
6. **Test before moving on.** Each milestone has a checklist. Do not start the next one until all items pass.
7. **Commit after every passing milestone** so you can roll back instead of re-prompting.
8. **Fix prompts template** (use when something breaks):
   > `Bug: <one line>. Expected: <one line>. Error: <last 15 lines>. File: <name>. Fix minimally.`
9. **Don't ask for explanations** unless you need them. Add *"No explanation, just code changes and a 2-line summary."*

---

## 1. `CONTEXT.md` (create this file in your project root first)

Copy this exactly into `CONTEXT.md`:

```markdown
# Project: Dynamic Island for Windows (personal first, public later)

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
  (preload exposes window.island API). UI never uses Node directly.
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
- [x] M0-M8 complete; M8 adds offline wake-word recognition and voice commands for apps, media, timers, Pomodoro, battery, system volume, and web search.
```

**Tip:** At the end of each milestone, tell the agent: *"Update the Progress log in CONTEXT.md in one line."* This is your memory across sessions.

---

## 2. Milestone Overview

| # | Milestone | Outcome | Est. time |
|---|-----------|---------|-----------|
| M0 | Project scaffold | Electron + React runs | 1 hr |
| M1 | Island window | Transparent always-on-top pill, click-through | 2 hrs |
| M2 | Glossy UI + states | Glossy pill, spring morphing, state machine | 1 day |
| M3 | Clock + Battery | First live widgets | 3 hrs |
| M4 | Timer + Pomodoro | Live countdown in pill, focus mode | 1 day |
| M5 | Media controls | Now-playing + play/pause/next | 1 day |
| M6 | App launcher engine | Index apps, fuzzy open (typed first) | 3 hrs |
| M7 | Hotkey + mic + Vosk STT | Speak and see text in the island | 1-2 days |
| M8 | Wake word + commands | "Hey island, open Chrome" works | 1 day |
| M9 | Polish + settings + tray | Themes tweak, tray, autostart, multi-monitor | 1 day |
| M10 | Package + release prep | Installer, README, licence, GitHub | 0.5 day |

---

## 3. Milestone Prompts

> Start every session with: **"Read CONTEXT.md first."** (already included in each prompt below)

---

### M0: Project scaffold

**Prompt**
```
Read CONTEXT.md first.
Task M0: Scaffold the project in the current folder.
- Electron + React + TypeScript + Vite (use electron-vite or vite-plugin-electron, pick the simplest).
- Install framer-motion, xstate, @xstate/react.
- Scripts: dev, build, dist (electron-builder, Windows nsis).
- A secure preload (contextIsolation on) exposing an empty window.island object.
- Show "Hello Island" on screen.
Init git with a .gitignore. No explanation, 2-line summary only.
```

**Done when**
- [ ] `npm run dev` opens an Electron window with the text
- [ ] No console errors

Then: `git commit -m "M0"`.

---

### M1: The island window (transparent, on top, click-through)

**Prompt**
```
Read CONTEXT.md first.
Task M1: Turn the Electron window into the island host.
- Frameless, transparent, alwaysOnTop (level "screen-saver"), skipTaskbar, focusable:false, no shadow, not resizable.
- Window size 640x300, centred horizontally at the top (y=8) on the primary display.
- Render a plain black rounded pill 140x36 centred at top of the window.
- Click-through: setIgnoreMouseEvents(true,{forward:true}) by default; the renderer sends IPC
  "island:hover" true/false on mouseenter/mouseleave of the pill so main toggles interaction.
- Re-centre when display metrics change.
Change only what is needed. 2-line summary.
```

**Done when**
- [ ] Pill floats at top centre above other apps
- [ ] You can click things behind the transparent area
- [ ] Hovering the pill makes it interactive

Commit: `M1`.

---

### M2: Glossy UI + morphing state machine

**Prompt**
```
Read CONTEXT.md first.
Task M2: Build the island UI and state machine.
1. XState machine with states: idle, compact, listening, expanded, alert. Events: HOVER, CLICK, OUTSIDE/TIMEOUT(4s), LISTEN_START, LISTEN_END, ALERT(payload), DISMISS.
2. Island component using Framer Motion: animate width, height, borderRadius together with spring (stiffness 300, damping 25). Sizes: idle 140x36, compact 220x38, listening 280x52, expanded 440x150, alert 400x84.
3. Pure glossy black style: gradient #16161c -> #000, inset top border rgba(255,255,255,.2), ::before top-half white gloss gradient (opacity ~.18), soft outer shadow, subtle moving specular glint, coloured glow per state.
4. Content fades in 80ms after shape finishes, fades out before shrink.
5. Add a temporary dev panel (toggle with F12-style key) with buttons to trigger each state.
6. Put styles in src/styles/island.css using CSS variables for colours.
Do not add other features yet. 2-line summary.
```

**Done when**
- [ ] Hover -> slight bulge; click -> expands; 4 s idle -> collapses
- [ ] Animation feels liquid, no flicker
- [ ] Gloss highlight is visible on the pill

Commit: `M2`.

---

### M3: Clock + Battery

**Prompt**
```
Read CONTEXT.md first.
Task M3: Add a module system and the first two widgets.
- electron/modules/index.ts: simple Module interface {id, priority, start(emit), stop()} plus loader; emit() sends IPC events to renderer.
- battery module: use systeminformation (poll 30s). Emit battery.update {percent, charging}. Also emit ALERT when plugged in/unplugged and when <=20% (once per threshold).
- Renderer widgets: ClockWidget (time + date) and BatteryWidget (icon, percent, green glow if charging).
- Expanded state shows clock + battery. Alert state shows battery alerts.
- Compact state is not used yet.
Reuse the existing state machine. Change only what is needed. 2-line summary.
```

**Done when**
- [ ] Expanded island shows time and battery
- [ ] Plug/unplug charger shows an alert pop-up

Commit: `M3`.

---

### M4: Timer + Pomodoro focus mode

**Prompt**
```
Read CONTEXT.md first.
Task M4: Add Timer and Pomodoro (renderer logic + small main-process persistence).
Timer:
- Start/pause/cancel countdown. While running, the island goes to compact state showing a progress ring + mm:ss. On finish: alert state with "Time's up" + soft chime (assets/sounds/chime.wav, generate a tiny placeholder if missing).
Pomodoro:
- Default 25 focus / 5 break / 15 long break after 4 rounds (configurable in config/default.json).
- Compact shows ring + remaining time + round dots; colour: focus = soft red glow, break = green glow.
- Expanded view has Start/Pause/Skip/Reset buttons and today's completed-rounds count (persist in %APPDATA%/dynamic-island/stats.json).
- Fires alerts at phase changes.
- Expose IPC/API so voice can later call timer.start(minutes) and pomodoro.start().
Priority: alert > timer/pomodoro > idle. Keep it small. 2-line summary.
```

**Done when**
- [ ] Timer runs in compact pill and alerts at the end
- [ ] Pomodoro cycles focus -> break -> focus and saves the daily count
- [ ] Closing and reopening the app keeps the daily count

Commit: `M4`.

---

### M5: Media controls

**Prompt**
```
Read CONTEXT.md first.
Task M5: Now-playing + controls for Windows.
- Main-process media module reading Windows System Media Transport Controls (SMTC). Use the simplest reliable approach: a small PowerShell/WinRT or a maintained npm package; if native build is risky, use a tiny helper exe or PowerShell script polling every 1s. Pick the approach with the least setup pain and tell me in one line which one.
- Emit media.update {title, artist, album, albumArtDataUrl, isPlaying}.
- Commands via IPC: play/pause, next, previous (use SendKeys media keys if SMTC control is hard).
- UI: compact state when music plays (album art circle left, animated equaliser bars right). Expanded shows art, title, artist, and prev/play/next buttons. Glow colour taken from the album art's dominant colour.
- Show a brief alert on track change.
Works with Spotify and browser media. 2-line summary.
```

**Done when**
- [ ] Playing Spotify/YouTube shows in the pill
- [ ] Buttons control playback
- [ ] Glow matches the album art

Commit: `M5`.

---

### M6: App launcher engine (typed first, voice later)

**Prompt**
```
Read CONTEXT.md first.
Task M6: Build the app launcher module (no voice yet).
- At startup, index apps from: user + common Start Menu Programs folders (.lnk), and Store/UWP apps via PowerShell Get-StartApps. Cache to %APPDATA%/dynamic-island/apps.json and refresh in background every 6 hours or on demand.
- Merge aliases from config (e.g. code -> Visual Studio Code, browser -> Google Chrome).
- Fuzzy matching with Fuse.js (threshold ~0.35). Function launcher.open(name) returns {ok, matched, reason}.
- Launch .lnk via shell.openPath; UWP via explorer.exe shell:AppsFolder\<AppID>.
- Also add launcher.close(name) using taskkill on the matched process name (best effort).
- Temporary UI: a text input in the expanded dev panel: type "open chrome" -> launches; island shows app icon + "Opening Chrome..." then a tick.
- Parse "open X", "launch X", "start X", "close X" and "open X and Y" (split on "and").
Put the command parser in electron/modules/commands/parser.ts so voice can reuse it. 2-line summary.
```

**Done when**
- [ ] Typing "open chrome and notepad" opens both
- [ ] Wrong names show a "Couldn't find" alert instead of crashing

Commit: `M6`.

---

### M7: Hotkey + microphone + offline speech-to-text

**Prompt**
```
Read CONTEXT.md first.
Task M7: Offline speech-to-text with Vosk, triggered by hotkey.
- Register global hotkey Ctrl+Alt+Space (configurable) in main -> sends LISTEN_START to renderer.
- Renderer: capture mic with getUserMedia + AudioWorklet (16 kHz mono), feed vosk-browser (WASM). Load the small English model (vosk-model-small-en-in or en-us small) from assets/models, copied/bundled so it works offline. Show a one-line note on where I must download and place the model.
- Listening state: live waveform (mic level) + partial transcript text in the island.
- Stop on final result or 6 s of silence, then send the final text to electron/modules/commands/parser.ts (from M6) and execute; show result in alert state.
- Grant mic permission automatically in Electron's session permission handler.
- Visible mic indicator whenever audio is captured.
Handle model-loading state ("Loading voice...") and errors gracefully. 2-line summary.
```

**Done when**
- [ ] Press hotkey, say "open notepad", and Notepad opens
- [ ] Transcript appears live in the island
- [ ] Works with Wi-Fi turned off

Commit: `M7`.

---

### M8: Wake word + voice commands for everything

**Prompt**
```
Read CONTEXT.md first.
Task M8: Always-on wake word "hey Mino" (offline) and full voice command set.
Wake word:
- Run a second lightweight Vosk recogniser restricted with a grammar ["hey island","[unk]"] on the mic stream. Low CPU. On detection -> same flow as hotkey (LISTEN_START) with a short "ding" sound.
- Debounce so it does not retrigger for 2 s; ignore while already listening.
- Setting voice.wakeWordEnabled in config; a tray/menu toggle comes in M9.
Commands (extend parser.ts, keep rule-based and fuzzy, no cloud):
- open/close/launch <app> [and <app>]
- play, pause, next song, previous song
- set timer for <n> minutes/seconds; cancel timer
- start focus / start pomodoro / pause focus / skip break / stop focus
- what's my battery
- volume <0-100> / mute / unmute (use a small helper like nircmd or loudness package)
- search <query> on youtube/google -> open default browser with URL
Show friendly feedback in the island for each action, and "Didn't catch that" for unknown commands.
Add a unit-test file for the parser with 25 sample phrases. 2-line summary.
```

**Done when**
- [ ] Say "Hey Mino" then "open VS Code and Spotify" and both open
- [ ] "Hey Island, start focus" begins Pomodoro
- [ ] Idle CPU stays low (< 3-5%) with wake word on
- [ ] Parser tests pass

Commit: `M8`.

---

### M9: Polish, settings, tray, autostart, multi-monitor

**Prompt**
```
Read CONTEXT.md first.
Task M9: Polish and settings.
- System tray icon with menu: Show/Hide island, Toggle wake word, Toggle mic, Settings, Start with Windows (login item), Quit.
- Minimal settings window (React, separate BrowserWindow, same glossy style) editing config: hotkey, wake word on/off, pomodoro durations, aliases, monitor choice, sounds on/off.
- Monitor handling: follow primary / chosen / active-cursor monitor; handle hot-plug and DPI changes.
- Hide the island or reduce it to idle when a fullscreen app/game is detected (optional setting).
- Optional subtle glass "tick/whoosh" sounds for expand/collapse (off by default).
- First-run onboarding card inside the island: shows hotkey and wake word, 3 example commands.
- Performance pass: ensure idle CPU is minimal; pause animations and polling when nothing is happening.
Change only what is needed. 2-line summary.
```

**Done when**
- [ ] Tray menu works and settings persist after restart
- [ ] Autostart works after reboot
- [ ] Moving between monitors does not break layout

Commit: `M9`.

---

### M10: Package + release prep (for going public)

**Prompt**
```
Read CONTEXT.md first.
Task M10: Make it shippable.
- electron-builder config for a Windows NSIS installer (+ portable zip), app name "Dynamic Island", icon placeholder in build/, per-user install, auto-start option.
- Bundle the Vosk model in extraResources and make sure paths work in packaged mode.
- Add crash-safe logging to %APPDATA%/dynamic-island/logs (rotate).
- README.md: features, screenshots placeholders, install, voice commands table, config reference, build instructions, privacy note (100% offline voice, no data leaves the PC).
- LICENSE (MIT) and THIRD_PARTY_NOTICES.md listing Vosk (Apache-2.0), Electron, React, Framer Motion, etc. with their licences.
- GitHub Actions workflow to build the installer on tag push.
- Checklist file RELEASE.md with manual test steps.
2-line summary.
```

**Done when**
- [ ] Installer installs and runs on a clean Windows user account or VM
- [ ] Voice works offline after install
- [ ] No leftover dev-only panels visible

Commit and tag `v0.1.0`.

---

## 4. Quick Fix and Helper Prompts (copy/paste when needed)

**Bug fix**
```
Read CONTEXT.md first. Bug: <what's wrong>. Expected: <what you want>.
Error (last lines): <paste>. File: <name>. Fix minimally, no rewrites.
```

**Visual tweak (cheap)**
```
Read CONTEXT.md first. Only edit src/styles/island.css and animations.ts.
Make the gloss <more subtle/stronger>, <glow brighter>, <animation snappier>. Show only the changed lines.
```

**Add a new module later**
```
Read CONTEXT.md first. Add module <name> following the existing module pattern
(electron/modules/<name>, IPC events, widget in src/widgets). Feature: <one line>.
Do not touch other modules. 2-line summary.
```

**Performance check**
```
Read CONTEXT.md first. Audit idle CPU/RAM causes (timers, polling, animation loops, wake word).
List top 5 fixes by impact, apply the safe ones. Short summary.
```

**End-of-session memory update**
```
Update the Progress log in CONTEXT.md in one line for this milestone, and list any known issues in 3 bullets max.
```

---

## 5. Testing Checklist Before Going Public
- [ ] Fresh Windows install test (VM)
- [ ] Works with Wi-Fi off (voice)
- [ ] Mic indicator visible when listening
- [ ] Idle CPU < 3% and RAM reasonable
- [ ] Works on 100%, 125%, 150% DPI and with 2 monitors
- [ ] Survives sleep/wake
- [ ] Uninstaller removes everything (except user config, if chosen)
- [ ] Third-party licences listed

---

## 6. Post-v1 Ideas (do after release, same prompt pattern)
Notification peek, volume/brightness overlays, system stats mode, file shelf, context-aware modes (coding/gaming/meeting), theme editor, plugin system, optional AI answers.

---

## 7. Expected Token Savings Summary
| Habit | Saves |
|-------|-------|
| `CONTEXT.md` instead of re-explaining | Large per session |
| One milestone per fresh session | Avoids long chat history |
| Error tails only (15 lines) | Avoids huge log pastes |
| "Change only what is needed" | Prevents full-file rewrites |
| Commit + rollback | Avoids repeated fix loops |
