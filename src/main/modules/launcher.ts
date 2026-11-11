import { app, shell } from 'electron'
import { execFile } from 'child_process'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { promisify } from 'util'
import Fuse from 'fuse.js'
import type {
  IslandModuleEvent,
  LauncherCommandResult,
  LauncherOperationResult,
  LauncherResult,
  LauncherStatus
} from '../../shared/moduleEvents'
import { parseLauncherCommand } from './commands/parser'

const execFileAsync = promisify(execFile)
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000
const CACHE_VERSION = 1

interface IndexedApp {
  name: string
  kind: 'shortcut' | 'uwp'
  shortcutPath?: string
  targetPath?: string
  appId?: string
  processName?: string
  aliases: string[]
}

interface AppCache {
  version: number
  indexedAt: number
  apps: IndexedApp[]
}

interface RawShortcut {
  name: unknown
  path: unknown
  targetPath: unknown
}

interface RawUwpApp {
  name: unknown
  appId: unknown
}

interface RawIndex {
  shortcuts?: RawShortcut[] | RawShortcut
  uwp?: RawUwpApp[] | RawUwpApp
}

const INDEX_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$roots = @(',
  "  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'),",
  "  (Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs')",
  ')',
  '$wsh = New-Object -ComObject WScript.Shell',
  '$shortcuts = @(',
  '  foreach ($root in $roots) {',
  '    if (Test-Path -LiteralPath $root) {',
  "      Get-ChildItem -LiteralPath $root -Filter '*.lnk' -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {",
  '        $shortcut = $wsh.CreateShortcut($_.FullName)',
  '        [pscustomobject]@{ name = $_.BaseName; path = $_.FullName; targetPath = $shortcut.TargetPath }',
  '      }',
  '    }',
  '  }',
  ')',
  '$uwp = @(Get-StartApps | ForEach-Object { [pscustomobject]@{ name = $_.Name; appId = $_.AppID } })',
  '[pscustomobject]@{ shortcuts = $shortcuts; uwp = $uwp } | ConvertTo-Json -Depth 4 -Compress'
].join('\n')

let apps: IndexedApp[] = []
let indexedAt = 0
let aliases: Record<string, string> = {}
let refreshPromise: Promise<void> | null = null
let refreshTimer: NodeJS.Timeout | undefined

function getCachePath(): string {
  return join(app.getPath('appData'), 'dynamic-island', 'apps.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asArray<T>(value: T[] | T | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function processNameFromPath(targetPath: string | undefined): string | undefined {
  if (!targetPath) return undefined
  const file = basename(targetPath)
  return file.toLowerCase().endsWith('.exe') ? file.slice(0, -4) : undefined
}

function processNameFromAppId(appId: string): string | undefined {
  const packageName = appId.split('_')[0]
  return packageName.split('.').pop() || undefined
}

function normalizeIndex(raw: RawIndex): IndexedApp[] {
  const shortcuts = asArray(raw.shortcuts)
    .filter(
      (entry): entry is RawShortcut =>
        isRecord(entry) && typeof entry.name === 'string' && typeof entry.path === 'string'
    )
    .map((entry): IndexedApp => ({
      name: entry.name as string,
      kind: 'shortcut',
      shortcutPath: entry.path as string,
      targetPath: typeof entry.targetPath === 'string' ? entry.targetPath : undefined,
      processName: processNameFromPath(
        typeof entry.targetPath === 'string' ? entry.targetPath : undefined
      ),
      aliases: []
    }))
  const uwpApps = asArray(raw.uwp)
    .filter(
      (entry): entry is RawUwpApp =>
        isRecord(entry) && typeof entry.name === 'string' && typeof entry.appId === 'string'
    )
    .map((entry): IndexedApp => ({
      name: entry.name as string,
      kind: 'uwp',
      appId: entry.appId as string,
      processName: processNameFromAppId(entry.appId as string),
      aliases: []
    }))

  const uniqueApps = new Map<string, IndexedApp>()
  for (const entry of [...shortcuts, ...uwpApps]) {
    const key = entry.name.trim().toLocaleLowerCase()
    if (key && !uniqueApps.has(key)) uniqueApps.set(key, entry)
  }

  const indexedApps = [...uniqueApps.values()]
  for (const [alias, target] of Object.entries(aliases)) {
    const app = indexedApps.find(
      (entry) => entry.name.toLocaleLowerCase() === target.toLocaleLowerCase()
    )
    if (
      app &&
      !app.aliases.some((value) => value.toLocaleLowerCase() === alias.toLocaleLowerCase())
    ) {
      app.aliases.push(alias)
    }
  }
  return indexedApps
}

function isAppCache(value: unknown): value is AppCache {
  if (!isRecord(value) || value.version !== CACHE_VERSION || typeof value.indexedAt !== 'number') {
    return false
  }
  return (
    Array.isArray(value.apps) &&
    value.apps.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.name === 'string' &&
        (entry.kind === 'shortcut' || entry.kind === 'uwp') &&
        Array.isArray(entry.aliases)
    )
  )
}

async function loadCache(): Promise<void> {
  try {
    const contents = await readFile(getCachePath(), 'utf8')
    const cached: unknown = JSON.parse(contents)
    if (!isAppCache(cached)) throw new Error('App index cache has an invalid format')
    indexedAt = cached.indexedAt
    apps = normalizeIndex({
      shortcuts: cached.apps
        .filter((entry) => entry.kind === 'shortcut')
        .map((entry) => ({
          name: entry.name,
          path: entry.shortcutPath,
          targetPath: entry.targetPath
        })),
      uwp: cached.apps
        .filter((entry) => entry.kind === 'uwp')
        .map((entry) => ({ name: entry.name, appId: entry.appId }))
    })
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return
    throw error
  }
}

export async function refreshAppIndex(): Promise<void> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', INDEX_SCRIPT],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 120_000 }
    )
    const raw: unknown = JSON.parse(stdout)
    if (!isRecord(raw)) throw new Error('Windows app index returned invalid data')

    apps = normalizeIndex(raw as RawIndex)
    indexedAt = Date.now()
    const path = getCachePath()
    const directory = join(app.getPath('appData'), 'dynamic-island')
    await mkdir(directory, { recursive: true })
    await writeFile(
      `${path}.tmp`,
      JSON.stringify({ version: CACHE_VERSION, indexedAt, apps }, null, 2),
      'utf8'
    )
    await rename(`${path}.tmp`, path)
  })()

  try {
    await refreshPromise
  } finally {
    refreshPromise = null
  }
}

export async function initializeLauncher(configuredAliases: Record<string, string>): Promise<void> {
  aliases = configuredAliases
  try {
    await loadCache()
  } catch (error) {
    console.error('[launcher] Could not read app index cache', error)
  }

  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      void refreshAppIndex().catch((error: unknown) => {
        console.error('[launcher] Background app index refresh failed', error)
      })
    }, REFRESH_INTERVAL)
  }

  if (Date.now() - indexedAt >= REFRESH_INTERVAL) {
    void refreshAppIndex().catch((error: unknown) => {
      console.error('[launcher] Startup app index refresh failed', error)
    })
  }
}

export function stopLauncher(): void {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = undefined
}

async function findApp(name: string): Promise<IndexedApp | null> {
  if (apps.length === 0) await refreshAppIndex()
  const search = new Fuse(apps, {
    keys: [
      { name: 'name', weight: 0.75 },
      { name: 'aliases', weight: 0.25 }
    ],
    threshold: 0.35,
    ignoreLocation: true
  })
  return search.search(name)[0]?.item ?? null
}

function emitStatus(emit: (event: IslandModuleEvent) => void, payload: LauncherStatus): void {
  emit({ type: 'launcher.status', payload })
}

function failure(name: string, reason: string): LauncherResult {
  return { ok: false, matched: null, reason: `Couldn't find or launch "${name}": ${reason}` }
}

async function openApp(
  name: string,
  emit: (event: IslandModuleEvent) => void
): Promise<LauncherResult> {
  let match: IndexedApp | null
  try {
    match = await findApp(name)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    emitStatus(emit, { phase: 'failed', name, message: reason })
    return failure(name, reason)
  }
  if (!match) {
    const reason = `Couldn't find "${name}" in the app index`
    emitStatus(emit, { phase: 'failed', name, message: reason })
    return { ok: false, matched: null, reason }
  }

  let iconDataUrl: string | undefined
  const iconPath =
    match.targetPath ??
    match.shortcutPath ??
    (match.appId ? `shell:AppsFolder\\${match.appId}` : undefined)
  if (iconPath) {
    try {
      iconDataUrl = (await app.getFileIcon(iconPath, { size: 'small' })).toDataURL()
    } catch (error) {
      console.error(`[launcher] Could not read icon for ${match.name}`, error)
    }
  }

  emitStatus(emit, { phase: 'opening', name: match.name, iconDataUrl })
  try {
    if (match.kind === 'shortcut' && match.shortcutPath) {
      const error = await shell.openPath(match.shortcutPath)
      if (error) throw new Error(error)
    } else if (match.appId) {
      await execFileAsync('explorer.exe', [`shell:AppsFolder\\${match.appId}`], {
        windowsHide: true,
        timeout: 10_000
      })
    } else {
      throw new Error('The app entry has no launch target')
    }
    emitStatus(emit, { phase: 'opened', name: match.name, iconDataUrl })
    return { ok: true, matched: match.name, reason: null }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    emitStatus(emit, { phase: 'failed', name: match.name, iconDataUrl, message: reason })
    return failure(name, reason)
  }
}

async function closeApp(
  name: string,
  emit: (event: IslandModuleEvent) => void
): Promise<LauncherResult> {
  let match: IndexedApp | null
  try {
    match = await findApp(name)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    emitStatus(emit, { phase: 'failed', name, message: reason })
    return failure(name, reason)
  }
  if (!match) {
    const reason = `Couldn't find "${name}" in the app index`
    emitStatus(emit, { phase: 'failed', name, message: reason })
    return { ok: false, matched: null, reason }
  }

  emitStatus(emit, { phase: 'closing', name: match.name })
  if (!match.processName) {
    const reason = `No process name is available for "${match.name}"`
    emitStatus(emit, { phase: 'failed', name: match.name, message: reason })
    return { ok: false, matched: match.name, reason }
  }
  try {
    await execFileAsync('taskkill.exe', ['/IM', `${match.processName}.exe`, '/T', '/F'], {
      windowsHide: true,
      timeout: 10_000
    })
    emitStatus(emit, { phase: 'closed', name: match.name })
    return { ok: true, matched: match.name, reason: null }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    emitStatus(emit, { phase: 'failed', name: match.name, message: reason })
    return { ok: false, matched: match.name, reason }
  }
}

export async function runLauncherCommand(
  input: string,
  emit: (event: IslandModuleEvent) => void
): Promise<LauncherCommandResult> {
  const operations = parseLauncherCommand(input)
  if (!operations) {
    return {
      ok: false,
      reason: 'Use "open <app>", "launch <app>", "start <app>", or "close <app>".',
      results: []
    }
  }

  const results: LauncherOperationResult[] = []
  for (const operation of operations) {
    const result =
      operation.action === 'open'
        ? await openApp(operation.name, emit)
        : await closeApp(operation.name, emit)
    results.push({ action: operation.action, ...result })
  }

  return {
    ok: results.every((result) => result.ok),
    reason: results.find((result) => !result.ok)?.reason ?? null,
    results
  }
}
