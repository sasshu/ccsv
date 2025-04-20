import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      sendDOMRendered(): void
      selectCSV: () => void
      windowCreated: (callback: (value: number) => void) => void
      renderCSV: (callback: (value: csvInfo) => void) => void
      showFileInfo: (callback: (value: dialogContents) => void) => void
    }
  }
}
