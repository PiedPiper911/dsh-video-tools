# Examples

```ts
// 在 DSH 对话里直接让 agent 调用：
await tools.videoInfo({ path: 'clip.mp4' })
await tools.videoFrames({ path: 'clip.mp4', count: 4 })
await tools.imageCompress({ path: 'photo.png', quality: 70 })
await tools.videoToGif({ path: 'clip.mp4', fps: 10, width: 480 })
```
