
const debug = console.log
// const debug = () => { }

function createWindowHashIfNotPresent() {
  if (window.location.hash) return
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let array = new Uint8Array(20)
  window.crypto.getRandomValues(array);
  array = array.map(x => base58Chars.charCodeAt(x % base58Chars.length));
  window.history.replaceState(null, null, '#' + String.fromCharCode.apply(null, array))
}

function newIPFS(cb) {
  const ipfs = new Ipfs({
    repo: String(Math.random() + Date.now()),
    EXPERIMENTAL: { pubsub: true },
    config: {
      Addresses: {
        Swarm: ['/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star']
      }
    }
    // libp2p: {
    //   config: {
    //     dht: {
    //       enabled: true
    //     }
    //   }
    // }
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
  return 'wis-poc-' + window.location.hash.substring(1)
}

function ipfsSubscribe(ipfs, handle, cb) {
  ipfs.pubsub.subscribe(
    ipfsDirBase(),
    msg => handle(msg.data.toString('utf8')),
    err => {
      if (err) console.error('Failed subscribe', err)
      else {
        debug('Subscribe to ' + ipfsDirBase() + ' complete')
        cb()
      }
    })
}

function ipfsPublish(ipfs, data, cb) {
  ipfs.pubsub.publish(
    ipfsDirBase(),
    ipfs.types.Buffer.from(data),
    err => {
      if (err) console.error('Failed publish', err)
      else {
        debug('Publish complete')
        cb()
      }
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