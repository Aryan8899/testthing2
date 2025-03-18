// advancedSuiClient.ts
import { SuiClient, SuiHTTPTransport } from "@mysten/sui/client";

/**
 * RequestQueue - A queue system for managing API requests with rate limiting
 */
class RequestQueue {
  private queue: Array<{
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private processing = false;
  private concurrentRequests = 0;
  private maxConcurrent: number;
  private requestDelay: number;
  private lastRequestTime = 0;
  private failureCount = 0;
  private circuitOpen = false;
  private circuitResetTimeout: NodeJS.Timeout | null = null;

  constructor(maxConcurrent = 2, requestDelay = 500) {
    this.maxConcurrent = maxConcurrent;
    this.requestDelay = requestDelay;
  }

  /**
   * Add a task to the queue
   */
  public enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve: resolve as (value: any) => void,
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * Process the next items in the queue
   */
  private processQueue() {
    if (
      this.processing ||
      this.concurrentRequests >= this.maxConcurrent ||
      this.queue.length === 0
    ) {
      return;
    }

    // Check if circuit breaker is open
    if (this.circuitOpen) {
      // If circuit is open, only allow one test request after delay
      if (!this.circuitResetTimeout) {
        this.circuitResetTimeout = setTimeout(() => {
          console.log("Attempting to reset circuit breaker...");
          this.circuitOpen = false;
          this.failureCount = 0;
          this.circuitResetTimeout = null;
          this.processQueue();
        }, 5000); // Wait 5 seconds before trying again
      }
      return;
    }

    this.processing = true;

    // Calculate delay to maintain rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const delay = Math.max(0, this.requestDelay - timeSinceLastRequest);

    setTimeout(() => {
      // Process as many items as we can up to maxConcurrent
      while (
        this.concurrentRequests < this.maxConcurrent &&
        this.queue.length > 0
      ) {
        const item = this.queue.shift();
        if (!item) continue;

        this.concurrentRequests++;
        this.lastRequestTime = Date.now();

        item
          .task()
          .then((result) => {
            item.resolve(result);
            this.failureCount = Math.max(0, this.failureCount - 1); // Reduce failure count on success
          })
          .catch((error) => {
            this.failureCount++;
            item.reject(error);

            // If we have consecutive failures, open the circuit breaker
            if (this.failureCount >= 5) {
              console.warn(
                "Circuit breaker opened due to consecutive failures"
              );
              this.circuitOpen = true;
            }
          })
          .finally(() => {
            this.concurrentRequests--;
            this.processQueue();
          });
      }

      this.processing = false;
    }, delay);
  }

  /**
   * Force reset the circuit breaker
   */
  public resetCircuitBreaker() {
    this.circuitOpen = false;
    this.failureCount = 0;
    if (this.circuitResetTimeout) {
      clearTimeout(this.circuitResetTimeout);
      this.circuitResetTimeout = null;
    }
    this.processQueue();
  }
}

/**
 * Advanced SUI client with request management
 */
class AdvancedSuiClient {
  private client: SuiClient;
  private requestQueue: RequestQueue;
  private static instance: AdvancedSuiClient;

  private constructor() {
    this.client = new SuiClient({
      transport: new SuiHTTPTransport({
        url: "https://fullnode.devnet.sui.io/",
      }),
    });

    this.requestQueue = new RequestQueue(2, 1000); // Max 2 concurrent requests, 1 second between requests
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AdvancedSuiClient {
    if (!AdvancedSuiClient.instance) {
      AdvancedSuiClient.instance = new AdvancedSuiClient();
    }
    return AdvancedSuiClient.instance;
  }

  /**
   * Get an object with built-in queuing and rate limiting
   */
  public async getObject(params: Parameters<SuiClient["getObject"]>[0]) {
    return this.requestQueue.enqueue(() => this.client.getObject(params));
  }

  /**
   * Get coins with built-in queuing and rate limiting
   */
  public async getCoins(params: Parameters<SuiClient["getCoins"]>[0]) {
    return this.requestQueue.enqueue(() => this.client.getCoins(params));
  }

  /**
   * Get coin metadata with built-in queuing and rate limiting
   */
  public async getCoinMetadata(
    params: Parameters<SuiClient["getCoinMetadata"]>[0]
  ) {
    return this.requestQueue.enqueue(() => this.client.getCoinMetadata(params));
  }

  /**
   * Get owned objects with built-in queuing and rate limiting
   */
  public async getOwnedObjects(
    params: Parameters<SuiClient["getOwnedObjects"]>[0]
  ) {
    return this.requestQueue.enqueue(() => this.client.getOwnedObjects(params));
  }

  /**
   * Get transaction block with built-in queuing and rate limiting
   */
  public async getTransactionBlock(
    params: Parameters<SuiClient["getTransactionBlock"]>[0]
  ) {
    return this.requestQueue.enqueue(() =>
      this.client.getTransactionBlock(params)
    );
  }

  /**
   * Dev inspect transaction block with built-in queuing and rate limiting
   */
  public async devInspectTransactionBlock(
    params: Parameters<SuiClient["devInspectTransactionBlock"]>[0]
  ) {
    return this.requestQueue.enqueue(() =>
      this.client.devInspectTransactionBlock(params)
    );
  }

  /**
   * Query events with built-in queuing and rate limiting
   */
  public async queryEvents(params: Parameters<SuiClient["queryEvents"]>[0]) {
    return this.requestQueue.enqueue(() => this.client.queryEvents(params));
  }

  /**
   * Access the underlying SUI client directly (use with caution)
   */
  public getSuiClient(): SuiClient {
    return this.client;
  }

  /**
   * Reset the circuit breaker to recover from failures
   */
  public resetCircuitBreaker() {
    this.requestQueue.resetCircuitBreaker();
  }
}

// Export the singleton instance
export const advancedSuiClient = AdvancedSuiClient.getInstance();

// Export a method to create a fresh client for special cases
export const createFreshAdvancedClient = () => {
  return AdvancedSuiClient.getInstance();
};
