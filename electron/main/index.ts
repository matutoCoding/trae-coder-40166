import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let importWin: BrowserWindow | null = null
let diarizationWin: BrowserWindow | null = null
let reviewWin: BrowserWindow | null = null

const sharedState: Record<string, unknown> = {}

function createWindow(page: string, title: string, width = 1100, height = 750): BrowserWindow {
  const win = new BrowserWindow({
    width,
    height,
    title,
    icon: path.join(process.env.VITE_PUBLIC || '', 'favicon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: true,
      contextIsolation: true
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(`${VITE_DEV_SERVER_URL}#${page}`)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: page })
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

function createImportWindow() {
  if (!importWin) {
    importWin = createWindow('/import', '录音导入 - 会议取证转写工具')
    importWin.on('closed', () => { importWin = null })
  }
  importWin.focus()
}

function createDiarizationWindow() {
  if (!diarizationWin) {
    diarizationWin = createWindow('/diarization', '声纹分轨 - 会议取证转写工具', 1280, 800)
    diarizationWin.on('closed', () => { diarizationWin = null })
  }
  diarizationWin.focus()
}

function createReviewWindow() {
  if (!reviewWin) {
    reviewWin = createWindow('/review', '审阅封存 - 会议取证转写工具', 1280, 820)
    reviewWin.on('closed', () => { reviewWin = null })
  }
  reviewWin.focus()
}

function broadcastState() {
  const allWindows = [importWin, diarizationWin, reviewWin].filter(Boolean) as BrowserWindow[]
  allWindows.forEach(w => {
    w.webContents.send('state:updated', sharedState)
  })
}

app.whenReady().then(() => {
  ipcMain.handle('dialog:openAudio', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '音频文件', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    return result
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result
  })

  ipcMain.handle('dialog:save', async (_e, options) => {
    const result = await dialog.showSaveDialog(options as Electron.SaveDialogOptions)
    return result
  })

  ipcMain.on('state:set', (_e, key, value) => {
    sharedState[key] = value
    broadcastState()
  })

  ipcMain.on('state:get', (e) => {
    e.returnValue = sharedState
  })

  ipcMain.on('window:open', (_e, windowName) => {
    switch (windowName) {
      case 'import': createImportWindow(); break
      case 'diarization': createDiarizationWindow(); break
      case 'review': createReviewWindow(); break
    }
  })

  ipcMain.on('window:close', (_e, windowName) => {
    switch (windowName) {
      case 'import': importWin?.close(); break
      case 'diarization': diarizationWin?.close(); break
      case 'review': reviewWin?.close(); break
    }
  })

  createImportWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createImportWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
