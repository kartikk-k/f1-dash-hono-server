import * as signalR from '@microsoft/signalr';
import logger from '../../shared/logger';
import { deepMerge } from '../../shared/utils/merge';
import type { LiveState } from '../../types';

// F1 SignalR topics to subscribe to
const F1_TOPICS = [
  'Heartbeat',
  'CarData.z',
  'Position.z',
  'ExtrapolatedClock',
  'TopThree',
  'RcmSeries',
  'TimingStats',
  'TimingAppData',
  'WeatherData',
  'TrackStatus',
  'SessionStatus',
  'DriverList',
  'RaceControlMessages',
  'SessionInfo',
  'SessionData',
  'LapCount',
  'TimingData',
  'TeamRadio',
  'PitLaneTimeCollection',
  'ChampionshipPrediction',
];

export type MessageHandler = (type: 'initial' | 'updates', data: any) => void;

export class F1Client {
  private connection: signalR.HubConnection | null = null;
  private state: LiveState = {};
  private messageHandlers: Set<MessageHandler> = new Set();
  private reconnectDelay = 3000; // 3 seconds
  private isRunning = false;
  private reconnectTimer: Timer | null = null;

  constructor() {
    this.state = {};
  }

  /**
   * Add a message handler
   */
  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Get current state
   */
  public getState(): LiveState {
    return this.state;
  }

  /**
   * Start the F1 client with auto-reconnect
   */
  public async start(): Promise<void> {
    this.isRunning = true;
    await this.connect();
  }

  /**
   * Stop the F1 client
   */
  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (error) {
        logger.error({ error }, 'Error stopping F1 connection');
      }
      this.connection = null;
    }
  }

  /**
   * Connect to F1 SignalR server
   */
  private async connect(): Promise<void> {
    try {
      const f1Url = process.env.F1_SIGNALR_URL || 'https://livetiming.formula1.com/signalr';

      logger.info({ url: f1Url }, 'Connecting to F1 SignalR server');

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(f1Url)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: () => this.reconnectDelay,
        })
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      // Handle messages from F1
      this.connection.on('feed', (topic: string, data: any, timestamp: number) => {
        this.handleFeedMessage(topic, data, timestamp);
      });

      // Handle reconnection events
      this.connection.onreconnecting((error) => {
        logger.warn({ error }, 'F1 connection lost, reconnecting...');
      });

      this.connection.onreconnected(() => {
        logger.info('F1 connection restored');
        this.subscribeToTopics();
      });

      this.connection.onclose((error) => {
        logger.error({ error }, 'F1 connection closed');
        if (this.isRunning) {
          this.scheduleReconnect();
        }
      });

      // Connect
      await this.connection.start();
      logger.info('Connected to F1 SignalR server');

      // Subscribe to topics
      await this.subscribeToTopics();
    } catch (error) {
      logger.error({ error }, 'Error connecting to F1 server');
      if (this.isRunning) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Subscribe to F1 topics
   */
  private async subscribeToTopics(): Promise<void> {
    if (!this.connection) return;

    try {
      await this.connection.invoke('Subscribe', F1_TOPICS);
      logger.info({ topics: F1_TOPICS.length }, 'Subscribed to F1 topics');
    } catch (error) {
      logger.error({ error }, 'Error subscribing to F1 topics');
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.isRunning) {
        this.connect();
      }
    }, this.reconnectDelay);

    logger.debug({ delay: this.reconnectDelay }, 'Scheduled reconnect');
  }

  /**
   * Handle feed message from F1
   */
  private handleFeedMessage(topic: string, data: any, timestamp: number): void {
    try {
      // Decompress if needed (some topics use .z suffix for compressed data)
      if (topic.endsWith('.z')) {
        data = this.decompressData(data);
        topic = topic.slice(0, -2); // Remove .z suffix
      }

      // Convert topic to camelCase for consistency
      const topicKey = this.topicToCamelCase(topic);

      // Check if this is an initial state message
      const isInitial = data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 10;

      if (isInitial) {
        // Initial state - merge into current state
        this.state = deepMerge(this.state, { [topicKey]: data });

        // Broadcast initial state to handlers
        this.broadcast('initial', this.state);
      } else {
        // Update - merge specific topic
        this.state = deepMerge(this.state, { [topicKey]: data });

        // Broadcast update to handlers
        this.broadcast('updates', [[topicKey, data]]);
      }

      logger.debug({ topic: topicKey, isInitial }, 'Received F1 data');
    } catch (error) {
      logger.error({ error, topic }, 'Error handling F1 message');
    }
  }

  /**
   * Decompress data (simplified - F1 uses base64 + gzip)
   */
  private decompressData(data: any): any {
    // For now, return as-is
    // In production, you'd decode base64 and gunzip
    return data;
  }

  /**
   * Convert topic name to camelCase
   */
  private topicToCamelCase(topic: string): string {
    return topic
      .replace(/[A-Z]/g, (letter, index) => (index === 0 ? letter.toLowerCase() : letter))
      .replace(/\./g, '');
  }

  /**
   * Broadcast to all message handlers
   */
  private broadcast(type: 'initial' | 'updates', data: any): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(type, data);
      } catch (error) {
        logger.error({ error }, 'Error in message handler');
      }
    }
  }
}

// Singleton instance
let f1Client: F1Client | null = null;

export function getF1Client(): F1Client {
  if (!f1Client) {
    f1Client = new F1Client();
  }
  return f1Client;
}
