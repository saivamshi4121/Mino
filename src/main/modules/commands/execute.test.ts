import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LauncherCommandResult } from '../../../shared/moduleEvents'

const { runLauncherCommandMock } = vi.hoisted(() => ({
  runLauncherCommandMock: vi.fn()
}))

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }))
vi.mock('systeminformation', () => ({ battery: vi.fn() }))
vi.mock('../media', () => ({ sendMediaCommand: vi.fn() }))
vi.mock('../launcher', () => ({ runLauncherCommand: runLauncherCommandMock }))
vi.mock('./volume', () => ({ setSystemMute: vi.fn(), setSystemVolume: vi.fn() }))

import { executeVoiceCommand } from './execute'

describe('executeVoiceCommand launcher alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports the matched app when launching fails', async () => {
    runLauncherCommandMock.mockResolvedValue({
      ok: false,
      reason: 'spawn failed',
      results: [{ action: 'open', ok: false, matched: 'Calculator', reason: 'spawn failed' }]
    } satisfies LauncherCommandResult)

    await expect(executeVoiceCommand('open calculator', vi.fn())).resolves.toMatchObject({
      title: "Couldn't open Calculator",
      message: 'spawn failed'
    })
  })

  it('reports not found only when the fuzzy match found no app', async () => {
    runLauncherCommandMock.mockResolvedValue({
      ok: false,
      reason: 'No matching app',
      results: [
        { action: 'open', ok: false, matched: null, reason: 'No matching app', notFound: true }
      ]
    } satisfies LauncherCommandResult)

    await expect(executeVoiceCommand('open calcium', vi.fn())).resolves.toMatchObject({
      title: "Couldn't find app"
    })
  })

  it('includes the matched name in the success alert', async () => {
    runLauncherCommandMock.mockResolvedValue({
      ok: true,
      reason: null,
      results: [{ action: 'open', ok: true, matched: 'Calculator', reason: null }]
    } satisfies LauncherCommandResult)

    await expect(executeVoiceCommand('open calcium', vi.fn())).resolves.toMatchObject({
      title: 'Opening Calculator',
      type: 'success'
    })
  })
})
