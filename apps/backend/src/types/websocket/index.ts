/**
 * WebSocket Gateway Types
 * Phase 1 - Foundation & Risk Mitigation
 */

import { SocketStream } from '@fastify/websocket';

/**
 * WebSocket Client Connection
 */
export interface WebSocketClient {
  id: string;
  socket: SocketStream;
  subscriptions: Set<string>; // Set of subscription keys
  connectedAt: number;
  lastPingAt: number;
  lastPongAt: number;
  metadata?: {
    userAgent?: string;
    ip?: string;
    userId?: string;
  };
}

/**
 * Message Types - All messages between client and server
 */
export enum MessageType {
  // Connection lifecycle
  CONNECTED = 'connected',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',

  // Subscription management
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SUBSCRIPTION_SUCCESS = 'subscription_success',
  SUBSCRIPTION_ERROR = 'subscription_error',

  // Data updates
  DATA_UPDATE = 'data_update',
  TRADE_UPDATE = 'trade_update',
  CANDLE_UPDATE = 'candle_update',
  CHART_UPDATE = 'chart_update',
  QUOTE_UPDATE = 'quote_update',
  METRICS_UPDATE = 'metrics_update',

  // Special events
  GRADUATION_EVENT = 'graduation_event',
  SUPPLY_UPDATE = 'supply_update',

  // Request/Response pattern
  REQUEST = 'request',
  RESPONSE = 'response',

  // Errors
  ERROR = 'error',
}

/**
 * Base message structure
 */
export interface BaseMessage {
  type: MessageType;
  timestamp: number;
  clientId?: string;
}

/**
 * Subscribe message from client
 */
export interface SubscribeMessage extends BaseMessage {
  type: MessageType.SUBSCRIBE;
  topic: string;
  params: Record<string, any>;
}

/**
 * Unsubscribe message from client
 */
export interface UnsubscribeMessage extends BaseMessage {
  type: MessageType.UNSUBSCRIBE;
  topic: string;
  params: Record<string, any>;
}

/**
 * Data update message to client
 */
export interface DataUpdateMessage extends BaseMessage {
  type: MessageType.DATA_UPDATE;
  topic: string;
  data: any;
}

/**
 * Error message to client
 */
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Request message (request/response pattern)
 */
export interface RequestMessage extends BaseMessage {
  type: MessageType.REQUEST;
  requestId: string;
  topic: string;
  params: Record<string, any>;
}

/**
 * Response message
 */
export interface ResponseMessage extends BaseMessage {
  type: MessageType.RESPONSE;
  requestId: string;
  data?: any;
  error?: string;
}

/**
 * Union type of all messages
 */
export type WebSocketMessage =
  | BaseMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | DataUpdateMessage
  | ErrorMessage
  | RequestMessage
  | ResponseMessage;

/**
 * Subscription info stored in Subscription Manager
 */
export interface SubscriptionInfo {
  key: string; // Unique key: "topic:params"
  topic: string;
  params: Record<string, any>;
  clients: Set<string>; // Client IDs subscribed to this
  createdAt: number;
  lastUpdateAt: number | null;
  messageCount: number;
}

/**
 * Connection state
 */
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * Route for message routing
 */
export interface MessageRoute {
  topic: string;
  handler: (message: WebSocketMessage, clientId: string) => Promise<void> | void;
  priority?: number; // Higher priority = processed first
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  service: string;
  max: number; // Max requests
  window: number; // Time window in ms
}

/**
 * Rate limit usage stats
 */
export interface RateLimitUsage {
  service: string;
  current: number;
  limit: number;
  percentage: number;
  resetIn: number; // ms until reset
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * Gateway statistics
 */
export interface GatewayStats {
  connectedClients: number;
  activeSubscriptions: number;
  totalMessagesReceived: number;
  totalMessagesSent: number;
  uptimeMs: number;
  subscriptions: SubscriptionStats[];
  deduplication?: any; // Optional dedup stats
  rateLimits?: any; // Optional rate limit stats
  router?: any; // Optional router stats
  connection?: any; // Optional connection stats
}

export interface SubscriptionStats {
  key: string;
  topic: string;
  clientCount: number;
  messageCount: number;
  lastUpdate: number | null;
  uptimeMs: number;
}

