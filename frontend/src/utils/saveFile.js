/**
 * 将文件保存到用户选择的位置。
 *
 * 优先使用 File System Access API(window.showSaveFilePicker):
 * 点击导出后立即弹出系统保存对话框,用户确认路径后才开始写入,
 * 可以精确感知「已保存 / 已取消」,因此「导出成功」提示时机准确。
 * 浏览器不支持该 API 时,降级为传统的锚点下载。
 *
 * @param {string} suggestedName 建议的文件名(含扩展名)
 * @param {() => Promise<Blob | ArrayBuffer | null>} getContent
 *        在用户选择保存位置之后调用的异步函数,返回文件内容;
 *        返回 null 表示没有数据可导出(不会在磁盘上创建文件)。
 * @returns {Promise<'saved' | 'fallback' | 'cancelled' | 'no-data'>}
 *          saved:已写入磁盘;fallback:锚点下载已触发;
 *          cancelled:用户取消保存;no-data:没有数据可导出
 */
export async function saveFile(suggestedName, getContent) {
  // 新方案:File System Access API
  if (window.showSaveFilePicker) {
    let handle
    try {
      handle = await window.showSaveFilePicker({ suggestedName })
    } catch {
      // 用户取消保存对话框
      return 'cancelled'
    }

    const content = await getContent()
    if (content == null) return 'no-data'

    const writable = await handle.createWritable()
    try {
      await writable.write(content)
    } finally {
      await writable.close()
    }
    return 'saved'
  }

  // 降级方案:锚点下载
  const content = await getContent()
  if (content == null) return 'no-data'
  const blob = content instanceof Blob ? content : new Blob([content])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  a.click()
  // 延迟释放 blob URL,避免浏览器拦截下载时 URL 已被回收导致下载失败
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'fallback'
}
