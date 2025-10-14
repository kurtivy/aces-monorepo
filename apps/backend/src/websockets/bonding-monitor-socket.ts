import { FastifyInstance } from 'fastify';
import { PrismaClient, TokenPhase, TokenPriceSource } from '@prisma/client';
import { AerodromeDataService } from '../services/aerodrome-data-service';

interface WebSocketClient {
  id: string;
  socket: any;
  lastPing: number;
}

interface BondingStatus {
  tokenAddress: string;
  bonded: boolean;
  poolAddress: string | null;
  lastChecked: number;
}

export class BondingMonitorWebSocket {
  private clients = new Map<string, WebSocketClient>();
  private monitoredTokens = new Set<string>(); // Set of token addresses being monitored
  private bondingStatuses = new Map<string, BondingStatus>();
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(
    private fastify: FastifyInstance,
    private prisma: PrismaClient,
    private aerodromeService: AerodromeDataService,
  ) {}

  /**
   * Initialize WebSocket server for bonding monitoring
   */
  async initialize() {
    this.fastify.get('/ws/bonding', { websocket: true } as any, (connection: any, req: any) => {
      const clientId = this.generateClientId();
      console.log(`[BondingMonitor] Client connected: ${clientId}`);

      const client: WebSocketClient = {
        id: clientId,
        socket: connection.socket,
        lastPing: Date.now(),
      };

      this.clients.set(clientId, client);

      // Handle messages from client
      connection.socket.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error('[BondingMonitor] Invalid message:', error);
        }
      });

      // Handle disconnection
      connection.socket.on('close', () => {
        console.log(`[BondingMonitor] Client disconnected: ${clientId}`);
        this.handleClientDisconnect(clientId);
      });

      // Send welcome message
      connection.socket.send(
        JSON.stringify({
          type: 'connected',
          clientId,
          timestamp: Date.now(),
        }),
      );
    });

    // Start monitoring loop (every 10 seconds)
    this.startMonitoring();

    console.log('✅ Bonding Monitor WebSocket initialized on /ws/bonding');
  }

  /**
   * Handle client messages
   */
  private handleClientMessage(clientId: string, data: { type: string; [key: string]: unknown }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'monitor_token':
        this.addTokenToMonitor(data.tokenAddress as string);
        this.sendImmediateStatus(clientId, data.tokenAddress as string);
        break;

      case 'stop_monitoring':
        this.removeTokenFromMonitor(data.tokenAddress as string);
        break;

      case 'ping':
        client.lastPing = Date.now();
        client.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        console.warn('[BondingMonitor] Unknown message type:', data.type);
    }
  }

  /**
   * Add token to monitoring list
   */
  private addTokenToMonitor(tokenAddress: string) {
    const normalized = tokenAddress.toLowerCase();
    if (!this.monitoredTokens.has(normalized)) {
      this.monitoredTokens.add(normalized);
      console.log(`[BondingMonitor] Now monitoring: ${normalized}`);
      console.log(`[BondingMonitor] Total monitored tokens: ${this.monitoredTokens.size}`);
    }
  }

  /**
   * Remove token from monitoring list
   */
  private removeTokenFromMonitor(tokenAddress: string) {
    const normalized = tokenAddress.toLowerCase();
    this.monitoredTokens.delete(normalized);
    this.bondingStatuses.delete(normalized);
    console.log(`[BondingMonitor] Stopped monitoring: ${normalized}`);
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring() {
    if (this.monitorInterval) {
      console.warn('[BondingMonitor] Already monitoring');
      return;
    }

    console.log('[BondingMonitor] Starting monitoring loop (every 10 seconds)');

    // Check immediately
    this.checkAllTokens();

    // Then check every 10 seconds
    this.monitorInterval = setInterval(() => {
      this.checkAllTokens();
    }, 10000); // 10 seconds
  }

  /**
   * Stop monitoring loop
   */
  private stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log('[BondingMonitor] Stopped monitoring loop');
    }
  }

  /**
   * Check all monitored tokens for bonding status
   */
  private async checkAllTokens() {
    if (this.monitoredTokens.size === 0) {
      return;
    }

    console.log(`[BondingMonitor] Checking ${this.monitoredTokens.size} tokens...`);

    const tokens = Array.from(this.monitoredTokens);

    try {
      // Query subgraph for all monitored tokens
      const bondedStatuses = await this.fetchBondedStatuses(tokens);

      // Process each token
      for (const tokenAddress of tokens) {
        const subgraphStatus = bondedStatuses[tokenAddress];
        const previousStatus = this.bondingStatuses.get(tokenAddress);

        console.log(
          `[BondingMonitor] ${tokenAddress}: bonded=${subgraphStatus?.bonded}, previous=${previousStatus?.bonded}`,
        );

        // Check if token just bonded (transition from false/undefined to true)
        if (subgraphStatus?.bonded && !previousStatus?.bonded) {
          // Token just bonded! 🎉
          console.log(`[BondingMonitor] 🎉 TOKEN JUST BONDED: ${tokenAddress}`);
          await this.handleTokenBonded(tokenAddress);
        }

        // Update cached status
        if (subgraphStatus) {
          this.bondingStatuses.set(tokenAddress, {
            tokenAddress,
            bonded: subgraphStatus.bonded,
            poolAddress: subgraphStatus.poolAddress || null,
            lastChecked: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('[BondingMonitor] Error checking tokens:', error);
    }
  }

  /**
   * Handle when a token bonds out
   */
  private async handleTokenBonded(tokenAddress: string) {
    try {
      console.log(`[BondingMonitor] Processing bonded token: ${tokenAddress}`);

      // Fetch pool address from Aerodrome
      console.log('[BondingMonitor] Fetching pool address from Aerodrome...');
      const poolState = await this.aerodromeService.getPoolState(tokenAddress);

      if (!poolState || !poolState.poolAddress) {
        console.error(`[BondingMonitor] ❌ Failed to get pool address for ${tokenAddress}`);
        this.broadcastBondingEvent(tokenAddress, {
          bonded: true,
          poolAddress: null,
          error: 'Pool address not found',
        });
        return;
      }

      console.log(`[BondingMonitor] ✅ Pool address: ${poolState.poolAddress}`);

      // Update database
      console.log('[BondingMonitor] Updating database...');
      await this.prisma.token.update({
        where: { contractAddress: tokenAddress },
        data: {
          phase: TokenPhase.DEX_TRADING,
          priceSource: TokenPriceSource.DEX,
          poolAddress: poolState.poolAddress.toLowerCase(),
          dexLiveAt: new Date(),
        },
      });

      console.log('[BondingMonitor] ✅ Database updated successfully');

      // Update cached status
      this.bondingStatuses.set(tokenAddress, {
        tokenAddress,
        bonded: true,
        poolAddress: poolState.poolAddress.toLowerCase(),
        lastChecked: Date.now(),
      });

      // Broadcast to all connected clients
      this.broadcastBondingEvent(tokenAddress, {
        bonded: true,
        poolAddress: poolState.poolAddress.toLowerCase(),
        dexLiveAt: new Date().toISOString(),
        phase: 'DEX_TRADING',
      });

      console.log(`[BondingMonitor] 🚀 Token ${tokenAddress} successfully graduated to DEX!`);
    } catch (error) {
      console.error(`[BondingMonitor] Error handling bonded token ${tokenAddress}:`, error);
      this.broadcastBondingEvent(tokenAddress, {
        bonded: true,
        poolAddress: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Fetch bonded statuses from subgraph
   */
  private async fetchBondedStatuses(
    addresses: string[],
  ): Promise<Record<string, { bonded: boolean; poolAddress?: string }>> {
    if (!process.env.GOLDSKY_SUBGRAPH_URL) {
      throw new Error('GOLDSKY_SUBGRAPH_URL not configured');
    }

    const uniqueAddresses = Array.from(new Set(addresses.map((addr) => addr.toLowerCase())));
    const batchSize = 25;
    const result: Record<string, { bonded: boolean; poolAddress?: string }> = {};

    for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
      const batch = uniqueAddresses.slice(i, i + batchSize);

      const query = `
        query ($addresses: [String!]) {
          tokens(where: { address_in: $addresses }) {
            address
            bonded
            poolAddress
          }
        }
      `;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { addresses: batch } }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      const json = (await response.json()) as any;
      if (json.errors) {
        throw new Error(`Subgraph errors: ${JSON.stringify(json.errors)}`);
      }

      const tokens = json.data?.tokens ?? [];
      for (const token of tokens) {
        result[(token.address as string).toLowerCase()] = {
          bonded: token.bonded,
          poolAddress: token.poolAddress,
        };
      }
    }

    return result;
  }

  /**
   * Send immediate status to a specific client
   */
  private async sendImmediateStatus(clientId: string, tokenAddress: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const normalized = tokenAddress.toLowerCase();

    try {
      // ALWAYS check subgraph first - it's the source of truth for bonding status
      console.log(`[BondingMonitor] Checking bonding status for ${normalized}...`);
      const statuses = await this.fetchBondedStatuses([normalized]);
      const subgraphStatus = statuses[normalized];

      console.log(`[BondingMonitor] Subgraph says bonded: ${subgraphStatus?.bonded || false}`);

      // Check database for DEX phase info (only if actually bonded)
      const dbToken = await this.prisma.token.findUnique({
        where: { contractAddress: normalized },
        select: {
          poolAddress: true,
          phase: true,
          priceSource: true,
          dexLiveAt: true,
        },
      });

      // Token is bonded if subgraph says so AND we have dexLiveAt
      const isBonded = subgraphStatus?.bonded && dbToken?.dexLiveAt;

      if (isBonded) {
        // Already processed and bonded
        console.log(`[BondingMonitor] Token is bonded and processed`);
        client.socket.send(
          JSON.stringify({
            type: 'bonding_status',
            tokenAddress: normalized,
            bonded: true,
            poolAddress: dbToken.poolAddress,
            phase: dbToken.phase,
            priceSource: dbToken.priceSource,
            dexLiveAt: dbToken.dexLiveAt?.toISOString(),
            timestamp: Date.now(),
          }),
        );
      } else {
        // Still in bonding curve
        console.log(`[BondingMonitor] Token is NOT bonded (bonding curve)`);
        client.socket.send(
          JSON.stringify({
            type: 'bonding_status',
            tokenAddress: normalized,
            bonded: false,
            poolAddress: dbToken?.poolAddress || null, // May have predicted pool address
            phase: 'BONDING_CURVE',
            priceSource: 'BONDING_CURVE',
            timestamp: Date.now(),
          }),
        );
      }
    } catch (error) {
      console.error('[BondingMonitor] Error sending immediate status:', error);
    }
  }

  /**
   * Broadcast bonding event to all connected clients
   */
  private broadcastBondingEvent(tokenAddress: string, data: any) {
    const message = JSON.stringify({
      type: 'token_bonded',
      tokenAddress,
      ...data,
      timestamp: Date.now(),
    });

    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket.readyState === 1) {
        // WebSocket.OPEN
        try {
          client.socket.send(message);
          sentCount++;
        } catch (error) {
          console.error(`[BondingMonitor] Failed to send to ${clientId}:`, error);
        }
      }
    }

    console.log(`[BondingMonitor] Broadcast bonding event to ${sentCount} clients`);
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(clientId: string) {
    this.clients.delete(clientId);

    // Stop monitoring if no clients connected
    if (this.clients.size === 0 && this.monitoredTokens.size === 0) {
      console.log(
        '[BondingMonitor] No clients connected, keeping monitor active for tracked tokens',
      );
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `bonding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      monitoredTokens: this.monitoredTokens.size,
      tokens: Array.from(this.monitoredTokens),
      bondingStatuses: Array.from(this.bondingStatuses.entries()).map(([address, status]) => ({
        address,
        bonded: status.bonded,
        poolAddress: status.poolAddress,
        lastChecked: new Date(status.lastChecked).toISOString(),
      })),
    };
  }

  /**
   * Cleanup
   */
  async cleanup() {
    this.stopMonitoring();
    for (const client of this.clients.values()) {
      try {
        client.socket.close();
      } catch (error) {
        // Ignore
      }
    }
    this.clients.clear();
    this.monitoredTokens.clear();
    this.bondingStatuses.clear();
  }
}
