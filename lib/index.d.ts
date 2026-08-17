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
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-video-tools";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
