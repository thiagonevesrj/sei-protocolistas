const currentBrowser = typeof browser === 'undefined' ? chrome : browser
const manifest = currentBrowser.runtime.getManifest()

document.querySelector('#version').textContent = manifest.version
