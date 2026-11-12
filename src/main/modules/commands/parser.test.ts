import { describe, expect, it } from 'vitest'
import { parseLauncherCommand, parseVoiceCommand } from './parser'

describe('parseLauncherCommand', () => {
  it.each([
    ['open chrome', [{ action: 'open', name: 'chrome' }]],
    ['Open Notepad', [{ action: 'open', name: 'Notepad' }]],
    ['launch calculator', [{ action: 'open', name: 'calculator' }]],
    ['start visual studio code', [{ action: 'open', name: 'visual studio code' }]],
    [
      'open chrome and notepad',
      [
        { action: 'open', name: 'chrome' },
        { action: 'open', name: 'notepad' }
      ]
    ],
    [
      'launch paint and calculator',
      [
        { action: 'open', name: 'paint' },
        { action: 'open', name: 'calculator' }
      ]
    ],
    [
      'start edge and settings',
      [
        { action: 'open', name: 'edge' },
        { action: 'open', name: 'settings' }
      ]
    ],
    ['close chrome', [{ action: 'close', name: 'chrome' }]],
    [
      'close notepad and calculator',
      [
        { action: 'close', name: 'notepad' },
        { action: 'close', name: 'calculator' }
      ]
    ],
    ['  open chrome  ', [{ action: 'open', name: 'chrome' }]],
    ['OPEN CHROME', [{ action: 'open', name: 'CHROME' }]],
    ['start browser', [{ action: 'open', name: 'browser' }]],
    ['open code', [{ action: 'open', name: 'code' }]],
    ['launch spotify', [{ action: 'open', name: 'spotify' }]],
    ['close spotify', [{ action: 'close', name: 'spotify' }]],
    ['open file explorer', [{ action: 'open', name: 'file explorer' }]],
    ['start snipping tool', [{ action: 'open', name: 'snipping tool' }]],
    [
      'open word and excel',
      [
        { action: 'open', name: 'word' },
        { action: 'open', name: 'excel' }
      ]
    ],
    [
      'launch teams and outlook',
      [
        { action: 'open', name: 'teams' },
        { action: 'open', name: 'outlook' }
      ]
    ],
    [
      'close edge and browser',
      [
        { action: 'close', name: 'edge' },
        { action: 'close', name: 'browser' }
      ]
    ],
    ['start control panel', [{ action: 'open', name: 'control panel' }]],
    ['open task manager', [{ action: 'open', name: 'task manager' }]],
    ['launch terminal', [{ action: 'open', name: 'terminal' }]],
    ['close visual studio code', [{ action: 'close', name: 'visual studio code' }]],
    [
      'open chrome and notepad and calculator',
      [
        { action: 'open', name: 'chrome' },
        { action: 'open', name: 'notepad' },
        { action: 'open', name: 'calculator' }
      ]
    ]
  ])('parses %s', (input, expected) => {
    expect(parseLauncherCommand(input)).toEqual(expected)
  })

  it.each(['', 'chrome', 'open', 'close ', 'open chrome and ', 'delete chrome'])(
    'rejects %s',
    (input) => {
      expect(parseLauncherCommand(input)).toBeNull()
    }
  )
})

describe('parseVoiceCommand', () => {
  it.each([
    [
      'open VS Code and Spotify',
      {
        type: 'launcher',
        operations: [
          { action: 'open', name: 'VS Code' },
          { action: 'open', name: 'Spotify' }
        ]
      }
    ],
    ['close Notepad', { type: 'launcher', operations: [{ action: 'close', name: 'Notepad' }] }],
    ['launch Chrome', { type: 'launcher', operations: [{ action: 'open', name: 'Chrome' }] }],
    ['play', { type: 'media', command: 'play' }],
    ['pause', { type: 'media', command: 'pause' }],
    ['next song', { type: 'media', command: 'next' }],
    ['previous song', { type: 'media', command: 'prev' }],
    ['set timer for 5 minutes', { type: 'activity', command: { type: 'timer.start', minutes: 5 } }],
    [
      'set a timer for thirty seconds',
      { type: 'activity', command: { type: 'timer.start', minutes: 0.5 } }
    ],
    ['set timer for 2 minutes', { type: 'activity', command: { type: 'timer.start', minutes: 2 } }],
    ['cancel timer', { type: 'activity', command: { type: 'timer.cancel' } }],
    ['start focus', { type: 'activity', command: { type: 'pomodoro.start' } }],
    ['start pomodoro', { type: 'activity', command: { type: 'pomodoro.start' } }],
    ['pause focus', { type: 'activity', command: { type: 'pomodoro.pause' } }],
    ['skip break', { type: 'activity', command: { type: 'pomodoro.skip' } }],
    ['stop focus', { type: 'activity', command: { type: 'pomodoro.reset' } }],
    ["what's my battery", { type: 'battery.query' }],
    ['how much battery', { type: 'battery.query' }],
    ['how much battery do I have', { type: 'battery.query' }],
    ['battery status', { type: 'battery.query' }],
    ['volume 50', { type: 'volume.set', level: 50 }],
    ['volume 100', { type: 'volume.set', level: 100 }],
    ['set volume to 30 percent', { type: 'volume.set', level: 30 }],
    ['change the volume to thirty percent', { type: 'volume.set', level: 30 }],
    ['mute', { type: 'volume.mute', muted: true }],
    ['unmute', { type: 'volume.mute', muted: false }],
    ['search cats on YouTube', { type: 'web.search', query: 'cats', provider: 'youtube' }],
    ['search weather on Google', { type: 'web.search', query: 'weather', provider: 'google' }],
    [
      'set timer for thirty five minutes',
      { type: 'activity', command: { type: 'timer.start', minutes: 35 } }
    ]
  ])('parses %s', (input, expected) => {
    expect(parseVoiceCommand(input)).toEqual(expected)
  })

  it.each(['', 'volume 101', 'volume loud', 'set timer for zero minutes', 'search on google'])(
    'rejects unsupported voice command %s',
    (input) => {
      expect(parseVoiceCommand(input)).toBeNull()
    }
  )
})
