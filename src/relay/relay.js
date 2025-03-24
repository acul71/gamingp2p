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
      services: {
        identify: identify(),
        //autoNat: autoNAT(),
        pubsub: gossipsub(),
          // relay: circuitRelayServer()
        relay: circuitRelayServer({
          // disable max reservations limit for demo purposes. in production you
          // should leave this set to the default of 15 to prevent abuse of your
          // node by network peers
          reservations: {
            //maxReservations: Infinity
            maxReservations: 100 
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
      } else {
        logWithTimestamp('Peer connected, but peerId is undefined.')
      }
    })

    // Listen for peer discovery events
    node.addEventListener('peer:discovery', (event) => {
      const peerInfo = event.detail
      logWithTimestamp(`Peer discovered: ${colorizeJson(peerInfo)}`)
    })

    // Listen for peer identify events
    node.addEventListener('peer:identify', (event) => {
      const identifyResult = event.detail
      logWithTimestamp(`Peer identified: ${colorizeJson(identifyResult)}`)
    })

    // Listen for connection prune events
    node.addEventListener('connection:prune', (event) => {
      const connections = event.detail
      logWithTimestamp(`Connections pruned: ${colorizeJson(connections.map(conn => conn.toString()))}`)
    })

    // Listen for peer update events
    node.addEventListener('peer:update', (event) => {
      const peerUpdate = event.detail
      logWithTimestamp(`Peer updated: ${colorizeJson(peerUpdate)}`)
    })

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
