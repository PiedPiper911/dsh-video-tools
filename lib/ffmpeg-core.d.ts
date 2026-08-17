/**
 * FFmpeg.wasm lazy singleton with progress reporting.
 *
 * Loading the 30MB+ wasm core on demand is the single biggest perf decision
 * in this plugin: we never touch it until the first tool actually runs, and we
 * reuse one instance across calls so the core loads exactly once per session.
 *
 * @module ffmpeg-core
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
export type ProgressReport = {
    /** 0..1 fraction of the current operation. */
    progress: number;
    /** Human-readable ffmpeg status line, when available. */
    message?: string;
};
export declare function isLoaded(): boolean;
/**
 * Get (and lazily bootstrap) the shared FFmpeg instance.
 * @param onProgress - optional callback for load + run progress.
 */
export declare function getFFmpeg(onProgress?: (p: ProgressReport) => void): Promise<FFmpeg>;
/** Read a local file (File / Blob) into FFmpeg's in-memory FS under a name. */
export declare function writeInput(ffmpeg: FFmpeg, file: File | Blob, name: string): Promise<void>;
/** Read an output file back out of FFmpeg's FS as a Uint8Array. */
export declare function readOutput(ffmpeg: FFmpeg, name: string): Promise<Uint8Array>;
/** Delete a file from the in-memory FS if present (best-effort cleanup). */
export declare function cleanup(ffmpeg: FFmpeg, names: string[]): Promise<void>;
/** Default output extension from a media path, lowercased without the dot. */
export declare function extOf(path: string): string;
/** Sanitize an output name so it can never escape the in-memory FS. */
export declare function safeOutName(base: string, ext: string): string;
