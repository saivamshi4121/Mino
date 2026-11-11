# Dynamic Island for Windows

**Mino** is a personal productivity companion for Windows. It places a small,
glossy island at the top of your screen to show useful activity at a glance and
lets you control apps and everyday tasks with your voice. It is designed to run
on your own laptop: speech recognition and the bundled voice model run locally,
without a Mino account or cloud speech service.

> **Platform:** Windows 10/11, x64 · **Latest release:** 0.1.5

## What Mino can do

- Show currently playing media, timers, and Pomodoro focus sessions in a
  compact, glanceable dock.
- Launch or close installed apps and control media, timers, focus sessions,
  system volume, battery status, and web searches with voice commands.
- Keep out of the way when you do not need it, while remaining available from
  the system tray, wake word, or hotkey.
- Adapt its position and visibility to your display, cursor, and foreground
  app.

## Special features

### Three presence levels

- **Ghost:** the default idle state. Mino shows only a subtle top-centre glow
  and remains click-through.
- **Glance:** activity such as media playback, a timer, Pomodoro, or microphone
  use brings up a compact dock. Choose a left, centre, or right dock position;
  drag it to reposition it.
- **Summon:** temporarily expand the island when you activate voice with the
  wake word or hotkey, or dwell at the top-centre screen edge. It collapses
  after a period without interaction.

### Shy island and app-aware display

When the pointer comes close to the compact dock, Mino shifts it away or
shrinks it, then returns it when the pointer leaves. When configured, Mino
hides over fullscreen apps and reduces to a dot while a supported browser is in
the foreground.

### Offline voice

Mino includes the Vosk English-Indian speech model. Speech recognition runs on
the laptop and does not send microphone audio or transcripts to a Mino server.
The first time you use the microphone, allow microphone access in Windows.

## Install and use it on your laptop

1. Download `Dynamic-Island-0.1.5-setup.exe` from the project's GitHub release.
2. Run the installer. It installs for your Windows user and offers an optional
   **Start Dynamic Island when I sign in** checkbox.
3. Open **Dynamic Island** from the Start menu. The island appears at the top
   of your screen; use its system-tray icon to open Settings, show or hide it,
   toggle the microphone or wake word, or quit.
4. In Settings, enable the microphone and wake word and review the configured
   voice hotkey. You can also adjust the dock, monitor, Pomodoro durations,
   launcher aliases, and other appearance options.
5. Say **“Hey Mino”** or **“Hey Island”**, wait for the listening state, and
   speak a command. Alternatively, press the configured hotkey to start a
   command directly.

The voice model is included in the installer; no download or internet
connection is needed for speech recognition. Internet is only needed for
commands that intentionally open a web search.

### Portable version

Download and extract `Dynamic-Island-0.1.5-portable.zip` to a folder you can
write to, then run `dynamic-island.exe`. The portable version does not install
Start menu shortcuts or add an autostart entry.

## Voice command examples

| Say something like | Mino will |
| --- | --- |
| “Open Notepad” | Find and launch an installed app |
| “Close Notepad” | Close a running app |
| “Play music”, “pause”, or “next track” | Control media playback |
| “Set a timer for five minutes” | Start a timer |
| “Start focus” | Start a Pomodoro focus session |
| “How much battery?” | Read battery status |
| “Set volume to 30 percent” | Change system volume |
| “Search cats on YouTube” | Open a YouTube search in your browser |

Voice recognition is local. For a search command, the search phrase is sent to
the search provider you requested when the browser opens the search page.

## Settings and local data

Settings are stored in:

```text
%APPDATA%\dynamic-island\config.json
```

The Settings window is the recommended way to change options. Available
settings include:

| Setting | What it controls |
| --- | --- |
| Voice hotkey | Shortcut used to start a voice command |
| Wake word | Enable or disable “Hey Mino” / “Hey Island” activation |
| Microphone | Enable or disable microphone use |
| Pomodoro durations | Focus, short-break, and long-break lengths |
| Launcher aliases | Short names for apps in the app launcher |
| Monitor | Follow the primary, selected, or cursor display |
| Dock | Left, centre, or right glance position and saved placement |
| Fullscreen behavior | Hide the island over fullscreen apps |
| Browser behavior | Reduce the island to a dot over supported browsers |
| Sounds | Enable or disable subtle transition sounds |
| Start with Windows | Control automatic launch at sign-in |

Application logs are written under:

```text
%APPDATA%\dynamic-island\logs
```

If voice activation fails, check that microphone access is allowed for desktop
apps in Windows Privacy settings, then review `mino.log` in the logs folder.

## Build from source

To run or build Mino from source, use a Windows x64 laptop with Git, Node.js
22.x, and npm:

```powershell
git clone <repository-url>
cd mino
npm ci
npm run dev
```

Create a production build and Windows release packages with:

```powershell
npm run typecheck
npm run lint
npx vitest run
npm run dist
```

The NSIS installer and portable ZIP are written to `dist/`. The packaged app
includes the Vosk archive from `assets/models/runtime/`.

## Technology stack

- **Electron** hosts the Windows desktop application and provides the main
  process, system tray, installer integration, and secure preload bridge.
- **React and TypeScript** power the interface and typed application code.
- **Vite / electron-vite** bundle the main process, preload, and renderer.
- **Framer Motion** provides spring-based island animations.
- **XState** manages the island's interaction and presentation states.
- **Vosk Browser and WebAssembly** provide local speech recognition.
- **Windows APIs and PowerShell integration** support desktop context and
  system-level features.

## Privacy

Microphone audio is processed on-device using the bundled Vosk model. Mino
does not upload microphone audio or transcripts to a Mino service. No Mino
account or cloud voice API is used. Web searches are sent to the requested
provider only when you use a search command.

## Project documents

- [MIT License](./LICENSE)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)
- [Release checklist](./RELEASE.md)
