import { CountMinSketch } from 'faster-count-min-sketch';

/**
 * Represents an entry in the cache.
 * @template T
 * @typedef {object} CacheEntry
 * @property {T} value
 * @property {number} timestamp - Time of insertion or last relevant update.
 * @property {number} keyArrayIndex - The index of the key in the keyListArray.
 */

/**
 * A Hyperbolic LRU Cache implementation using Count-Min Sketch and Random Sampling Eviction.
 * Optimized for faster sampling using an explicit key list.
 * @template T The type of values stored in the cache
 */
export class HyperbolicLRUCache {
  /** @private */
  capacity;
  /** @private */
  onEvict;
  /**
   * @private Map from key to CacheEntry.
   * @type {Map<string, CacheEntry<T>>}
   */
  cache;
  /**
   * @private Tracks approximate frequency.
   * @type {CountMinSketch}
   */
  sketch;
  /**
   * @private Number of items to sample during eviction.
   * @type {number}
   */
  sampleSize;
  /**
   * @private Array storing keys for fast random access during sampling.
   * @type {string[]}
   */
  keyListArray;

  /**
   * Creates a new HyperbolicLRUCache instance.
   * @param {number} capacity Maximum number of items to store in the cache. Must be positive.
   * @param {object} [options] Configuration options.
   * @param {(key: string, value: T) => void} [options.onEvict] Optional callback when items are evicted.
   * @param {number} [options.sampleSize=5] Number of items to sample during eviction.
   * @param {number} [options.sketchEpsilon=0.01] Estimated error rate for CountMinSketch (e.g., 0.01 for 1%).
   * @param {number} [options.sketchDelta=0.01] Probability of exceeding the error rate (e.g., 0.01 for 1%).
   * @param {number} [options.sketchDepth] Optional explicit depth for the CountMinSketch, overriding the delta calculation. Defaults to calculation based on delta.
   * @param {CountMinSketch} [options.sketchInstance] Optionally provide an existing sketch instance.
   */
  constructor(capacity, options = {}) {
    if (capacity <= 0) {
      throw new Error('Capacity must be positive.');
    }
    this.capacity = capacity;
    this.onEvict = options.onEvict;
    this.sampleSize = options.sampleSize || 5;
    if (this.sampleSize <= 0) {
      console.warn(`Invalid sampleSize (${this.sampleSize}), defaulting to 3.`);
      this.sampleSize = 3;
    }

    this.cache = new Map();
    this.keyListArray = [];

    if (options.sketchInstance) {
      if (!(options.sketchInstance instanceof CountMinSketch)) {
        throw new Error('Provided sketchInstance is not a valid CountMinSketch');
      }
      this.sketch = options.sketchInstance;
    } else {
      const epsilon = options.sketchEpsilon || 0.01;
      const delta = options.sketchDelta || 0.01;
      if (options.sketchDepth !== undefined) {
        if (options.sketchDepth <= 0) {
          throw new Error('sketchDepth must be positive');
        }
        const width = Math.ceil(Math.E / epsilon);
        this.sketch = new CountMinSketch(width, options.sketchDepth);
      } else {
        this.sketch = CountMinSketch.createEstimate(epsilon, delta);
      }
    }
  }

  /**
   * Sets a value in the cache. Updates frequency estimate and potentially the key list.
   * @param {string} key The key to store the value under.
   * @param {T} value The value to store.
   */
  set(key, value) {
    const now = Date.now();
    let entry = this.cache.get(key);

    this.sketch.update(key);

    if (entry) {
      entry.value = value;
      entry.timestamp = now;
    } else {
      if (this.cache.size >= this.capacity && this.capacity > 0) {
        this.evict();
      }

      if (this.cache.size < this.capacity) {
        const keyIndex = this.keyListArray.length;
        entry = { value, timestamp: now, keyArrayIndex: keyIndex };
        this.cache.set(key, entry);
        this.keyListArray.push(key);
      } else if (this.capacity > 0) {
        console.warn(`Cache is still full (size: ${this.cache.size}, capacity: ${this.capacity}) after potential eviction. Entry for key "${key}" not added.`);
      }
    }
  }

  /**
   * Checks if a key exists in the cache. Does not update sketch or timestamp.
   * @param {string} key The key to check.
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Gets a value from the cache. Updates frequency estimate and timestamp if found.
   * @param {string} key The key to retrieve.
   * @returns {T | undefined} The value if found, undefined otherwise.
   */
  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.timestamp = Date.now();
      this.sketch.update(key);
      return entry.value;
    }
    return undefined;
  }

  /**
   * Calculates the hyperbolic priority for a given key based on its cache entry and estimated frequency.
   * Lower value means higher priority for eviction.
   * @private
   * @param {string} key The key to calculate priority for.
   * @param {number} nowMs The current time in milliseconds (passed in for efficiency).
   * @returns {number} The calculated priority, or Infinity if entry not found.
   */
  _calculateHyperbolicPriority(key, nowMs) {
    const entry = this.cache.get(key);
    if (!entry) {
      return Infinity;
    }
    const estimatedFrequency = this.sketch.query(key);
    const timeInCacheSeconds = (nowMs - entry.timestamp) / 1000 + 1;
    if (estimatedFrequency === 0) return 0;
    return estimatedFrequency / timeInCacheSeconds;
  }

 /**
  * Internal helper to remove a key efficiently from all structures.
  * @private
  * @param {string} key The key to delete.
  * @returns {CacheEntry<T> | undefined} The removed entry, or undefined if not found.
  */
 _deleteKey(key) {
    const entryToRemove = this.cache.get(key);
    if (!entryToRemove) {
        return undefined;
    }

    const indexToRemove = entryToRemove.keyArrayIndex;
    const keyListLen = this.keyListArray.length;
    const lastKey = this.keyListArray.pop();

    if (key !== lastKey && indexToRemove < (keyListLen - 1)) { 
      this.keyListArray[indexToRemove] = lastKey;
      const movedEntry = this.cache.get(lastKey);
      if (movedEntry) {
          movedEntry.keyArrayIndex = indexToRemove;
      } else {
          console.error(`Inconsistency: Key "${lastKey}" not found in cache during swap-and-pop.`);
      }
    } 

    this.cache.delete(key);

    return entryToRemove;
 }

  /**
   * Evicts an item using random sampling (from keyListArray) based on hyperbolic priority.
   * @private
   */
  evict() {
    const currentSize = this.keyListArray.length;
    if (currentSize === 0) return;

    const actualSampleSize = Math.min(this.sampleSize, currentSize);
    let keyToEvict = null;
    let lowestPriority = Infinity;
    const nowMs = Date.now();
    var i = 0;
    for (; i < actualSampleSize; ++i) {
      const randomIndex = Math.floor(Math.random() * currentSize);
      const sampledKey = this.keyListArray[randomIndex];

      const priority = this._calculateHyperbolicPriority(sampledKey, nowMs);

      if (priority < lowestPriority) {
        lowestPriority = priority;
        keyToEvict = sampledKey;
      }
    }

    if (keyToEvict !== null) {
        const evictedEntry = this._deleteKey(keyToEvict);
        if (evictedEntry) {
            if (this.onEvict) {
                try {
                    this.onEvict(keyToEvict, evictedEntry.value);
                } catch (e) {
                    console.error(`onEvict callback failed for key ${keyToEvict}:`, e);
                }
            }
        } else {
             console.warn(`Attempted to evict key "${keyToEvict}" but it was not found (eee! race condition?).`);
        }
    } else {
        if (currentSize > 0) {
            const fallbackIndex = Math.floor(Math.random() * currentSize);
            const fallbackKey = this.keyListArray[fallbackIndex];
            this._deleteKey(fallbackKey);
            this._deleteKey(fallbackKey);
        }
    }
  }

  /**
   * Removes items from the cache that are older than maxAge.
   * Uses the efficient _deleteKey helper.
   * @param {number} maxAge Maximum age in milliseconds.
   */
  cleanup(maxAge) {
    const now = Date.now();
    const keysToDelete = [];
    const listLen = this.keyListArray.length;
    for (let i = 0; i < listLen; ++i) {
        const key = this.keyListArray[i];
        const entry = this.cache.get(key);
        if (entry && (now - entry.timestamp > maxAge)) {
            const deletedEntry = this._deleteKey(key);
            if (this.onEvict && deletedEntry) {
                try {
                    this.onEvict(key, deletedEntry.value);
                } catch (e) {
                    console.error(`onEvict callback failed during cleanup for key ${key}:`, e);
                }
            }
        }
    }
  }

  /**
   * Gets the current size of the cache.
   * @returns {number} The number of items currently in the cache.
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clears the cache, the key list array, and the associated Count-Min Sketch.
   */
  clear() {
    this.cache.clear();
    this.sketch.clear();
    this.keyListArray = [];

  }
}