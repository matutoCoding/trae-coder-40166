export {}

declare global {
  interface Window {
    electronAPI: {
      openAudioDialog: () => Promise<{
        canceled: boolean
        filePaths: string[]
      }>
      openFolderDialog: () => Promise<{
        canceled: boolean
        filePaths: string[]
      }>
      showOpenFileDialog: (options: {
        title?: string
        filters?: { name: string; extensions: string[] }[]
      }) => Promise<{
        canceled: boolean
        filePaths: string[]
      }>
      showSaveDialog: (options: {
        title?: string
        defaultPath?: string
        filters?: { name: string; extensions: string[] }[]
      }) => Promise<{
        canceled: boolean
        filePath?: string
      }>
      setState: (key: string, value: unknown) => void
      getState: () => Record<string, unknown>
      onStateUpdated: (callback: (state: Record<string, unknown>) => void) => () => void
      openWindow: (name: string) => void
      closeWindow: (name: string) => void
      writeFile: (filePath: string, content: string, encoding?: BufferEncoding) => Promise<{ success: boolean; error?: string }>
      readFile: (filePath: string, encoding?: BufferEncoding) => Promise<{ success: boolean; content?: string; error?: string }>
      getAudioDuration: (filePath: string) => Promise<{ success: boolean; duration: number; size: number; error?: string }>
      pathToAudioUrl: (filePath: string) => Promise<string>
    }
  }
}
