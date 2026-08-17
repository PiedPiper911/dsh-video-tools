# dsh-video-tools 🎬

Browser-local audio/video tools for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH), powered by [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).

No uploads, no servers — every operation runs in your browser via WebAssembly.

## Install

```sh
dsh plugin add @piedpiper911/dsh-video-tools
```

## Tools

| Tool | What it does |
|---|---|
| `video_info` | Probe a video's duration, resolution, and codecs without transcoding. |
| `video_frames` | Extract evenly-spaced frames as JPEGs, or a single frame at a timestamp. |
| `image_compress` | Recompress an image to JPEG at a target width to shrink it for vision models. |
| `video_to_gif` | Convert a video clip to an animated GIF (two-pass palette optimization). |

### Example: give a vision model frames from a local video

```
1. upload the video → workspace
2. video_frames { input: "demo.mp4", count: 4 }
3. describe what you see in each frame
```

## How it works

- One shared `FFmpeg` instance is **lazily loaded** on first use and reused for the
  whole session — the ~30 MB core downloads exactly once.
- All I/O happens in FFmpeg's in-memory virtual filesystem; nothing touches disk.
- Tool arguments are validated with the DSH schema DSL (`defineTool`), so the
  model only ever sees well-formed inputs.

## Development

```sh
npm ci
npm run build      # tsc → lib/
npm test           # vitest
```

## License

MIT
