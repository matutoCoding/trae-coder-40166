import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openAudioDialog: () => ipcRenderer.invoke('dialog:openAudio'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  showSaveDialog: (options: Electron.SaveDialogOptions) => ipcRenderer.invoke('dialog:save', options),
  setState: (key: string, value: unknown) => ipcRenderer.send('state:set', key, value),
  getState: () => ipcRenderer.sendSync('state:get'),
  onStateUpdated: (callback: (state: Record<string, unknown>) => void) => {
    ipcRenderer.on('state:updated', (_e, state) => callback(state))
  },
  openWindow: (name: string) => ipcRenderer.send('window:open', name),
  closeWindow: (name: string) => ipcRenderer.send('window:close', name)
})
