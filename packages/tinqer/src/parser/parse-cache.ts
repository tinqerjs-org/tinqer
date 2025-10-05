/**
 * Parse result cache implementation using LRU (Least Recently Used) eviction
 */

import type { QueryOperation } from "../query-tree/operations.js";

/**
 * Cached parse result containing the operation tree and auto-generated parameters
 */
export interface CachedParseResult {
  operation: QueryOperation;
  autoParams: Record<string, unknown>;
  autoParamInfos?: Record<string, unknown>;
}

/**
 * LRU cache node
 */
class LRUNode {
  constructor(
    public key: string,
    public value: CachedParseResult,
    public prev: LRUNode | null = null,
    public next: LRUNode | null = null,
  ) {}
}

/**
 * LRU cache implementation for parse results
 */
export class ParseCache {
  private cache = new Map<string, LRUNode>();
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;

  constructor(private capacity: number) {}

  /**
   * Get a cached parse result
   */
  get(key: string): CachedParseResult | undefined {
    const node = this.cache.get(key);
    if (!node) {
      return undefined;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    return node.value;
  }

  /**
   * Store a parse result in the cache
   */
  set(key: string, value: CachedParseResult): void {
    if (this.capacity <= 0) {
      return;
    }

    const existing = this.cache.get(key);
    if (existing) {
      // Update existing node
      existing.value = value;
      this.moveToFront(existing);
      return;
    }

    // Create new node
    const node = new LRUNode(key, value);
    this.cache.set(key, node);
    this.addToFront(node);

    // Evict least recently used if over capacity
    if (this.cache.size > this.capacity) {
      this.evictLRU();
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * Update the cache capacity
   */
  setCapacity(capacity: number): void {
    this.capacity = capacity;

    if (capacity <= 0) {
      this.clear();
      return;
    }

    // Evict oldest entries if current size exceeds new capacity
    while (this.cache.size > capacity) {
      this.evictLRU();
    }
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Move node to front of LRU list
   */
  private moveToFront(node: LRUNode): void {
    if (node === this.head) {
      return;
    }

    // Remove from current position
    this.removeNode(node);

    // Add to front
    this.addToFront(node);
  }

  /**
   * Add node to front of LRU list
   */
  private addToFront(node: LRUNode): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from LRU list
   */
  private removeNode(node: LRUNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    this.cache.delete(this.tail.key);
    this.removeNode(this.tail);
  }
}

/**
 * Singleton parse cache instance
 */
export const parseCache = new ParseCache(1024);
