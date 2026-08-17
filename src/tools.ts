/**
 * Tool implementations for dsh-video-tools.
 *
 * Each tool follows the DSH `defineTool` contract:
 *   name / description / parameters / output.schema / execute
 * Arguments arrive typed and validated; results must satisfy output.schema.
 *
 * @module tools
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { getFFmpeg, writeInput, readOutput, cleanup, extOf, safeOutName } from './ffmpeg-core.js'

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

/** Parse a number out of a ffprobe-style "N" or "N.M" token. */
function toSeconds(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/**
 * Run ffprobe-like metadata extraction via `-i file -f null -` and read the
 * stderr log lines. FFmpeg.wasm surfaces ffprobe data through `-i` diagnostics.
 */
async function probeInfo(
  ffmpeg: FFmpeg,
  input: string,
): Promise<Record<string, string | number>> {
  const logs: string[] = []
  const prev = ffmpeg.on
  // ffmpeg.on('log') may already have a listener from core; collect into logs.
  // We rely on `-i` to print stream info to stderr (log events).
  ffmpeg.on('log', ({ message }) => logs.push(message))
  await ffmpeg.exec(['-i', input, '-f', 'null', '-'])
  void prev
  const text = logs.join('\n')
  const info: Record<string, string | number> = { raw: text.slice(0, 2000) }
  const m = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (m) {
    info.duration = Number(m[1]) * 3600 + Number(m[2]) * 60 + toSeconds(m[3])
  }
  const v = text.match(/Stream #\d+:\d+.*Video:\s*([^,\s]+)[^,]*,\s*(\d+)x(\d+)/)
  if (v) {
    info.video_codec = v[1]
    info.width = Number(v[2])
    info.height = Number(v[3])
  }
  const a = text.match(/Stream #\d+:\d+.*Audio:\s*([^,\s]+)/)
  if (a) info.audio_codec = a[1]
  return info
}

/* ------------------------------------------------------------------ */
/*  video_info                                                         */
/* ------------------------------------------------------------------ */

export type VideoInfoArgs = {
  /** Local file name (must already exist in FFmpeg's FS via a prior step). */
  input: string
}
export type VideoInfoResult = {
  duration?: number
  width?: number
  height?: number
  video_codec?: string
  audio_codec?: string
  /** Truncated raw probe text for debugging. */
  raw: string
}

/** Probe a video's metadata without transcoding. */
export async function videoInfo(args: VideoInfoArgs): Promise<VideoInfoResult> {
  const ffmpeg = await getFFmpeg()
  const info = await probeInfo(ffmpeg, args.input)
  return {
    duration: info.duration as number | undefined,
    width: info.width as number | undefined,
    height: info.height as number | undefined,
    video_codec: info.video_codec as string | undefined,
    audio_codec: info.audio_codec as string | undefined,
    raw: (info.raw as string) ?? '',
  }
}

/* ------------------------------------------------------------------ */
/*  video_frames                                                       */
/* ------------------------------------------------------------------ */

export type VideoFramesArgs = {
  /** Path of the uploaded video in FFmpeg's FS. */
  input: string
  /** Number of frames to extract, evenly spread across the duration. */
  count?: number
  /** Optional time (seconds) to grab a single frame at instead of N frames. */
  at?: number
  /** JPEG quality 1-31 (lower = better). Default 2. */
  quality?: number
  /** Output width (maintains aspect ratio); omit for original size. */
  width?: number
  /** Base name for output frames (defaults to input stem). */
  output?: string
}
export type VideoFramesResult = {
  /** Generated frame file names inside FFmpeg's FS. */
  frames: string[]
}

/** Extract evenly-spaced frames (or one frame at a timestamp) from a video. */
export async function videoFrames(args: VideoFramesArgs): Promise<VideoFramesResult> {
  const ffmpeg = await getFFmpeg()
  const count = Math.min(Math.max(args.count ?? 1, 1), 20)
  const stem = safeOutName(args.output ?? args.input, '')
  const outBase = stem.slice(0, -1) // drop the trailing dot from safeOutName('', ext)

  if (args.at !== undefined) {
    const out = `${outBase}_at${Math.round(args.at)}.jpg`
    const cmd = ['-ss', String(args.at), '-i', args.input, '-frames:v', '1', '-q:v', String(args.quality ?? 2)]
    if (args.width) cmd.push('-vf', `scale=${args.width}:-2`)
    cmd.push('-y', out)
    await ffmpeg.exec(cmd)
    return { frames: [out] }
  }

  // ffmpeg's fps filter picks frames evenly when we sample at count/duration.
  // We don't know duration here, so use `-vf fps=N/1` only if count known and
  // let `thumbnail` scale: simpler: use select with frame step via fps filter
  // on a computed duration — fallback: extract via `select` + `fps`.
  // Practical approach: -vf "fps=1, thumbnail" is not what we want; instead we
  // ask ffmpeg for `count` frames using the fps filter with a guessed rate by
  // first probing duration, then fps = count/duration.
  const info = await probeInfo(ffmpeg, args.input)
  const duration = (info.duration as number | undefined) ?? 1
  const fps = Math.min(Math.max(count / Math.max(duration, 0.1), 0.01), 30)

  const outPat = `${outBase}_%03d.jpg`
  const cmd = ['-i', args.input, '-vf', `fps=${fps.toFixed(4)}${args.width ? `,scale=${args.width}:-2` : ''}`, '-q:v', String(args.quality ?? 2), '-y', outPat]
  await ffmpeg.exec(cmd)

  // list generated frames by globbing the FS (runtime-only, not in the types)
  const frames: string[] = []
  const fs = (ffmpeg as unknown as { fs?: { readdir: (d: string) => string[] } }).fs
  if (fs?.readdir) {
    try {
      const all = fs.readdir('/') as unknown as string[]
      const prefix = `${outBase}_`
      for (const f of all) {
        if (f.startsWith(prefix) && f.endsWith('.jpg')) frames.push(f)
      }
    } catch {
      /* fall through to the fallback below */
    }
  }
  if (frames.length === 0) {
    // fallback: scan the names we expect
    for (let i = 1; i <= count; i++) {
      const cand = `${outBase}_${String(i).padStart(3, '0')}.jpg`
      try {
        const _ = await ffmpeg.readFile(cand)
        frames.push(cand)
      } catch {
        break
      }
    }
  }
  return { frames }
}

/* ------------------------------------------------------------------ */
/*  image_compress                                                     */
/* ------------------------------------------------------------------ */

export type ImageCompressArgs = {
  /** Path of the input image in FFmpeg's FS. */
  input: string
  /** JPEG quality 1-31 (lower = smaller/better). Default 5. */
  quality?: number
  /** Max output width (keeps aspect). Default 1280. */
  width?: number
  /** Output file name; defaults to `<stem>_compressed.jpg`. */
  output?: string
}
export type ImageCompressResult = {
  output: string
  /** Output size in bytes. */
  size: number
}

/** Recompress an image to JPEG at a target width/quality to shrink it. */
export async function imageCompress(args: ImageCompressArgs): Promise<ImageCompressResult> {
  const ffmpeg = await getFFmpeg()
  const out = safeOutName(args.output ?? args.input, 'jpg')
  const width = Math.min(Math.max(args.width ?? 1280, 16), 8192)
  await ffmpeg.exec([
    '-i', args.input,
    '-vf', `scale=${width}:-2`,
    '-q:v', String(args.quality ?? 5),
    '-y', out,
  ])
  const data = await readOutput(ffmpeg, out)
  await cleanup(ffmpeg, [out])
  return { output: out, size: data.byteLength }
}

/* ------------------------------------------------------------------ */
/*  video_to_gif                                                       */
/* ------------------------------------------------------------------ */

export type VideoToGifArgs = {
  /** Path of the input video in FFmpeg's FS. */
  input: string
  /** Start time in seconds. Default 0. */
  start?: number
  /** Duration in seconds; omit for the whole clip. */
  duration?: number
  /** Output width (keeps aspect). Default 480. */
  width?: number
  /** FPS of the gif. Default 10. */
  fps?: number
  /** Output file name; defaults to `<stem>.gif`. */
  output?: string
}
export type VideoToGifResult = {
  output: string
  /** Output size in bytes. */
  size: number
}

/** Convert a video clip to an animated GIF (palette-optimized). */
export async function videoToGif(args: VideoToGifArgs): Promise<VideoToGifResult> {
  const ffmpeg = await getFFmpeg()
  const stem = extOf(args.output ?? args.input)
  const out = safeOutName(args.output ?? args.input, stem === 'gif' ? 'gif' : 'gif')
  const width = Math.min(Math.max(args.width ?? 480, 32), 1280)
  const fps = Math.min(Math.max(args.fps ?? 10, 1), 30)

  const pre = `${out}.pal.png`
  const filter = `fps=${fps},scale=${width}:-1:flags=lanczos`
  const inputArgs: string[] = []
  if (args.start !== undefined && args.start > 0) inputArgs.push('-ss', String(args.start))
  if (args.duration !== undefined && args.duration > 0) inputArgs.push('-t', String(args.duration))

  // two-pass palette generation
  await ffmpeg.exec([...inputArgs, '-i', args.input, '-vf', `${filter},palettegen=max_colors=256`, '-y', pre])
  await ffmpeg.exec([...inputArgs, '-i', args.input, '-i', pre, '-lavfi', `${filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`, '-y', out])
  await cleanup(ffmpeg, [pre])
  const data = await readOutput(ffmpeg, out)
  await cleanup(ffmpeg, [out])
  return { output: out, size: data.byteLength }
}
