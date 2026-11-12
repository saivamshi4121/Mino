import { shell } from 'electron'
import * as systeminformation from 'systeminformation'
import type {
  IslandModuleEvent,
  MediaCommand,
  VoiceCommandResult
} from '../../../shared/moduleEvents'
import { sendMediaCommand } from '../media'
import { runLauncherCommand } from '../launcher'
import { parseVoiceCommand } from './parser'
import { setSystemMute, setSystemVolume } from './volume'

const MEDIA_ACTIONS: Record<MediaCommand, 'Play' | 'Pause' | 'SkipNext' | 'SkipPrevious'> = {
  play: 'Play',
  pause: 'Pause',
  next: 'SkipNext',
  prev: 'SkipPrevious'
}

export async function executeVoiceCommand(
  input: string,
  emit: (event: IslandModuleEvent) => void
): Promise<VoiceCommandResult> {
  const command = parseVoiceCommand(input)
  if (!command) {
    return {
      ok: false,
      title: "Didn't catch that",
      message: 'Try a supported voice command.',
      type: 'info'
    }
  }

  switch (command.type) {
    case 'launcher': {
      const result = await runLauncherCommand(input, emit)
      const failed = result.results.find((entry) => !entry.ok)
      const names = result.results
        .map((entry) => entry.matched)
        .filter((name): name is string => Boolean(name))
      const action = command.operations[0]?.action === 'close' ? 'Closing' : 'Opening'
      return result.ok
        ? { ok: true, title: `${action} ${names.join(' and ')}`, type: 'success' }
        : {
            ok: false,
            title:
              result.results.length === 0
                ? "Didn't catch that"
                : failed?.notFound
                  ? "Couldn't find app"
                  : failed?.matched
                    ? `${failed.action === 'open' ? "Couldn't open" : "Couldn't close"} ${failed.matched}`
                    : 'App command failed',
            message: result.reason ?? undefined,
            type: 'error'
          }
    }
    case 'media':
      await sendMediaCommand(MEDIA_ACTIONS[command.command])
      return {
        ok: true,
        title:
          command.command === 'next'
            ? 'Skipping to next song'
            : command.command === 'prev'
              ? 'Playing previous song'
              : command.command === 'play'
                ? 'Playing media'
                : 'Pausing media',
        type: 'success'
      }
    case 'activity':
      emit({ type: 'activity.command', payload: command.command })
      if (command.command.type === 'timer.start') {
        const totalSeconds = Math.round(command.command.minutes * 60)
        const duration =
          totalSeconds % 60 === 0
            ? `${totalSeconds / 60} minute${totalSeconds === 60 ? '' : 's'}`
            : `${totalSeconds} seconds`
        return { ok: true, title: 'Timer started', message: duration, type: 'success' }
      }
      return {
        ok: true,
        title:
          command.command.type === 'pomodoro.start'
            ? 'Focus started'
            : command.command.type === 'pomodoro.pause'
              ? 'Focus paused'
              : command.command.type === 'pomodoro.skip'
                ? 'Break skipped'
                : command.command.type === 'pomodoro.reset'
                  ? 'Focus stopped'
                  : 'Timer canceled',
        type: 'success'
      }
    case 'battery.query': {
      const battery = await systeminformation.battery()
      return battery.hasBattery
        ? {
            ok: true,
            title: `Battery ${Math.round(battery.percent)}%`,
            message: battery.isCharging ? 'Charging' : 'On battery power',
            type: 'info'
          }
        : { ok: true, title: 'No battery detected', type: 'info' }
    }
    case 'volume.set':
      await setSystemVolume(command.level)
      return { ok: true, title: `Volume set to ${command.level}%`, type: 'success' }
    case 'volume.mute':
      await setSystemMute(command.muted)
      return {
        ok: true,
        title: command.muted ? 'Muted' : 'Unmuted',
        type: 'success'
      }
    case 'web.search': {
      const query = encodeURIComponent(command.query)
      const url =
        command.provider === 'youtube'
          ? `https://www.youtube.com/results?search_query=${query}`
          : `https://www.google.com/search?q=${query}`
      await shell.openExternal(url)
      return {
        ok: true,
        title: `Searching ${command.provider === 'youtube' ? 'YouTube' : 'Google'}`,
        message: command.query,
        type: 'success'
      }
    }
  }
}
