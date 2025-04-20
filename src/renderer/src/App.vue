<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Ref } from 'vue'

import Handsontable from 'handsontable'
import { registerLanguageDictionary, jaJP } from 'handsontable/i18n'
import 'handsontable/styles/handsontable.min.css'
import 'handsontable/styles/ht-theme-main.min.css'
// import { HotTable } from '@handsontable/vue3'
import { registerAllModules } from 'handsontable/registry'
import { GridSettings } from 'handsontable/settings'
import { dialogContents, csvInfo } from './typing'

registerAllModules()
registerLanguageDictionary(jaJP)

const windowIndex: Ref<number> = ref(0)

const table: Ref<HTMLElement | null> = ref(null)
const hot: Ref<Handsontable | null> = ref(null)
const csvData: Ref<string[][]> = ref([])
const isFirstRowHeader: Ref<boolean> = ref(false)

const fileInfo: Ref<dialogContents> = ref({})
const dialog: Ref<HTMLDialogElement | null> = ref(null)

onMounted(() => {
  window.api.sendDOMRendered()
})

window.api.windowCreated((index: number) => {
  windowIndex.value = index
})

window.api.renderCSV(async (fileInfo: csvInfo) => {
  csvData.value = fileInfo.data ?? []
  isFirstRowHeader.value = fileInfo.hasHeader ?? false
  await createTable()
  dialog.value?.close()
})

window.api.showFileInfo(async (content: dialogContents) => {
  fileInfo.value = content
  dialog.value?.showModal()
})

const createTable = async (): Promise<void> => {
  if (!table.value) {
    return
  }
  hot.value?.destroy()
  hot.value = new Handsontable(table.value, await buildTableOptions())
}

const buildTableOptions = async (): Promise<GridSettings> => {
  return {
    data: isFirstRowHeader.value ? csvData.value.slice(1) : csvData.value,
    columns: isFirstRowHeader.value
      ? [
          ...csvData.value[0].map((header, index) => {
            return { title: header ? header : `(${(index + 1).toString()})` }
          })
        ]
      : [
          ...csvData.value[0].map((_, index) => {
            return { title: (index + 1).toString() }
          })
        ],
    rowHeaders: true,
    colHeaders: true,
    autoWrapRow: true,
    autoWrapCol: true,
    licenseKey: 'non-commercial-and-evaluation',
    language: 'ja-JP',
    locale: 'ja-JP',
    readOnly: true,
    readOnlyCellClassName: 'ht-read-only',
    bindRowsWithHeaders: 'strict',
    manualColumnResize: true,
    manualRowResize: true,
    columnSorting: true,
    filters: true,
    dropdownMenu: [
      // "alignment",
      // "---------",
      'filter_by_condition',
      'filter_by_value',
      'filter_action_bar'
    ]
  }
}

const selectCSV = (): void => {
  window.api.selectCSV()
}

const scrollLeft = (): void => {
  window.scrollBy({ left: -150, behavior: 'smooth' })
}

const scrollRight = (): void => {
  window.scrollBy({ left: 150, behavior: 'smooth' })
}
</script>

<template>
  <div v-show="csvData.length" class="table-container">
    <div ref="table" class="table ht-theme-main"></div>
    <div class="table-optionbar">
      <div class="scroll-menu">
        <button @click="scrollLeft()"><</button>
        <button @click="scrollRight()">></button>
      </div>
    </div>
  </div>
  <div v-if="!csvData.length" class="no-data">
    <div class="file-select">
      <p>ファイルを選択してください</p>
      <button @click="selectCSV()">選択...</button>
    </div>
  </div>

  <dialog ref="dialog">
    <h1 class="dialog-title">{{ fileInfo.title }}</h1>
    <ul class="dialog-message">
      <li v-for="message in fileInfo.messages">
        {{ message }}
      </li>
    </ul>
    <div class="dialog-button-wrapper">
      <button @click="dialog?.close()">閉じる</button>
    </div>
  </dialog>
</template>
<style lang="scss" scoped>
.table-container {
  margin-bottom: 40px;
}
.table-optionbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background-color: #bfc5ca;
  z-index: 1000;
  overflow: hidden;
}
.scroll-menu {
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: flex-end;
  height: 40px;
  margin-right: 10px;
  button {
    background-color: #bfc5ca;
    font-weight: 600;
    border: none;
    outline: none;
    padding: 0.6rem;
  }
}
// .scroll-menu button {
//   background-color: #bfc5ca;
//   font-weight: 600;
//   border: none;
//   outline: none;
//   padding: 0.6rem;
// }
.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}
.file-select {
  text-align: center;
}
dialog {
  width: 400px;
  border-radius: 10px;
  border: solid 2px #949593;
}
.dialog-title {
  /* font-weight: bold; */
  font-size: 20px;
}
.dialog-message {
  padding: 0 30px;
  li {
    padding-top: 0.6rem;
    border-bottom: solid 0.5px #ddd;
    list-style: inside;
    list-style-type: '■ ';
  }
}
// .dialog-message li {
//   padding-top: 0.6rem;
//   border-bottom: solid 0.5px #ddd;
//   list-style: inside;
//   list-style-type: '■ ';
// }
.dialog-button-wrapper {
  text-align: center;
  button {
    width: calc(100% - 45px);
  }
}
// .dialog-button-wrapper button {
//   width: calc(100% - 45px);
// }
</style>
