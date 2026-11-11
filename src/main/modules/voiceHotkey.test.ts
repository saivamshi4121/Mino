import { describe, expect, it, vi } from 'vitest'
import { FALLBACK_VOICE_HOTKEYS, registerVoiceHotkey } from './voiceHotkey'

describe('registerVoiceHotkey', () => {
  it('uses the configured accelerator when available', () => {
    const register = vi.fn(() => true)
    const callback = vi.fn()

    expect(registerVoiceHotkey(register, 'Control+Alt+Space', callback)).toBe('Control+Alt+Space')
    expect(register).toHaveBeenCalledOnce()
  })

  it('tries fallbacks in order when the configured accelerator is taken', () => {
    const register = vi
      .fn<(accelerator: string, callback: () => void) => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)

    expect(registerVoiceHotkey(register, 'Control+Alt+Space', vi.fn())).toBe(
      FALLBACK_VOICE_HOTKEYS[1]
    )
    expect(register.mock.calls.map(([accelerator]) => accelerator)).toEqual([
      'Control+Alt+Space',
      ...FALLBACK_VOICE_HOTKEYS
    ])
  })

  it('returns null when every accelerator is unavailable', () => {
    const register = vi.fn<(accelerator: string, callback: () => void) => boolean>(() => false)

    expect(registerVoiceHotkey(register, 'Control+Alt+Space', vi.fn())).toBeNull()
  })

  it('does not retry the configured accelerator when it matches a fallback', () => {
    const register = vi.fn<(accelerator: string, callback: () => void) => boolean>(() => false)

    registerVoiceHotkey(register, FALLBACK_VOICE_HOTKEYS[0], vi.fn())

    expect(register.mock.calls.map(([accelerator]) => accelerator)).toEqual([
      ...FALLBACK_VOICE_HOTKEYS
    ])
  })
})
