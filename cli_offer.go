package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/ipsn/go-ipfs/core"
	"github.com/ipsn/go-ipfs/core/coreapi"
	coreiface "github.com/ipsn/go-ipfs/core/coreapi/interface"
	"github.com/ipsn/go-ipfs/core/coreapi/interface/options"
	"github.com/pions/webrtc"
	"github.com/pions/webrtc/pkg/datachannel"
	"github.com/pions/webrtc/pkg/ice"
)

var debugEnabled = true

func main() {
	ctx, cancelFn := context.WithCancel(context.Background())
	defer cancelFn()
	// Get ID
	id, err := parseFlags()
	assertNoErr(err)
	fmt.Printf("Visit browser-answer.html#%v or go run cli_answer.go %v\n", id, id)
	// Create IPFS
	pubsub, err := newIPFSPubSub(ctx)
	assertNoErr(err)
	// Create peer conn
	pc, err := webrtc.New(webrtc.RTCConfiguration{
		IceServers: []webrtc.RTCIceServer{{URLs: []string{"stun:stun.l.google.com:19302"}}},
	})
	assertNoErr(err)
	// Create the chat channel
	channel, err := pc.CreateDataChannel("chat", nil)
	assertNoErr(err)
	setupChatChannel(channel)
	// Debug state change info
	pc.OnICEConnectionStateChange(func(state ice.ConnectionState) {
		debugf("RTC connection state change: %v", state)
	})
	// Subscribe to offer/answer topic
	topic := "wis-poc-" + id
	sub, err := pubsub.Subscribe(ctx, topic, options.PubSub.Discover(true))
	assertNoErr(err)
	debugf("Subscribe to %v complete", topic)
	// Listen for first answer
	answerCh := make(chan *webrtc.RTCSessionDescription, 1)
	go func() {
		var desc webrtc.RTCSessionDescription
		for {
			msg, err := sub.Next(ctx)
			assertNoErr(err)
			assertNoErr(json.Unmarshal(msg.Data(), &desc))
			debugf("Received data: %v", desc.Type)
			if desc.Type == webrtc.RTCSdpTypeAnswer {
				answerCh <- &desc
				break
			}
		}
	}()
	// Create the offer and keep sending until received
	offer, err := pc.CreateOffer(nil)
	assertNoErr(err)
	offerBytes, err := json.Marshal(offer)
	assertNoErr(err)
	var answer *webrtc.RTCSessionDescription
WaitForAnswer:
	for {
		debugf("Sending offer")
		assertNoErr(pubsub.Publish(ctx, topic, offerBytes))
		select {
		case answer = <-answerCh:
			fmt.Printf("Got answer")
			break WaitForAnswer
		case <-time.After(2 * time.Second):
		}
	}
	// Now that we have an answer, set it and block forever (the chat channel does the work now)
	assertNoErr(pc.SetRemoteDescription(*answer))
	select {}
}

func newIPFSPubSub(ctx context.Context) (coreiface.PubSubAPI, error) {
	cfg := &core.BuildCfg{
		Online:    true,
		ExtraOpts: map[string]bool{"pubsub": true},
	}
	if node, err := core.NewNode(ctx, cfg); err != nil {
		return nil, err
	} else if api, err := coreapi.NewCoreAPI(node); err != nil {
		return nil, err
	} else {
		return api.PubSub(), nil
	}
}

func setupChatChannel(channel *webrtc.RTCDataChannel) {
	channel.OnClose(func() { printChatLn("**system** chat closed") })
	channel.OnOpen(func() {
		printChatLn("**system** chat started")
		// Just read stdin forever and try to send it over or panic
		r := bufio.NewReader(os.Stdin)
		for {
			text, _ := r.ReadString('\n')
			printChatLn("**me** " + text)
			err := channel.Send(datachannel.PayloadString{Data: []byte(text)})
			assertNoErr(err)
		}
	})
	channel.OnMessage(func(p datachannel.Payload) {
		if p.PayloadType() != datachannel.PayloadTypeString {
			panic("Expected string payload")
		}
		printChatLn("**them** " + string(p.(datachannel.PayloadString).Data))
	})
}

var chatLnMutex sync.Mutex

func printChatLn(line string) {
	chatLnMutex.Lock()
	defer chatLnMutex.Unlock()
	fmt.Println(line)
}

func parseFlags() (id string, err error) {
	fs := flag.NewFlagSet("", flag.ExitOnError)
	fs.BoolVar(&debugEnabled, "v", false, "Show debug information")
	fs.StringVar(&id, "id", "", "The identifier to put offer for (optional, generated when not present)")
	assertNoErr(fs.Parse(os.Args[1:]))
	if fs.NArg() > 0 {
		return "", fmt.Errorf("Unrecognized args: %v", fs.Args())
	}
	// Generate ID if not there
	if id == "" {
		const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
		var idBytes [20]byte
		if _, err := rand.Read(idBytes[:]); err == nil {
			for _, idByte := range idBytes {
				id += string(base58Chars[int(idByte)%len(base58Chars)])
			}
		}
	}
	return
}

func debugf(format string, v ...interface{}) {
	if debugEnabled {
		log.Printf(format, v...)
	}
}

func assertNoErr(err error) {
	if err != nil {
		panic(err)
	}
}
