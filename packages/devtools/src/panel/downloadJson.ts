/**
 * Download a JSON string as a file in the browser.
 */
export function downloadJson(json: string, prefix: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${prefix}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
