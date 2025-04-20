import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  sendDOMRendered: () => ipcRenderer.send('dom-rendered'),
  selectCSV: () => ipcRenderer.send('select-csv'),

  windowCreated: (callback: any) =>
    ipcRenderer.on('window-created', (_event, index) => callback(index)),
  renderCSV: (callback: any) => ipcRenderer.on('render-csv', (_event, value) => callback(value)),
  showFileInfo: (callback: any) =>
    ipcRenderer.on('show-file-info', (_event, value) => callback(value))
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
