
function createWindowHashIfNotPresent() {
  if (window.location.hash) return
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let array = new Uint8Array(40)
  window.crypto.getRandomValues(array);
  array = array.map(x => base58Chars.charCodeAt(x % base58Chars.length));
  window.history.replaceState(null, null, '#' + String.fromCharCode.apply(null, array))
}

function ipfsDirBase() {
  return window.location.hash.substring(1)
}

function writeIPFSFile(ipfs, file, content, cb) {
  const path = '/' + ipfsDirBase() + '/' + file
  const buf = ipfs.types.Buffer.from(content)
  ipfs.files.write(path, buf, { create: true, truncate: true, parents: true}).then(() => {
    console.log('Wrote to ' + path)
    cb()
  }).catch(console.error)
}

function waitForIPFSFile(ipfs, file, cb) {
  const path = '/' + ipfsDirBase() + '/' + file
  ipfs.files.read(path, (err, buf) => {
    if (err) {
      if (!err.message || !err.message.endsWith(file + ' does not exist')) throw err
      setTimeout(() => waitForIPFSFile(ipfs, file, cb), 2000)
    } else cb(buf.toString('utf8'))
  })
}

function setupChatChannel(channel) {
  const areaElem = document.getElementById('chat')
  const messageElem = document.getElementById('message')

  channel.onclose = () => areaElem.value += "**system** chat closed\n"
  channel.onopen = () => {
    messageElem.disabled = false
    areaElem.value += "**system** chat started\n"
  }
  channel.onmessage = e => areaElem.value += '**them** ' + e.data + "\n"

  messageElem.onkeypress = e => {
    const message = messageElem.value
    if (e.keyCode == 13 && message) {
      messageElem.value = ''
      areaElem.value += '**me** ' + message + "\n"
      channel.send(message)
    }
  }
}