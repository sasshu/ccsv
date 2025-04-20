export type dialogContents = {
  icon?: string
  title?: string
  messages?: string[]
}

export type csvInfo = {
  filePath?: string
  data?: string[][]
  hasHeader?: boolean
  size?: number
  lastModified?: string
  encoding?: string
  hasBom?: boolean
}
