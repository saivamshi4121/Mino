import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'
import type { PomodoroStats } from '../../shared/moduleEvents'

function getToday(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function getStatsPath(): string {
  return join(app.getPath('appData'), 'dynamic-island', 'stats.json')
}

async function readStatsFile(): Promise<PomodoroStats | null> {
  try {
    const contents = await readFile(getStatsPath(), 'utf8')
    const data: unknown = JSON.parse(contents)
    if (
      typeof data !== 'object' ||
      data === null ||
      !('date' in data) ||
      typeof data.date !== 'string' ||
      !('completedRounds' in data) ||
      typeof data.completedRounds !== 'number' ||
      !Number.isInteger(data.completedRounds) ||
      data.completedRounds < 0
    ) {
      throw new Error('Pomodoro stats file has an invalid format')
    }
    return { date: data.date, completedRounds: data.completedRounds }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

export async function getTodayPomodoroStats(): Promise<PomodoroStats> {
  const today = getToday()
  const saved = await readStatsFile()
  return saved?.date === today ? saved : { date: today, completedRounds: 0 }
}

export async function recordPomodoroRound(): Promise<PomodoroStats> {
  const stats = await getTodayPomodoroStats()
  const updated = { ...stats, completedRounds: stats.completedRounds + 1 }
  const path = getStatsPath()
  const directory = join(app.getPath('appData'), 'dynamic-island')
  const temporaryPath = `${path}.tmp`

  await mkdir(directory, { recursive: true })
  await writeFile(temporaryPath, JSON.stringify(updated, null, 2), 'utf8')
  await rename(temporaryPath, path)
  return updated
}
