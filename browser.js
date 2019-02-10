
const debug = console.log

function createWindowHashIfNotPresent() {
  if (window.location.hash) return
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let array = new Uint8Array(40)
  window.crypto.getRandomValues(array);
  array = array.map(x => base58Chars.charCodeAt(x % base58Chars.length));
  window.history.replaceState(null, null, '#' + String.fromCharCode.apply(null, array))
}

function newIPFS(cb) {
  const ipfs = new Ipfs({
    // repo: String(Math.random() + Date.now()),
    // libp2p: {
    //   config: {
    //     dht: {
    //       enabled: true
    //     }
    //   }
    // },
    // relay: {
    //   enabled: true,
    //   hop: {enabled: true}
    // }
  })
  // Wait for peers
  ipfs.on('ready', () => {
    const tryListPeers = () => {
      ipfs.swarm.peers((err, peers) => {
        if (err) throw err
        debug('Peers', peers)
        if (!peers || peers.length == 0) setTimeout(() => tryListPeers(), 1000)
        else cb(ipfs)
      })
    }
    tryListPeers()
  })
}

function ipfsDirBase() {
  return window.location.hash.substring(1)
}

function writeIPFSFile(ipfs, file, content, cb) {
  const path = '/' + ipfsDirBase() + '/' + file
  const buf = ipfs.types.Buffer.from(content)
  debug('Writing to ' + path)
  writeIPFSFileMFS(ipfs, path, buf, cb)
  // writeIPFSFileDHT(ipfs, path, buf, cb)
}

function writeIPFSFileMFS(ipfs, path, buf, cb) {
  ipfs.files.write(path, buf, { create: true, truncate: true, parents: true}).then(() => {
    console.log('Wrote to ' + path)
    cb()
  }).catch(console.error)
}

function writeIPFSFileDHT(ipfs, path, buf, cb) {
  ipfs.dht.put(ipfs.types.Buffer.from(path), buf, (err) => {
    if (err) throw err
    console.log('Wrote to ' + path)
    cb()
  })
}

function waitForIPFSFile(ipfs, file, cb) {
  const path = '/' + ipfsDirBase() + '/' + file
  debug('Attempting to read from ' + path)
  waitForIPFSFileMFS(ipfs, path, cb)
  // waitForIPFSFileDHT(ipfs, path, cb)
}

function waitForIPFSFileMFS(ipfs, path, cb) {
  ipfs.files.read(path, (err, buf) => {
    if (err) {
      debug('Failed reading', err.message)
      if (!err.message || !err.message.endsWith(path + ' does not exist')) throw err
      setTimeout(() => waitForIPFSFileMFS(ipfs, path, cb), 2000)
    } else cb(buf.toString('utf8'))
  })
}

function waitForIPFSFileDHT(ipfs, path, cb) {
  ipfs.dht.get(ipfs.types.Buffer.from(path), (err, value) => {
    if (err) {
      debug('Failed reading', err.message)
      setTimeout(() => waitForIPFSFileDHT(ipfs, path, cb), 2000)
    } else cb(value.toString('utf8'))
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