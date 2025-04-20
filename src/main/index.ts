import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join, sep } from 'node:path'
import * as fs from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import jschardet from 'jschardet'
import iconv from 'iconv-lite'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { csvInfo } from '../renderer/src/typing'

let focusedWindow: BrowserWindow
let windowIndex: number = 0
let windows: BrowserWindow[] = []
let isClosed: boolean = false

let initialFilePath: string
let csvInfoList: csvInfo[] = []

function createWindow(filePath?: string): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  windows.push(mainWindow)
  csvInfoList.push({
    filePath: filePath,
    hasHeader: false
  })
  setMenu()

  mainWindow.on('ready-to-show', () => {
    mainWindow.webContents.send('window-created', windowIndex)
  })

  mainWindow.on('show', () => {
    isClosed = false
  })

  mainWindow.on('focus', () => {
    windowIndex = windows.indexOf(mainWindow)
    focusedWindow = mainWindow
    setMenu()
  })

  mainWindow.on('closed', () => {
    windows.splice(windowIndex, 1)
    csvInfoList.splice(windowIndex, 1)
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  if (process.argv.length >= 2) {
    // ダブルクリックされたファイルのパスを取得
    const filepath = process.argv[1]
    createWindow(filepath)
  } else {
    createWindow()
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  isClosed = true
  windows = []
  csvInfoList = []
  setMenu()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('open-file', (event, path) => {
  event.preventDefault() // デフォルトの処理をキャンセル
  initialFilePath = path

  if (app.isReady()) {
    createWindow(initialFilePath)
  }
})

ipcMain.on('select-csv', () => {
  handleOpenClick()
})

ipcMain.on('dom-rendered', async () => {
  if (initialFilePath) {
    csvInfoList[windowIndex] = await loadCSVFile(initialFilePath)
    renderCSVData()
  }
  initialFilePath = ''
  setMenu()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
function setMenu() {
  Menu.setApplicationMenu(buildMenu())
}

/*
 * @description メニューを組み立てる
 * @param {object} options - メニューのオプション
 * @return {Menu} - メニュー
 */
function buildMenu() {
  const isEathFileMenuEnabled: boolean = !!(
    windows.length &&
    csvInfoList[windowIndex]?.filePath &&
    !isClosed
  )
  return Menu.buildFromTemplate([
    {
      role: 'fileMenu',
      submenu: [
        {
          label: 'ccsvを終了',
          role: 'quit'
        }
      ]
    },
    {
      label: 'ファイル',
      submenu: [
        {
          label: '新しいウィンドウ',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow()
        },
        {
          label: '開く...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenClick()
        },
        {
          label: 'ファイルの情報を見る',
          enabled: isEathFileMenuEnabled,
          click: () => {
            const csvInfo = csvInfoList[windowIndex]
            focusedWindow.webContents.send('show-file-info', {
              title: 'ファイル情報',
              messages: [
                `ファイル名: ${csvInfo.filePath?.split(sep).pop()}`,
                `ファイルサイズ: ${csvInfo.size}バイト`,
                `最終更新日時: ${csvInfo.lastModified?.toLocaleString()}`,
                `文字コード: ${csvInfo.encoding}`,
                `BOM: ${csvInfo.hasBom ? 'あり' : 'なし'}`
              ]
            })
          }
        },
        { type: 'separator' },
        {
          label: 'ウィンドウを閉じる',
          role: 'close'
        }
      ]
    },
    {
      label: 'ウィンドウ',
      submenu: [
        {
          label: 'ズームイン',
          role: 'zoomIn'
        },
        {
          label: 'ズームアウト',
          role: 'zoomOut'
        },
        {
          label: 'ズームリセット',
          role: 'resetZoom'
        }
      ]
    },
    {
      label: 'オプション',
      submenu: [
        {
          label: '先頭行をヘッダーとして表示',
          enabled: isEathFileMenuEnabled,
          type: 'checkbox',
          checked: csvInfoList[windowIndex]?.hasHeader,
          click: handleChangeHeaderClick
        }
      ]
    }
  ])
}

/*
 * @description ファイル選択ダイアログを表示し、選択されたCSVファイルを読み込む
 */
async function handleOpenClick() {
  const result = await dialog.showOpenDialog(focusedWindow, {
    properties: ['openFile'],
    filters: [{ name: 'CSVファイル', extensions: ['csv'] }]
  })
  if (!result.canceled) {
    csvInfoList[windowIndex] = {
      ...csvInfoList[windowIndex],
      ...(await loadCSVFile(result.filePaths[0]))
    }
    renderCSVData()

    setMenu()
  }
}

/*
 * @description ヘッダー行の表示を切り替える
 */
function handleChangeHeaderClick() {
  csvInfoList[windowIndex].hasHeader = !csvInfoList[windowIndex].hasHeader
  renderCSVData()
}

/*
 * @description CSVデータをレンダラープロセスに送信する
 */
function renderCSVData() {
  focusedWindow.webContents.send('render-csv', csvInfoList[windowIndex])
  const fileName =
    csvInfoList[windowIndex].filePath?.split(sep).pop()?.split('.').shift() ?? 'Untitled'
  focusedWindow.setTitle(`${fileName} | ccsv`)
}

/*
 * @description CSVファイルを読み込み、データを返す
 * @param {string} filePath - CSVファイルのパス
 * @return {Promise<any>} - CSVファイルのデータ
 */
async function loadCSVFile(filePath: string): Promise<csvInfo> {
  try {
    // 文字コード指定なしでファイルを読み込む
    const data = await fs.readFile(filePath, { encoding: null })

    // ファイル情報を取得
    const stats = await fs.stat(filePath)
    const fileInfo: csvInfo = {
      size: stats.size,
      lastModified: stats.mtime.toLocaleString(),
      encoding: jschardet.detect(data).encoding,
      hasBom: hasBOM(data)
    }

    const records = await parse(iconv.decode(data, fileInfo.encoding ?? 'utf8'), {
      columns: false, // ヘッダー行をカラム名として使用しない
      bom: true // BOMを無視
    })

    return {
      filePath: filePath,
      data: await extendCSVData(records),
      ...fileInfo
    }
  } catch (error: any) {
    console.error('CSVファイルの読み込みエラー:', error)
    dialog.showErrorBox('エラー', 'CSVファイルの読み込みに失敗しました')
    return {}
  }
}

async function extendCSVData(records: string[][]) {
  const MAX_ROW_SIZE = 1000
  const MAX_COLUMN_SIZE = 100
  const tmpArr: string[][] = []
  // 列を拡張
  records.forEach((columns) => {
    const spareColumnSize = MAX_COLUMN_SIZE - columns.length
    if (spareColumnSize <= 0) {
      tmpArr.push(columns)
      return
    }
    tmpArr.push([...columns, ...new Array(spareColumnSize).fill('')])
  })

  // 行を拡張
  const spareRowSize = MAX_ROW_SIZE - records.length
  if (spareRowSize <= 0) {
    return tmpArr
  }
  return [...tmpArr, ...new Array(spareRowSize).fill(new Array(MAX_COLUMN_SIZE).fill(''))]
}

/*
 * @description バッファにBOMがあるかどうかを判定する
 * @param {Buffer} buffer - バッファ
 * @return {boolean} - BOMがあるかどうか
 */
function hasBOM(buffer: Buffer) {
  // UTF-8 BOM (EF BB BF)
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return true
  }

  // UTF-16LE BOM (FF FE)
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return true
  }

  // UTF-16BE BOM (FE FF)
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return true
  }

  return false
}
