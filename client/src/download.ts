// Saves text the page already has as a file, without a round trip to the server.
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Safari cancels the download if the URL is revoked straight away.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
