# WebRTC IPFS Signaling

This project is a proof of concept to see whether we can use IPFS to do WebRTC signaling obviating the need for a
separate server.

### Goal 1 - Browser to Browser Signaling

Status: **Accomplished**

I currently have debugging turned on so the console logs do show some details. Steps:

Navigate to https://cretz.github.io/webrtc-ipfs-signaling/browser-offer.html. It will update the URL w/ a randm hash.
(Of course, you could navigate to a hand-entered URL hash on a fresh tab). Take the URL given on that page and, in
theory, open it up with the latest Chrome or FF anywhere in the world (that doesn't require TURN). After a few seconds,
the offer/answer will communicate and WebRTC will be connected.

Quick notes:

* It may seem like you need some kind of server to share that URL hash, but that's just an example to make it easier. It
  could be any preshared value, though you'll want it unique and may want to do other forms of authentication once
  connected. E.g. one person could just go to
  https://cretz.github.io/webrtc-ipfs-signaling/browser-offer.html#someknownkey and the other person could just go to
  https://cretz.github.io/webrtc-ipfs-signaling/browser-answer.html#someknownkey
* This works with `file:///` on Chrome and FF too, even across each other or mixed with traditional http pages.
* I have tested on mobile FF on Android and it works gloriously. I haven't tested any other browsers beyond Chrome
  desktop, FF desktop, and FF mobile.
* For this tech demo, I just use Google's public STUN server and no TURN server so if you require TURN this won't work
  for you.
* This uses js-ipfs's pubsub support which is in an experimental state. I even hardcode a swarm to
  https://ws-star.discovery.libp2p.io/. So it probably won't work if this repo goes stale (which it likely will). I'm
  also unsure how it'd hold up to any load.
* js-ipfs is pretty big at > 600k right now.
* You might ask, "Why use WebRTC at all if you have a PubSub connection?" The features of WebRTC are many, in fact with
  the latest Chrome release, I am making a screen sharing tool requiring no local code.
* This is just a tech demo so I took a lot of shortcuts like not supporting restarts, poor error handling, etc. It would
  be quite trivial to have multiple subscribers to a topic and group chat with multiple offer/answer handshakes.
* Security...not much. Essentially you need to do some other form of security (WebRTC peerIdentity? app level ID verify
  once connected? etc). In practice, this is like an open signaling server.

**How it Works**

It's quite simple. Both sides subscribe to a pubsub topic named after the preshared identifier. Then I just send JSON'd
[RTCSessionDescription](https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription)s back and forth.
Specifically, the offer side sends the offer every two seconds until it gets an answer whereas the answer side waits for
an offer then sends an answer.

### Goal 2 - Browser to Native App Signaling

Status: **Failing**

I was pretty sure I could easily hook up [ipfs/go-ipfs](https://github.com/ipfs/go-ipfs) with
[pions/webrtc](https://github.com/pions/webrtc) and be all good. Although `pions/webrtc` is beautifully built, go-ipfs
is not and very much not developer friendly for reading code or embedding. I was forced to use
[ipsn/go-ipfs](https://github.com/ipsn/go-ipfs) which re-best-practicizes the deps. I have the code at
[cli_offer.go](cli_offer.go) and while it looks right, the JS side cannot see the pubsub messages. I have a lot of
annoying debugging to do in that unfriendly codebase.