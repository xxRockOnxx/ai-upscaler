// Turns per-frame progress into an overall percent shared by every enhancer.
// Each processed file = 100% progress.
// 2 out of 4 frames processed is equivalent to:
// = ((2 * 100) + 0) / 4 = 50%
// = 200 / 4 = 50%
export default function computeProgress(totalFiles, processedFiles, currentFile): number {
  return ((processedFiles * 100) + currentFile) / totalFiles;
}
