/**
 * FFmpeg.wasm lazy singleton with progress reporting.
 *
 * Loading the 30MB+ wasm core on demand is the single biggest perf decision
 * in this plugin: we never touch it until the first tool actually runs, and we
 * reuse one instance across calls so the core loads exactly once per session.
 *
 * @module ffmpeg-core
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export type ProgressReport = {
  /** 0..1 fraction of the current operation. */
  progress: number
  /** Human-readable ffmpeg status line, when available. */
  message?: string
}

/** Core artifact URLs — pinned to the 0.12.x line used by @ffmpeg/ffmpeg. */
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'

let instance: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

export function isLoaded(): boolean {
  return instance !== null
}

/**
 * Get (and lazily bootstrap) the shared FFmpeg instance.
 * @param onProgress - optional callback for load + run progress.
 */
export async function getFFmpeg(
  onProgress?: (p: ProgressReport) => void,
): Promise<FFmpeg> {
  if (instance) return instance
  if (loading) return loading

  loading = (async () => {
    const ffmpeg = new FFmpeg()
    ffmpeg.on('progress', ({ progress, time }) => {
      onProgress?.({ progress, message: `ffmpeg ${Math.round(progress * 100)}% (t=${time})` })
    })
    ffmpeg.on('log', ({ message }) => {
      if (message.startsWith('frame=') || message.startsWith('size=')) {
        onProgress?.({ progress: -1, message })
      }
    })
    // load() resolves when the core is ready; progress events then stream in.
    onProgress?.({ progress: 0, message: 'loading ffmpeg.wasm core…' })
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    instance = ffmpeg
    onProgress?.({ progress: 1, message: 'ffmpeg.wasm core ready' })
    return ffmpeg
  })()

  try {
    return await loading
  } catch (err) {
    loading = null // allow a retry after a failed load
    throw err
  }
}

/** Read a local file (File / Blob) into FFmpeg's in-memory FS under a name. */
export async function writeInput(ffmpeg: FFmpeg, file: File | Blob, name: string): Promise<void> {
  await ffmpeg.writeFile(name, await fetchFile(file))
}

/** Read an output file back out of FFmpeg's FS as a Uint8Array. */
export async function readOutput(ffmpeg: FFmpeg, name: string): Promise<Uint8Array> {
  const data = await ffmpeg.readFile(name)
  // FileData is Uint8Array | string (string = path reference); normalise to bytes.
  if (typeof data === 'string') {
    throw new Error(`readFile returned a path reference: ${data}`)
  }
  return data
}

/** Delete a file from the in-memory FS if present (best-effort cleanup). */
export async function cleanup(ffmpeg: FFmpeg, names: string[]): Promise<void> {
  for (const n of names) {
    try {
      await ffmpeg.deleteFile(n)
    } catch {
      // already gone — fine
    }
  }
}

/** Default output extension from a media path, lowercased without the dot. */
export function extOf(path: string): string {
  const i = path.lastIndexOf('.')
  return i >= 0 ? path.slice(i + 1).toLowerCase() : ''
}

/** Sanitize an output name so it can never escape the in-memory FS. */
export function safeOutName(base: string, ext: string): string {
  const stem = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
  return `${stem}.${ext}`
}
