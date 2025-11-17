/**
 * Connection State Manager
 * US-1.5: Manage WebSocket connection states and health
 *
 * Responsibilities:
 * - Track connection states (connecting, connected, etc.)
 * - Heartbeat/ping-pong monitoring
 * - Detect zombie connections
 * - Emit state change events
 */

import { EventEmitter } from 'events';
import { WebSocketClient, ConnectionState } from '../../types/websocket';

interface ConnectionHealthMetrics {
  clientId: string;
  state: ConnectionState;
  pingLatencyMs: number | null;
  lastPingAt: number;
  lastPongAt: number;
  missedPongs: number;
}

export class ConnectionStateManager extends EventEmitter {
  private clients = new Map<string, WebSocketClient>();
  private connectionStates = new Map<string, ConnectionState>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
  private readonly HEARTBEAT_TIMEOUT_MS = 5000; // 5 seconds
  private readonly MAX_MISSED_PONGS = 3;
  private missedPongs = new Map<string, number>();

  constructor() {
    super();
  }

  /**
   * Start heartbeat monitoring
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) {
      console.warn('[ConnectionStateManager] Heartbeat already running');
      return;
    }

    console.log('[ConnectionStateManager] 💓 Starting heartbeat monitoring');

    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[ConnectionStateManager] Heartbeat stopped');
    }
  }

  /**
   * Register a new client connection
   */
  registerClient(client: WebSocketClient): void {
    this.clients.set(client.id, client);
    this.connectionStates.set(client.id, ConnectionState.CONNECTED);
    this.missedPongs.set(client.id, 0);

    console.log(`[ConnectionStateManager] ✅ Client registered: ${client.id}`);
    this.emit('client_connected', { clientId: client.id });
  }

  /**
   * Unregister client connection
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    this.connectionStates.delete(clientId);
    this.missedPongs.delete(clientId);

    console.log(`[ConnectionStateManager] ❌ Client unregistered: ${clientId}`);
    this.emit('client_disconnected', { clientId });
  }

  /**
   * Update connection state
   */
  setState(clientId: string, state: ConnectionState): void {
    const previousState = this.connectionStates.get(clientId);
    this.connectionStates.set(clientId, state);

    if (previousState !== state) {
      console.log(`[ConnectionStateManager] State change: ${clientId} ${previousState} → ${state}`);
      this.emit('state_change', { clientId, previousState, newState: state });
    }
  }

  /**
   * Get connection state
   */
  getState(clientId: string): ConnectionState | undefined {
    return this.connectionStates.get(clientId);
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients
   */
  getAllClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get connection health metrics for a client
   */
  getHealthMetrics(clientId: string): ConnectionHealthMetrics | null {
    const client = this.clients.get(clientId);
    const state = this.connectionStates.get(clientId);

    if (!client || !state) return null;

    const pingLatency =
      client.lastPongAt > client.lastPingAt ? client.lastPongAt - client.lastPingAt : null;

    return {
      clientId,
      state,
      pingLatencyMs: pingLatency,
      lastPingAt: client.lastPingAt,
      lastPongAt: client.lastPongAt,
      missedPongs: this.missedPongs.get(clientId) || 0,
    };
  }

  /**
   * Record pong received from client
   */
  recordPong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPongAt = Date.now();
      this.missedPongs.set(clientId, 0); // Reset missed pongs
    }
  }

  /**
   * Perform heartbeat check for all clients
   */
  private performHeartbeat(): void {
    const now = Date.now();
    const clientsToCheck = Array.from(this.clients.values());

    console.log(`[ConnectionStateManager] 💓 Heartbeat check: ${clientsToCheck.length} clients`);

    for (const client of clientsToCheck) {
      // Check if client responded to last ping
      const timeSinceLastPong = now - client.lastPongAt;

      if (client.lastPingAt > client.lastPongAt && timeSinceLastPong > this.HEARTBEAT_TIMEOUT_MS) {
        // Missed pong
        const missed = (this.missedPongs.get(client.id) || 0) + 1;
        this.missedPongs.set(client.id, missed);

        console.warn(
          `[ConnectionStateManager] ⚠️  Client ${client.id} missed pong (${missed}/${this.MAX_MISSED_PONGS})`,
        );

        if (missed >= this.MAX_MISSED_PONGS) {
          // Connection is dead - zombie detected
          console.error(`[ConnectionStateManager] 💀 Zombie connection detected: ${client.id}`);
          this.setState(client.id, ConnectionState.ERROR);
          this.emit('zombie_detected', { clientId: client.id });

          // Close the socket
          try {
            client.socket.socket.close();
          } catch (error) {
            console.error(`[ConnectionStateManager] Error closing zombie socket:`, error);
          }

          this.unregisterClient(client.id);
          continue;
        }
      }

      // Send ping
      try {
        client.lastPingAt = now;
        client.socket.socket.send(
          JSON.stringify({
            type: 'ping',
            timestamp: now,
          }),
        );
      } catch (error) {
        console.error(`[ConnectionStateManager] Error sending ping to ${client.id}:`, error);
        this.setState(client.id, ConnectionState.ERROR);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const stateCount: Record<string, number> = {};
    this.connectionStates.forEach((state) => {
      stateCount[state] = (stateCount[state] || 0) + 1;
    });

    const healthyClients = Array.from(this.clients.values()).filter(
      (client) => this.missedPongs.get(client.id) === 0,
    ).length;

    return {
      totalClients: this.clients.size,
      healthyClients,
      unhealthyClients: this.clients.size - healthyClients,
      stateBreakdown: stateCount,
      heartbeatInterval: this.HEARTBEAT_INTERVAL_MS,
      heartbeatTimeout: this.HEARTBEAT_TIMEOUT_MS,
    };
  }
}

