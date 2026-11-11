# mino

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## App launcher

On Windows, open the temporary dev panel with the grave-accent key, then enter
commands such as `open chrome and notepad`, `launch code`, or `close notepad`.
The app list is indexed from Start Menu shortcuts and Store apps, cached under
`%APPDATA%\dynamic-island\apps.json`, and refreshed every six hours. Use
**Refresh Apps** in the panel to refresh it immediately.

Launcher aliases are configured in `config/default.json` as alias-to-app-name
pairs under `launcher.aliases`. An alias is applied when its target app name is
present in the indexed Start Menu apps.

## Offline voice commands

By default, the offline wake word **“Hey Mino”** or **“Hey Island”** activates
voice commands; **Ctrl+Alt+Space** is the default hotkey. If another app uses it,
Mino tries **Ctrl+Alt+M**, then **Ctrl+Shift+Space**, and shows which shortcut
was activated. Allow microphone access.
Recognition runs locally with Vosk; no audio is sent online. Set
`voice.wakeWordEnabled` to `false` in `config/default.json` to disable always-on
wake-word listening.

Supported commands include opening and closing apps, media playback, timers,
Pomodoro focus, battery status, system volume, and Google/YouTube search. For
example: “open Notepad”, “set timer for five minutes”, “start focus”, or “search
cats on YouTube”.

The app uses the Vosk English-Indian model `vosk-model-small-en-in-0.4`. The
runtime archive is in `assets/models/runtime`; if you need to recreate it, run
this from the project root:

```powershell
tar.exe -czf assets/models/runtime/vosk-model-small-en-in-0.4.tar.gz -C assets/models vosk-model-small-en-in-0.4
```

The archive must contain the model folder at its root. Set the hotkey in
`config/default.json` under `voice.hotkey`.
