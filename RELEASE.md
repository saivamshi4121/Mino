# Release checklist

## Build artifacts

- [ ] Run `npm ci`, `npm run typecheck`, `npm run lint`, and `npx vitest run`.
- [ ] Run `npm run dist` and verify the NSIS installer and portable ZIP are in
      `dist/`.
- [ ] Verify the installer uses the Dynamic Island name/icon and defaults to a
      per-user installation.
- [ ] Verify the optional start-with-Windows checkbox adds/removes the current
      user's startup entry.

## Manual Windows validation

- [ ] Install and launch from a clean Windows user account or VM.
- [ ] Launch the portable build after extracting it to a writable folder.
- [ ] Turn off Wi-Fi and verify wake-word and hotkey voice recognition work.
- [ ] Check media, timers, Pomodoro, Settings, tray, and startup behavior.
- [ ] Verify logs rotate under `%APPDATA%\dynamic-island\logs`.
- [ ] Test 100%, 125%, and 150% display scaling and multiple monitors.
- [ ] Verify fullscreen and browser presence behavior.
- [ ] Uninstall and confirm user settings remain, if that is the intended policy.
- [ ] Review third-party license notices and attach both Windows artifacts to
      the tagged release.
