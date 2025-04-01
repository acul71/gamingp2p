/* eslint-disable no-console */

// To enable libp2p debug logs, set the DEBUG environment variable before running this script
// For example:
//   Linux/Mac: DEBUG=libp2p* node relay.js
//   Windows PowerShell: $env:DEBUG='libp2p*'; node relay.js
//   Windows CMD: set DEBUG=libp2p* && node relay.js
// 
// You can be more specific with the logging namespace:
//   DEBUG=libp2p:dialer,libp2p:peer-store node relay.js

import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { createLibp2p } from 'libp2p'
import chalk from 'chalk'
import { PUBSUB_PEER_DISCOVERY } from './constants.js'
import debug from 'debug'

// Define port
const port = process.env.PORT || 4444

function logWithTimestamp(message) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}

// Function to colorize JSON output
function colorizeJson(json) {
  return JSON.stringify(json, null, 2)
    .replace(/"([^"]+)":/g, chalk.blue('"$1":')) // Keys in blue
    .replace(/: "([^"]+)"/g, ': ' + chalk.green('"$1"')) // String values in green
    .replace(/: (\d+)/g, ': ' + chalk.yellow('$1')) // Numbers in yellow
}

async function main() {
  try {
    debug.enable('*')

    const node = await createLibp2p({
      addresses: {
        listen: [`/ip4/0.0.0.0/tcp/${port}/ws`]
      },
      transports: [
        webSockets()
      ],
      connectionEncrypters: [
        noise()
      ],
      streamMuxers: [
        yamux()
      ],
      connectionManager: {
        maxConnections: 1000,
        minConnections: 0,
        maxIncomingPendingConnections: 500,
        maxOutgoingPendingConnections: 500,
        inboundConnectionThreshold: 500,
        maxParallelDials: 100
      },
      services: {
        identify: identify(),
        //autoNat: autoNAT(),
        pubsub: gossipsub({
          // Whether to emit messages to self
          emitSelf: true,
          // Whether to gossip messages to peers that are not subscribed to the topic
          gossipIncoming: true,
          // Whether to fallback to floodsub if gossipsub fails
          fallbackToFloodsub: true,
          // Whether to flood publish messages to all peers
          floodPublish: true,
          // Whether to allow publishing when there are no peers
          allowPublishToZeroPeers: true,
          // Thresholds for peer scoring - negative values prevent pruning
          scoreThresholds: {
            // Minimum score required to gossip to a peer
            gossipThreshold: -1000,
            // Minimum score required to publish to a peer
            publishThreshold: -1000,
            // Minimum score before a peer is graylisted
            graylistThreshold: -1000,
            // Minimum score required to accept peer exchange
            acceptPXThreshold: -1000,
            // Minimum score for opportunistic grafting
            opportunisticGraftThreshold: -1000
          },
          // Detailed scoring parameters for peer behavior
          scoreParams: {
            // Topic-specific scoring parameters
            topics: {
              'browser-peer-discovery': {
                // Weight for topic-specific score
                topicWeight: 0.1,
                // Weight for time spent in mesh
                timeInMeshWeight: 0.01,
                // Time unit for mesh scoring
                timeInMeshQuantum: 1000,
                // Maximum time in mesh to consider
                timeInMeshCap: 3600,
                // Weight for first message deliveries
                firstMessageDeliveriesWeight: 0,
                // Weight for messages delivered to mesh
                meshMessageDeliveriesWeight: -0.01,
                // Decay rate for mesh message deliveries
                meshMessageDeliveriesDecay: 0.001,
                // Threshold for mesh message deliveries
                meshMessageDeliveriesThreshold: 1,
                // Cap for mesh message deliveries
                meshMessageDeliveriesCap: 100,
                // Weight for mesh failure penalties
                meshFailurePenaltyWeight: -0.01,
                // Decay rate for mesh failure penalties
                meshFailurePenaltyDecay: 0.01,
                // Weight for invalid message deliveries
                invalidMessageDeliveriesWeight: -0.01,
                // Decay rate for invalid message deliveries
                invalidMessageDeliveriesDecay: 0.01
              }
            },
            // Global scoring parameters
            // Weight for general behavior penalties
            behaviourPenaltyWeight: -0.01,
            // Decay rate for behavior penalties
            behaviourPenaltyDecay: 0.001,
            // Interval for score decay
            decayInterval: 1000,
            // Minimum score before decay to zero
            decayToZero: 0.01,
            // Maximum score to retain
            retainScore: 100000,
            // Function to calculate application-specific scores
            appSpecificScore: () => 0,
            // Weight for IP colocation factor
            IPColocationFactorWeight: 0,
            // Threshold for IP colocation
            IPColocationFactorThreshold: 100
          }
        }),
        relay: circuitRelayServer({
          reservations: {
            maxReservations: 1000,  // Maximum number of reservations allowed
            reservationTtl: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
            defaultDurationLimit: 10 * 60 * 1000, // 10 minutes in milliseconds
            defaultDataLimit: BigInt(1 << 20) // 1MB instead of default 128KB
          }
        })
      }
    })

    logWithTimestamp(`Node started with id ${node.peerId.toString()}`)
    logWithTimestamp(`Listening on port ${port}:`)
    node.getMultiaddrs().forEach((ma) => logWithTimestamp(ma.toString()))

    // Listen for peer connections
    node.addEventListener('peer:connect', (evt) => {
      const connection = evt.detail
      if (connection) {
        logWithTimestamp(`Peer connected: ${connection.toString()}`)
        // Log current number of relay reservations
        if (node.services.relay) {
          const reservationsCount = node.services.relay.reservations.size
          logWithTimestamp(`Current relay reservations: ${reservationsCount}`)
        }
      } else {
        logWithTimestamp('Peer connected, but peerId is undefined.')
      }
    })

    // Listen for peer discovery events
    /** 
    node.addEventListener('peer:discovery', (event) => {
      const peerInfo = event.detail
      logWithTimestamp(`Peer discovered: ${colorizeJson(peerInfo)}`)
    })
    */
    // Listen for peer identify events
    /**
    node.addEventListener('peer:identify', (event) => {
      const identifyResult = event.detail
      logWithTimestamp(`Peer identified: ${colorizeJson(identifyResult)}`)
    })
    */

    // Listen for connection prune events
    node.addEventListener('connection:prune', (event) => {
      const connections = event.detail
      logWithTimestamp(`Connections pruned: ${colorizeJson(connections.map(conn => conn.toString()))}`)
    })

    // Listen for peer update events
    /** 
    node.addEventListener('peer:update', (event) => {
      const peerUpdate = event.detail
      logWithTimestamp(`Peer updated: ${colorizeJson(peerUpdate)}`)
    })
    */
    // Listen for self peer update events
    node.addEventListener('self:peer:update', (event) => {
      const selfPeerUpdate = event.detail
      try {
        const colorizedOutput = colorizeJson(selfPeerUpdate)
        logWithTimestamp(`Self peer updated: ${colorizedOutput}`)
      } catch (error) {
        logWithTimestamp(`Error formatting self peer update: ${error}`)
      }
    })

    // Subscribe to the peer discovery topic
    node.services.pubsub.subscribe(PUBSUB_PEER_DISCOVERY)
    
    /* Temporarily disabled message handler
    // Add handler for received messages
    node.services.pubsub.addEventListener('message', (evt) => {
      const { topic, data, from } = evt.detail
      
      // Convert binary data to string or parse JSON if possible
      let message
      try {
        // Try to parse as JSON first
        message = JSON.parse(new TextDecoder().decode(data))
        logWithTimestamp(`Message received on topic '${topic}' from peer ${from}:`)
        logWithTimestamp(colorizeJson(message))
      } catch (err) {
        // If not JSON, display as string
        message = new TextDecoder().decode(data)
        logWithTimestamp(`Message received on topic '${topic}' from peer ${from}: ${message}`)
      }
    })
    */

    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
      logWithTimestamp('Shutting down...')
      await node.stop()
      process.exit(0)
    })
  } catch (err) {
    logWithTimestamp('Failed to start node:')
    logWithTimestamp(err)
    process.exit(1)
  }
}

main()
