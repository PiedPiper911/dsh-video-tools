/**
 * Tool implementations for dsh-video-tools.
 *
 * Each tool follows the DSH `defineTool` contract:
 *   name / description / parameters / output.schema / execute
 * Arguments arrive typed and validated; results must satisfy output.schema.
 *
 * @module tools
 */
export type VideoInfoArgs = {
    /** Local file name (must already exist in FFmpeg's FS via a prior step). */
    input: string;
};
export type VideoInfoResult = {
    duration?: number;
    width?: number;
    height?: number;
    video_codec?: string;
    audio_codec?: string;
    /** Truncated raw probe text for debugging. */
    raw: string;
};
/** Probe a video's metadata without transcoding. */
export declare function videoInfo(args: VideoInfoArgs): Promise<VideoInfoResult>;
export type VideoFramesArgs = {
    /** Path of the uploaded video in FFmpeg's FS. */
    input: string;
    /** Number of frames to extract, evenly spread across the duration. */
    count?: number;
    /** Optional time (seconds) to grab a single frame at instead of N frames. */
    at?: number;
    /** JPEG quality 1-31 (lower = better). Default 2. */
    quality?: number;
    /** Output width (maintains aspect ratio); omit for original size. */
    width?: number;
    /** Base name for output frames (defaults to input stem). */
    output?: string;
};
export type VideoFramesResult = {
    /** Generated frame file names inside FFmpeg's FS. */
    frames: string[];
};
/** Extract evenly-spaced frames (or one frame at a timestamp) from a video. */
export declare function videoFrames(args: VideoFramesArgs): Promise<VideoFramesResult>;
export type ImageCompressArgs = {
    /** Path of the input image in FFmpeg's FS. */
    input: string;
    /** JPEG quality 1-31 (lower = smaller/better). Default 5. */
    quality?: number;
    /** Max output width (keeps aspect). Default 1280. */
    width?: number;
    /** Output file name; defaults to `<stem>_compressed.jpg`. */
    output?: string;
};
export type ImageCompressResult = {
    output: string;
    /** Output size in bytes. */
    size: number;
};
/** Recompress an image to JPEG at a target width/quality to shrink it. */
export declare function imageCompress(args: ImageCompressArgs): Promise<ImageCompressResult>;
export type VideoToGifArgs = {
    /** Path of the input video in FFmpeg's FS. */
    input: string;
    /** Start time in seconds. Default 0. */
    start?: number;
    /** Duration in seconds; omit for the whole clip. */
    duration?: number;
    /** Output width (keeps aspect). Default 480. */
    width?: number;
    /** FPS of the gif. Default 10. */
    fps?: number;
    /** Output file name; defaults to `<stem>.gif`. */
    output?: string;
};
export type VideoToGifResult = {
    output: string;
    /** Output size in bytes. */
    size: number;
};
/** Convert a video clip to an animated GIF (palette-optimized). */
export declare function videoToGif(args: VideoToGifArgs): Promise<VideoToGifResult>;
