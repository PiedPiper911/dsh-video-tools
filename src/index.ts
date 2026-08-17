/**
 * dsh-video-tools — browser-local audio/video tools for DeepSeek Harness.
 *
 * Registers four tools on `ctx.tools`:
 *   - video_info      probe duration / resolution / codecs
 *   - video_frames    extract evenly-spaced frames or one frame at a time
 *   - image_compress  recompress an image to JPEG at a target width
 *   - video_to_gif    convert a clip to an animated GIF
 *
 * Everything runs locally in FFmpeg.wasm — no upload, no server.
 *
 * @module dsh-video-tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { videoInfo, videoFrames, imageCompress, videoToGif } from './tools.js'
import type { VideoInfoArgs, VideoInfoResult, VideoFramesArgs, VideoFramesResult, ImageCompressArgs, ImageCompressResult, VideoToGifArgs, VideoToGifResult } from './tools.js'

export const name = 'dsh-video-tools'
export const inject = ['tools']

/** Minimal text render helper for tool results. */
function textBlock(text: string): ContentBlock {
  return { type: 'text', text }
}

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'video_info',
      description: 'Probe a video file for duration, resolution, and codecs without transcoding.',
      parameters: {
        input: { type: 'string', description: 'File name of the video already present in the workspace.', required: true },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [textBlock(JSON.stringify(value, null, 2))],
      },
      async execute(args: VideoInfoArgs): Promise<VideoInfoResult> {
        return videoInfo(args)
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'video_frames',
      description: 'Extract evenly-spaced frames from a video as JPEGs, or a single frame at a given timestamp.',
      parameters: {
        input: { type: 'string', description: 'File name of the video already present in the workspace.', required: true },
        count: { type: 'integer', description: 'Number of frames to extract (1-20, default 1).' },
        at: { type: 'number', description: 'Grab one frame at this second instead of N frames.' },
        quality: { type: 'integer', description: 'JPEG quality 1-31, lower is better (default 2).' },
        width: { type: 'integer', description: 'Output width, keeps aspect ratio.' },
        output: { type: 'string', description: 'Base name for output frames.' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [textBlock(JSON.stringify(value, null, 2))],
      },
      async execute(args: VideoFramesArgs): Promise<VideoFramesResult> {
        return videoFrames(args)
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'image_compress',
      description: 'Recompress an image to JPEG at a target width to reduce size before sending to a vision model.',
      parameters: {
        input: { type: 'string', description: 'File name of the image already present in the workspace.', required: true },
        quality: { type: 'integer', description: 'JPEG quality 1-31, lower is smaller (default 5).' },
        width: { type: 'integer', description: 'Max output width, keeps aspect (default 1280).' },
        output: { type: 'string', description: 'Output file name.' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [textBlock(JSON.stringify(value, null, 2))],
      },
      async execute(args: ImageCompressArgs): Promise<ImageCompressResult> {
        return imageCompress(args)
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'video_to_gif',
      description: 'Convert a video clip to an animated GIF with palette optimization.',
      parameters: {
        input: { type: 'string', description: 'File name of the video already present in the workspace.', required: true },
        start: { type: 'number', description: 'Start time in seconds (default 0).' },
        duration: { type: 'number', description: 'Clip duration in seconds; omit for the whole video.' },
        width: { type: 'integer', description: 'Output width, keeps aspect (default 480).' },
        fps: { type: 'integer', description: 'GIF frame rate (default 10).' },
        output: { type: 'string', description: 'Output file name.' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [textBlock(JSON.stringify(value, null, 2))],
      },
      async execute(args: VideoToGifArgs): Promise<VideoToGifResult> {
        return videoToGif(args)
      },
    }),
  )
}
