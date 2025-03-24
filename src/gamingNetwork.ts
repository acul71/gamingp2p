import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { webRTC } from '@libp2p/webrtc'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { bootstrap } from '@libp2p/bootstrap'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { PUBSUB_PEER_DISCOVERY } from './constants.js'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

export interface GamingNetworkOptions {
  // A list of bootstrap multiaddrs for initial discovery
  bootstrapList: string[]
  // Optional add listen multiaddrs (defaults to ['/p2p-circuit', '/webrtc'])
  listenMultiaddrs?: string[]
}

export class GamingNetwork {
  private _libp2p: any
  private connectedPeers: Set<string> = new Set()

  constructor(private options: GamingNetworkOptions) {}

  // Add a getter for the libp2p instance
  get libp2p(): any {
    return this._libp2p;
  }

  async start(): Promise<void> {
    this._libp2p = await createLibp2p({
      addresses: {
        // Listen for WebRTC connections by default, can be overridden via options.
        listen: [
          ...(this.options.listenMultiaddrs || []),
          // make a reservation on any discovered relays - this will let other
          // peers use the relay to contact us
          '/p2p-circuit',
          // create listeners for incoming WebRTC connection attempts on all
          // available Circuit Relay connections
          '/webrtc'
        ]
      },
      transports: [
        // Allow WebSocket connections (useful for testing without TLS)
        webSockets({
          // this allows non-secure WebSocket connections for purposes of the demo
          // filter: filters.all
        }),
        // WebTransport for low-latency data transport (supported except in Safari)
        webTransport(),
        // Standard WebRTC for peer-to-peer connectivity
        webRTC(),
        // Circuit relay transport for NAT traversal
        circuitRelayTransport()
      ],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      connectionGater: {
        // For local testing, allow private addresses.
        denyDialMultiaddr: async () => false
      },
      peerDiscovery: [
        // Bootstrap discovery using known multiaddrs (e.g., your relay node)
        bootstrap({
          list: this.options.bootstrapList
        }),
        // Pubsub discovery: publish our multiaddrs every 10 seconds on a common topic
        pubsubPeerDiscovery({
          interval: 10_000,
          topics: [PUBSUB_PEER_DISCOVERY]
        })
      ],
      services: {
        // Use GossipSub for pub/sub messaging
        pubsub: gossipsub(),
        // Identify service to exchange peer metadata
        identify: identify(),
        ping: ping()
      }
    })

    this._libp2p.addEventListener('peer:connect', (event) => {
      const peerId = event.detail?.id?.toString() || 'unknown'
      console.log(`Peer connected: ${peerId}`)
      this.connectedPeers.add(peerId)
    })

    this._libp2p.addEventListener('peer:disconnect', (event) => {
      const peerId = event.detail?.id?.toString() || 'unknown'
      console.log(`Peer disconnected: ${peerId}`)
      this.connectedPeers.delete(peerId)
    })

    await this._libp2p.start()
    console.log('GamingNetwork started. Peer ID:', this._libp2p.peerId.toString())
  }

  // Publish a message on a given topic
  async publish(topic: string, data: any): Promise<boolean> {
    const message = uint8ArrayFromString(JSON.stringify(data))
    const peers = this._libp2p.services.pubsub.getSubscribers(topic)

    if (peers.length === 0) {
      console.log(`No peers subscribed to topic: ${topic}. Message not sent.`)
      return false
    }

    await this._libp2p.services.pubsub.publish(topic, message);
    console.log(`Message published to topic: ${topic}`)
    return true;
  }

  // Subscribe to a topic with a message handler
  subscribe(topic: string, handler: (msg: any) => void): void {
    console.log(`Subscribing to topic: ${topic}`)
    this._libp2p.services.pubsub.subscribe(topic)

    this._libp2p.services.pubsub.addEventListener('message', (evt) => {
      if (evt.detail.topic === topic) {
        console.log(`Received message on topic: ${topic}`)
        
        // Log the data, topic, and from fields from the event, with only the first 10 elements of data
        console.log(`Topic: ${evt.detail.topic}, From: ${evt.detail.from.toString()}, Data: ${Array.from(evt.detail.data.slice(0, 10))}`)

        const message = uint8ArrayToString(evt.detail.data)
        try {
          const parsedMessage = JSON.parse(message)
          handler(parsedMessage)
        } catch (error) {
          console.error('Failed to parse message')
        }
      }
    })
  }

  // Expose a method to retrieve current connections
  getConnections(): any[] {
    // This returns an array of connection objects.
    // Each connection typically has a remotePeer property (among other metadata).
    return this._libp2p.getConnections() || []
  }

  // Returns the number of connected peers
  getConnectedPeerCount(): number {
    return this._libp2p.getConnections().length
  }

  // Returns an array of connected peer IDs
  getConnectedPeers(): string[] {
    return Array.from(this.connectedPeers)
  }

  // Get full peer information
  getPeerInfo(): any[] {
    return Array.from(this.connectedPeers).map((peerId) => {
      try {
        const peer = this._libp2p.peerStore.get(peerId)
        return {
          id: peerId,
          addresses: peer?.addresses.map((addr) => addr.multiaddr.toString()) || []
        }
      } catch (err) {
        return { id: peerId, addresses: [] }
      }
    })
  }

  // Returns the number of peers subscribed to a given topic
  getSubscriberCount(topic: string): number {
    const subscribers = this._libp2p.services.pubsub.getSubscribers(topic)
    return subscribers.length
  }

  getPeerId(): string {
    return this._libp2p.peerId.toString();
  }
}
