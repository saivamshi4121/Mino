/**
 * Media module — polls Windows SMTC (System Media Transport Controls) via
 * PowerShell and emits `media.update` events.  Also handles IPC commands for
 * play/pause/next/previous by invoking SMTC control actions.
 */

import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import type { Module } from './index'

const execFileAsync = promisify(execFile)

const POLL_INTERVAL = 3_000 // ms between SMTC polls

// ── PowerShell helpers (stored as plain string arrays to avoid backtick conflicts) ──

const SMTC_PREAMBLE = [
  'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  '$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |',
  '  Where-Object { $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and',
  '  $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation`1" })[0]',
  'function Await($op, $t) { $asTask.MakeGenericMethod($t).Invoke($null,@($op)).GetAwaiter().GetResult() }',
  '[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null',
  '$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])'
].join('\n')

const PS_QUERY = [
  SMTC_PREAMBLE,
  '$s = $mgr.GetCurrentSession()',
  'if (-not $s) { Write-Output "NO_SESSION"; exit 0 }',
  '$p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])',
  '$pb = $s.GetPlaybackInfo()',
  '$artist = if ($p.Artist) { $p.Artist } else { "" }',
  '$title  = if ($p.Title)  { $p.Title  } else { "" }',
  'Write-Output ("TITLE=" + $title + "|ARTIST=" + $artist + "|STATUS=" + $pb.PlaybackStatus)'
].join('\n')

function buildControlScript(action: 'Play' | 'Pause' | 'SkipNext' | 'SkipPrevious'): string {
  return [
    SMTC_PREAMBLE,
    '$s = $mgr.GetCurrentSession()',
    `if ($s) { $s.Try${action}Async() | Out-Null }`
  ].join('\n')
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MediaStatus = 'Playing' | 'Paused' | 'Stopped' | 'None'

export interface MediaInfo {
  title: string
  artist: string
  status: MediaStatus
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSmtcStatus(raw: string): MediaStatus {
  if (raw.includes('Playing')) return 'Playing'
  if (raw.includes('Paused')) return 'Paused'
  if (raw.includes('Stopped')) return 'Stopped'
  return 'None'
}

async function querySmtc(): Promise<MediaInfo | null> {
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      PS_QUERY
    ])
    const line = stdout.trim()
    if (!line || line === 'NO_SESSION') return null

    const parts: Record<string, string> = {}
    for (const seg of line.split('|')) {
      const idx = seg.indexOf('=')
      if (idx !== -1) parts[seg.slice(0, idx)] = seg.slice(idx + 1)
    }
    const status = parseSmtcStatus(parts['STATUS'] ?? '')
    if (status === 'None' || status === 'Stopped') return null

    return {
      title: parts['TITLE'] ?? '',
      artist: parts['ARTIST'] ?? '',
      status
    }
  } catch {
    return null
  }
}

export async function sendMediaCommand(
  action: 'Play' | 'Pause' | 'SkipNext' | 'SkipPrevious'
): Promise<void> {
  const script = buildControlScript(action)
  await new Promise<void>((resolve, reject) => {
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: 'ignore',
      windowsHide: true
    })
    ps.on('error', reject)
    ps.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Media command exited with code ${code ?? 'unknown'}`))
    })
  })
}

// ── Module ────────────────────────────────────────────────────────────────────

let interval: NodeJS.Timeout | undefined
let active = false
let inFlight = false
let lastTitle = ''
let lastArtist = ''
let lastStatus: MediaStatus = 'None'

export const mediaModule: Module = {
  id: 'media',
  priority: 20, // runs after battery (10)

  start(emit) {
    if (active) return
    active = true

    const poll = async (): Promise<void> => {
      if (!active || inFlight) return
      inFlight = true
      try {
        const info = await querySmtc()
        if (!active) return

        const title = info?.title ?? ''
        const artist = info?.artist ?? ''
        const status: MediaStatus = info?.status ?? 'None'

        // only emit when something changed
        if (title !== lastTitle || artist !== lastArtist || status !== lastStatus) {
          lastTitle = title
          lastArtist = artist
          lastStatus = status
          emit({ type: 'media.update', payload: { title, artist, status } })
        }
      } finally {
        inFlight = false
      }
    }

    void poll()
    interval = setInterval(() => void poll(), POLL_INTERVAL)
  },

  stop() {
    active = false
    if (interval) clearInterval(interval)
    interval = undefined
    lastTitle = ''
    lastArtist = ''
    lastStatus = 'None'
  }
}
