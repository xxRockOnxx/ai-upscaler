export interface UpscalerStorage {
  framesPath(relativePath?: string): string
  enhancedFramesPath(relativePath?: string): string
}
