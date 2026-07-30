const currentBrowser = typeof browser === 'undefined' ? chrome : browser
const manifest = currentBrowser.runtime.getManifest()

document.querySelector('#version').textContent = manifest.version

document.querySelector('#open-central').addEventListener('click', () => {
  currentBrowser.tabs.create({
    url: currentBrowser.runtime.getURL('central_protocolista/index.html')
  })
})
