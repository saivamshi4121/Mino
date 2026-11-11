export const FALLBACK_VOICE_HOTKEYS = ['Control+Alt+M', 'Control+Shift+Space'] as const

export function registerVoiceHotkey(
  register: (accelerator: string, callback: () => void) => boolean,
  preferred: string,
  callback: () => void
): string | null {
  const candidates = [...new Set([preferred, ...FALLBACK_VOICE_HOTKEYS])]
  for (const accelerator of candidates) {
    if (register(accelerator, callback)) return accelerator
  }
  return null
}
