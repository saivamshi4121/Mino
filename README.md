# Dynamic Island

Mino is a lightweight Windows island for glanceable activity and offline voice
commands. It runs locally on Windows 10/11 and uses Vosk for on-device speech
recognition.

## Features

- Media controls, timers, Pomodoro focus sessions, and a compact activity dock.
- Ghost, glance, and summon presence modes with cursor-aware hiding.
- Windows tray controls, configurable hotkey, microphone and wake word.
- App launching, system status, and voice-controlled media and timers.
- Offline speech recognition; no audio is uploaded to a Mino service.

## Screenshots

Screenshots will be added before public release.

## Install

Download `Dynamic-Island-0.1.0-setup.exe` for a per-user installation, or
`Dynamic-Island-0.1.0-portable.zip` to extract and run without installing.
The installer offers an optional start-with-Windows checkbox. The offline voice
model is included; no model download or network connection is required for voice
recognition.

## Voice commands

Enable the microphone and wake word in Settings, then say “Hey Mino” or “Hey
Island”. Use the configured hotkey to start a voice command directly.

| Example | Action |
| --- | --- |
| “Open Notepad” | Find and launch an installed app |
| “Close Notepad” | Close a running app |
| “Play music” / “pause” / “next track” | Control media playback |
| “Set a timer for five minutes” | Start a timer |
| “Start focus” | Start a Pomodoro session |
| “How much battery?” | Read battery status |
| “Set volume to 30 percent” | Change system volume |
| “Search cats on YouTube” | Open a browser search |

Voice recognition runs on-device. Search commands intentionally open Google or
YouTube in the browser, which then handles the search request.

## Configuration

Settings are stored at `%APPDATA%\dynamic-island\config.json`. Use the Settings
window to change supported values.

| Setting | Purpose |
| --- | --- |
| `voice.hotkey` | Voice activation shortcut |
| `voice.wakeWordEnabled` | Enable or disable wake-word listening |
| `voice.microphoneEnabled` | Enable or disable microphone access |
| `pomodoro.focusMinutes` | Focus-session duration |
| `pomodoro.breakMinutes` | Short-break duration |
| `pomodoro.longBreakMinutes` | Long-break duration |
| `launcher.aliases` | App-launcher aliases |
| `display.mode` | `primary`, `chosen`, or `cursor` monitor |
| `appearance.dock` | `left`, `center`, or `right` glance position |
| `appearance.hideFullscreen` | Hide the island over fullscreen apps |
| `appearance.browserDot` | Reduce the island to a dot over browsers |
| `soundsEnabled` | Play subtle transition sounds |

## Build from source

Requires Node.js 22 and npm on Windows.

```powershell
npm ci
npm run dev
npm run build
npm run dist
```

`npm run dist` creates the NSIS installer and portable ZIP in `dist/`. The Vosk
model archive is bundled from `assets/models/runtime/` into the packaged app.

## Privacy

Microphone audio is processed locally by the bundled Vosk model. Mino does not
send audio or transcripts to a Mino server. Internet searches are only sent to
the selected search provider when you explicitly issue a search command.

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for dependency licenses
and [RELEASE.md](./RELEASE.md) for release validation steps.
