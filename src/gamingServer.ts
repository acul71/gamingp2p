import { GamingNetwork, GamingNetworkOptions } from './gamingNetwork.js'

export class GamingServer {
  private network: GamingNetwork

  constructor(options: GamingNetworkOptions) {
    this.network = new GamingNetwork(options)
  }

  async start(): Promise<void> {
    await this.network.start()

    console.log('GamingServer started. Listening for connections.')

    // Listen for new peer connections
    this.network.libp2p.addEventListener('peer:connect', (event) => {
      const peerId = event.detail.toString()
      console.log(`Peer connected: ${peerId}`)
    })

    // Listen for peer disconnections
    this.network.libp2p.addEventListener('peer:disconnect', (event) => {
      const peerId = event.detail.toString()
      console.log(`Peer disconnected: ${peerId}`)
    })
  }

  /** Publish a message to a topic */
  async publish(topic: string, data: any): Promise<void> {
    await this.network.publish(topic, data)
  }

  /** Subscribe to a topic and handle incoming messages */
  subscribe(topic: string, handler: (msg: any) => void): void {
    this.network.subscribe(topic, handler)
  }
}

export default GamingServer
