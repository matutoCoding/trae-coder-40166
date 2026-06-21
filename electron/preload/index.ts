import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openAudioDialog: () => ipcRenderer.invoke('dialog:openAudio'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  showSaveDialog: (options: Electron.SaveDialogOptions) => ipcRenderer.invoke('dialog:save', options),
  setState: (key: string, value: unknown) => ipcRenderer.send('state:set', key, value),
  getState: () => ipcRenderer.sendSync('state:get'),
  onStateUpdated: (callback: (state: Record<string, unknown>) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, state: Record<string, unknown>) => callback(state)
    ipcRenderer.on('state:updated', listener)
    return () => ipcRenderer.removeListener('state:updated', listener)
  },
  openWindow: (name: string) => ipcRenderer.send('window:open', name),
  closeWindow: (name: string) => ipcRenderer.send('window:close', name),
  writeFile: (filePath: string, content: string, encoding?: BufferEncoding) =>
    ipcRenderer.invoke('fs:writeFile', filePath, content, encoding),
  getAudioDuration: (filePath: string) => ipcRenderer.invoke('fs:getAudioDuration', filePath),
  pathToAudioUrl: (filePath: string) => ipcRenderer.invoke('fs:pathToAudioUrl', filePath)
})
