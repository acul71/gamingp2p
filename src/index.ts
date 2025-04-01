import { GamingNetwork } from './gamingNetwork.js'
import GamingServer from './gamingServer.js'

import { PUBSUB_PEER_DISCOVERY } from './constants.js'
import debug from 'debug'

debug.enable('*')

async function main() {
    await testNetwork()
    //await testServer()
}

async function testServer() {
    const server = new GamingServer({
        bootstrapList: ['/ip4/87.106.117.254/tcp/4444/ws/p2p/12D3KooWDLFkH4rxPNDPVMkaQcMJeCxf1MuCoNq4QEPb75F8EkYL']
      })
      
      await server.start()
      
      // Example: Subscribe to a game topic
      //server.subscribe('game-updates', (msg) => {
      //  console.log('Received game update:', msg)
      //})
      
      // Example: Publish a message
      //await server.publish('game-updates', { action: 'move', player: 'Player1', x: 10, y: 5 })
      
      // Example: Get connected peers
      // console.log(`Connected Peers: ${server.getConnectedPeerCount()}`)
      // console.log('Peer Info:', server.getPeerInfo())
}

async function testNetwork() {
  // Create a new GamingNetwork instance with your bootstrap peers
  // You can replace these with actual bootstrap peers if you have them
  const network = new GamingNetwork({
    bootstrapList: [
      //'/ip4/87.106.117.254/tcp/4444/ws/p2p/12D3KooWPp54D8Ng9HPY3sBs6iZ8bb4nbQy1JnbQkUyMryC9Jx5U',
      // '/ip4/87.106.117.254/tcp/4444/ws/',
      //'/ip4/87.106.117.254/tcp/4444/ws/p2p/12D3KooWHd9Ju4bE2E94TwZtMhsXC84f4CRrrYH6bocVoSynroGL',
      '/ip4/192.168.1.17/tcp/4444/ws/p2p/12D3KooWRgsaddMhkLQ9hbsxqwM1SbTUbUgEwXSazeNEzGs76zro',
      //'/ip4/192.168.1.17/tcp/9002/p2p/12D3KooWGdKhq1FMaBypcJFy3NK9ii77A2upgGi1ZWV49GLBkMA4'
    ]
  })

  try {
    // Start the network
    await network.start()
    console.log('Network started successfully')
    // Get the peer id
    const peerId = network.getPeerId()
    console.log('Peer ID:', peerId)
    // Subscribe to a topic
    network.subscribe(PUBSUB_PEER_DISCOVERY, (message) => {
      console.log('Received message:', message)
    })
    
    // Start sending messages every 500ms after a 5-second delay
    setTimeout(() => {
      setInterval(async () => {
        const success = await network.publish(PUBSUB_PEER_DISCOVERY, { text: `Hello from peer ${peerId}`, timestamp: Date.now() })
        if (success) {
          console.log('Message successfully published')
        } else {
          console.log('Failed to publish message: No peers subscribed')
        }
      }, 1_000)
    }, 5_000)
    
    // Keep the process running
    process.stdin.resume()
  } catch (error) {
    console.error('Error starting network:', error)
  }
}

main().catch(console.error) 