# Hyperbolic LRU Cache (hLRU) for JavaScript

[![npm package](https://nodei.co/npm/hyperbolic-lru.png?downloads=true&stars=true)](https://nodei.co/npm/hyperbolic-lru/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](#)
[![Benchmarks](https://img.shields.io/badge/benchmarks-passing-brightgreen)](#)

A JavaScript implementation of a Hyperbolic LRU (hLRU) cache. This cache eviction strategy aims to improve hit rates over standard LRU by considering both the recency and frequency of item access. It uses a Count-Min Sketch to estimate item frequencies and a random sampling approach for selecting eviction candidates based on a hyperbolic priority score.

## Why Hyperbolic LRU Cache? (Use Cases)

Standard LRU (Least Recently Used) caches evict the item that hasn't been accessed for the longest time. While simple and effective in many scenarios, it can perform poorly when access patterns are more complex, or when older, frequently accessed items are more valuable than newer, infrequently accessed ones. Hyperbolic LRU is beneficial when:

*   **Recency alone is not the best eviction criteria:** You want to give more weight to items that have been accessed frequently, even if they weren't the *most* recent.
*   **Dealing with skewed access patterns:** Helps retain popular ("heavy hitter") items that might otherwise be evicted by a burst of new, less popular items.
*   **Improving cache hit rates:** By making more informed eviction decisions, hLRU can often achieve better hit rates compared to standard LRU, especially in workloads where frequency is a strong predictor of future access.
*   **Applications like CDNs, database query caches, or any system where popular content should persist.**

**Key Trade-off:** hLRU introduces some computational overhead compared to simpler LRU due to frequency tracking (Count-Min Sketch) and priority calculations during eviction. However, this can be offset by improved hit rates.

## Features

*   **Hyperbolic Caching Policy:** Evicts items based on the ratio of estimated frequency to time in cache.
*   **Frequency Estimation:** Utilizes a Count-Min Sketch to approximate item access frequencies efficiently.
*   **Random Sampling for Eviction:** Selects a small random sample of items and evicts the one with the lowest hyperbolic priority from that sample.
*   **`onEvict` Callback:** Allows custom actions when an item is evicted.
*   **Time-based Cleanup:** Provides a `cleanup(maxAge)` method to remove items older than a specified duration.
*   **Customizable Sketch Parameters:** Allows configuration of the internal Count-Min Sketch's error rate (`epsilon`) and probability of error (`delta`), or even providing an existing sketch instance.

## Installation

```bash
npm install hyperbolic-lru
```


## Usage

```javascript
import { HyperbolicLRUCache } from 'hyperbolic-lru'; // Adjust path as needed

// Initialize the cache with a capacity of 100
const cache = new HyperbolicLRUCache(100, {
  sketchEpsilon: 0.01, // Error rate for CountMinSketch
  sketchDelta: 0.01    // Probability of error for CountMinSketch
});

// Set some items
cache.set("user:1", { id: 1, name: "Alice" });
cache.set("user:2", { id: 2, name: "Bob" });
cache.set("article:123", { title: "Understanding Caches" });

// Get an item (this also updates its recency and frequency)
const user1 = cache.get("user:1");
if (user1) {
  console.log("Found user 1:", user1.name);
}

// Simulate more accesses to user:1
for (let i = 0; i < 10; i++) {
  cache.get("user:1");
}

// Add more items to potentially trigger eviction
for (let i = 0; i < 150; i++) {
  cache.set(`item:${i}`, { data: `value ${i}` });
}

console.log("Cache size:", cache.size()); // Will be at or below capacity (100)

// Check for an item that might have been evicted
const item0 = cache.get("item:0");
console.log("Item 0:", item0 ? "Still here! Yay!!" : "Get outta here, you're evicted!!");

const user1AfterEvictions = cache.get("user:1");
console.log("User 1 after evictions:", user1AfterEvictions ? "Still here! Yay!!" : "Evicted (hopefully not!)");

// Clean up items older than 1 hour (3600000 ms)
cache.cleanup(3600000);
```

## API

### `new HyperbolicLRUCache(capacity, [options])`

Creates a new `HyperbolicLRUCache` instance.

*   `capacity` (number): The maximum number of items the cache can hold. Must be a positive integer.
*   `options` (object, optional): Configuration for the cache.
    *   `onEvict` (function, optional): A callback function `(key: string, value: T) => void` that is called when an item is evicted from the cache.
    *   `sampleSize` (number, optional, default: `16`): The number of items to randomly sample from the cache when deciding which item to evict.
    *   `sketchEpsilon` (number, optional, default: `0.01`): The desired error factor for the internal Count-Min Sketch (e.g., 0.01 for an error of N * 0.01).
    *   `sketchDelta` (number, optional, default: `0.01`): The desired probability of the Count-Min Sketch's error exceeding `sketchEpsilon` (e.g., 0.01 for a 1% chance).
    *   `sketchDepth` (number, optional): Explicitly sets the depth for the Count-Min Sketch, overriding calculation from `sketchDelta`. Must be positive.
    *   `sketchInstance` (CountMinSketch, optional): An existing, configured `CountMinSketch` instance to use for frequency tracking. If provided, `sketchEpsilon`, `sketchDelta`, and `sketchDepth` are ignored for sketch creation.

### `set(key: string, value: T)`

Adds or updates a key-value pair in the cache.
If the key already exists, its value and timestamp are updated.
If the key is new and the cache is at capacity, an eviction occurs before adding the new item.
The item's access frequency is updated in the Count-Min Sketch.

*   `key` (string): The key to identify the item.
*   `value` (T): The value to store.

### `get(key: string): T | undefined`

Retrieves the value associated with the given key.
If the key is found, its timestamp is updated, and its access frequency is updated in the Count-Min Sketch.

*   `key` (string): The key of the item to retrieve.
*   **Returns**: The value if the key is found, or `undefined` otherwise.

### `has(key: string): boolean`

Checks if a key exists in the cache. This operation does *not* update the item's timestamp or frequency.

*   `key` (string): The key to check.
*   **Returns**: `true` if the key exists, `false` otherwise.

### `size(): number`

Returns the current number of items in the cache.

*   **Returns**: The number of items.

### `clear()`

Removes all items from the cache and resets the internal Count-Min Sketch.

### `cleanup(maxAge: number)`

Removes items from the cache that are older than `maxAge`.
Age is determined by the item's last update timestamp (from `set` or `get`).

*   `maxAge` (number): The maximum age in milliseconds. Items older than this will be removed.

## When to Use Hyperbolic LRU (hLRU)

Hyperbolic LRU (`hLRU`) is designed to achieve higher cache hit rates compared to simpler policies like standard LRU, especially in workloads with skewed access patterns (where some items are much more popular than others over time). It does this by considering both the recency and frequency of item access through its hyperbolic priority function.

However, this improved hit rate comes at the cost of some additional computational overhead per operation, primarily during the eviction process (due to random sampling and priority calculations). `hLRU` is most beneficial when the **savings from the increased hit rate outweigh this additional operational cost.**

Mathematically, you can think of the trade-off as follows:

Let:
*   $`\Delta H`$: The improvement in hit rate from `hLRU` compared to a baseline cache (e.g., LRU). 
    Defined as $`\Delta H = H_{hLRU} - H_{Baseline}`$.
*   $`C_{miss}`$: The average cost incurred due to a cache miss (e.g., time to fetch from a database, perform a complex computation, etc.). This should be in units consistent with $`C_{hLRU\_overhead}`$.
*   $`C_{hLRU\_overhead}`$: The average *additional* computational cost per cache operation (e.g., extra CPU time) incurred by `hLRU` compared to the baseline cache due to its more complex eviction logic.

`hLRU` is generally favored when the savings from reduced misses are greater than its additional operational cost:

```math
(H_{hLRU} - H_{Baseline}) \times C_{miss} > C_{hLRU\_overhead}
```

Or, using $`\Delta H`$:

```math
\Delta H \times C_{miss} > C_{hLRU\_overhead}
```

**In simpler terms:**

Use `hLRU` if:

*   **Cache misses are expensive:** If fetching data from the source (on a miss) has a high penalty (latency, computational load on backend systems), then even a modest improvement in hit rate ($`\Delta H`$) can lead to significant overall performance gains.
*   **Hit rate improvement is substantial:** The benchmarks show `hLRU` can offer noticeable hit rate improvements in specific (e.g., Zipfian) workloads.
*   **The application can tolerate a slight increase in per-operation latency for the cache itself** in exchange for fewer expensive misses. The `sampleSize` parameter in `hLRU` allows you to tune this trade-off directly: smaller `sampleSize` reduces $`C_{hLRU\_overhead}`$ but might also reduce $`\Delta H`$.

If cache misses are very cheap, or if the hit rate of a simpler cache like LRU is already very high and close to optimal for your workload, the additional overhead of `hLRU` might not be justified.

### Example Scenario: Caching LLM Responses

Let's consider caching responses from a Large Language Model (LLM). LLM calls can be both slow and have a direct monetary or computational cost.

**Assumptions:**

*   **Baseline Cache (e.g., LRU):**
    *   Hit Rate ($`H_{Baseline}`$): 60%
*   **`hLRU` Cache:**
    *   Hit Rate ($`H_{hLRU}`$): 70% (so, $`\Delta H = H_{hLRU} - H_{Baseline} = 10\% `$)
*   **Cost of a Cache Miss (LLM Call):**
    *   Average Time ($`C_{miss\_time}`$): 2000 milliseconds (2 seconds)
    *   Average Monetary/Compute Cost ($`C_{miss\_cost}`$): $0.02 per call (hypothetical)
*   **Additional Overhead of `hLRU` per cache operation:**
    *   Average Additional Time ($`C_{hLRU\_overhead\_time}`$): 0.5 milliseconds
    *   Average Additional Monetary/Compute Cost ($`C_{hLRU\_overhead\_cost}`$): Negligible for this example (let's assume it's primarily a time overhead).

**Analysis per 1000 requests:**

1.  **Baseline Cache (LRU):**
    *   Number of misses: $`1000 \times (1 - 0.60) = 400`$ misses.
    *   Time spent on LLM calls: $`400 \times 2000\ ms = 800,000\ ms`$.
    *   Monetary cost of LLM calls: $`400 \times \$0.02 = \$8.00`$.

2.  **`hLRU` Cache:**
    *   Number of misses: $`1000 \times (1 - 0.70) = 300`$ misses.
    *   Time spent on LLM calls: $`300 \times 2000\ ms = 600,000\ ms`$.
    *   Monetary cost of LLM calls: $`300 \times \$0.02 = \$6.00`$.
    *   Additional time overhead for `hLRU` operations: $`1000 \text{ ops} \times 0.5\ ms/op = 500\ ms`$.

3.  **Net Savings with `hLRU` (per 1000 requests):**
    *   **Time Saved:**
        *   Reduction in LLM call time: $`800,000\ ms - 600,000\ ms = 200,000\ ms`$.
        *   Net time saved: $`200,000\ ms - 500\ ms = 199,500\ ms`$ (or **199.5 seconds**).
    *   **Monetary Cost Saved:** $`\$8.00 - \$6.00 = \$2.00`$.

**Checking with the formula (per operation):**

Is $`\Delta H \times C_{miss} > C_{hLRU\_overhead}`$?

*   **Time:**
    *   Benefit from improved hit rate: $`0.10 \times 2000\ ms = 200\ ms`$ per operation.
    *   Is $`200\ ms > 0.5\ ms`$? **Yes.**
*   **Monetary Cost:**
    *   Benefit from improved hit rate: $`0.10 \times \$0.02 = \$0.002`$ per operation.
    *   Is $`\$0.002 > \text{negligible monetary overhead}`$? **Yes.**

In this scenario, the significant time and cost savings from reducing expensive LLM calls by 10% far outweigh the very small additional time overhead introduced by `hLRU`'s more sophisticated caching logic. This makes `hLRU` a strong candidate for such a use case.

## How It Works (Briefly)

The Hyperbolic LRU cache tries to be smarter about evictions than a standard LRU cache. When an item needs to be evicted (because the cache is full):

1.  **Sampling:** A small set of `sampleSize` items is randomly chosen from the cache.
2.  **Priority Calculation:** For each sampled item, a "hyperbolic priority" is calculated:
    \[ \text{Priority} = \frac{\text{Estimated Frequency}}{\text{Time in Cache (seconds)} + 1} \]
    *   **Estimated Frequency:** Obtained from an internal Count-Min Sketch, which tracks how often each item is accessed (`set` or `get`).
    *   **Time in Cache:** The duration since the item was last accessed or added.
3.  **Eviction:** The item from the sample with the *lowest* priority score is evicted. A lower score means it's either less frequent, has been in the cache for a longer time without recent access, or a combination of both.

This approach helps to retain items that are frequently accessed, even if they haven't been touched very recently, preventing them from being prematurely evicted by a burst of less important items.

## Inspiration and Further Reading

The caching strategy implemented in `hLRU` is heavily inspired by the concepts presented in the following paper: [Hyperbolic Caching: Flexible Caching for Web Applications](https://www.usenix.org/conference/atc17/technical-sessions/presentation/blankstein) (USENIX ATC '17)


This paper provides a detailed exploration of hyperbolic caching, its theoretical underpinnings, and various extensions.

## Benchmarks

The `hLRU` cache has been benchmarked against a standard `lru-cache` implementation.
Benchmarks are typically run using `node benchmarks/` from the `hLRU` directory.

**Example Benchmark Output Snippet (Your Mileage May Vary):**
*(Results after switching internal map to standard Map and tuning sampleSize)*

| Cache Implementation | Operation Type                         | Time Taken          | Hit Rate (Zipfian) |
|----------------------|----------------------------------------|---------------------|--------------------|
| `hLRU`               | Set (No Eviction, 1k items)            | ~2.32 ms            | -                  |
| **`lru-cache`**          | **Set (No Eviction, 1k items)**            | **~0.86 ms**        | **-**                  |
| `hLRU`               | Set (Forcing Eviction, 1k items)       | ~3.65 ms            | -                  |
| **`lru-cache`**          | **Set (Forcing Eviction, 1k items)**       | **~0.92 ms**        | **-**                  |
| **`hLRU`**               | **Get (All Hits, 1k items)**               | **~0.58 ms**        | **-**                  |
| `lru-cache`          | Get (All Hits, 1k items)               | ~0.76 ms            | -                  |
| **`hLRU`**               | **Get (All Misses, 1k items)**             | **~0.09 ms**        | **-**                  |
| `lru-cache`          | Get (All Misses, 1k items)             | ~0.13 ms            | -                  |
| **`hLRU`**               | **Get (Eviction, 1k items)**               | **~0.12 ms**        | **-**                  |
| `lru-cache`          | Get (Eviction, 1k items)               | ~0.17 ms            | -                  |
| **`hLRU`**               | **Has (All Hits, 1k items)**               | **~0.27 ms**        | **-**                  |
| `lru-cache`          | Has (All Hits, 1k items)               | ~0.57 ms            | -                  |
| **`hLRU`**               | **Has (All Misses, 1k items)**             | **~0.16 ms**        | **-**                  |
| `lru-cache`          | Has (All Misses, 1k items)             | ~0.24 ms            | -                  |
| `hLRU` (tuned `sampleSize` e.g. 5) | Zipfian Workload (10k ops, 100 cap)  | ~8.90 ms            | 72.29%             |
| `hLRU` (`sampleSize` = 50)        | **Zipfian Workload (10k ops, 100 cap)**  | ~26.0 ms        | **74.48%**         |
| `lru-cache`          | Zipfian Workload (10k ops, 100 cap)  | **~2.01 ms**        | 66.72%             |

**Observations from Benchmarks:**

*   **Raw Speed (Micro-benchmarks):**
    *   `lru-cache` is generally **faster** for `set` operations.
    *   `hLRU` now shows **faster** performance for most `get` and `has` operations in these micro-benchmarks.
*   **Zipfian Workload (Simulating Realistic Cache Usage):**
    *   With a tuned `sampleSize` (e.g., 5), `hLRU` achieves a **significantly higher hit rate (72.29%)** compared to `lru-cache` (66.72%) on this specific Zipfian workload. This comes at the cost of raw speed, with `hLRU` taking ~8.9 ms versus `lru-cache`'s **~2.01 ms**.
    *   Increasing `hLRU`'s `sampleSize` further (to 50 or 100) **further improves the hit rate (up to 74.62%)**. However, this makes the eviction process much slower (~26-43 ms), highlighting a clear trade-off between hit rate and operational latency. `lru-cache` is still much faster in terms of raw processing time for the same workload when comparing its baseline to these higher `sampleSize` `hLRU` runs.
*   **Trade-offs:**
    *   `hLRU`'s strength lies in its potential for **higher cache hit rates** in skewed access patterns (like Zipfian), thanks to its frequency-aware eviction strategy. This can be crucial for applications where the cost of a cache miss (e.g., fetching from a slow database) is high.
    *   `lru-cache` offers superior **raw speed** for `set` operations and overall workload completion when hit rate is not the primary concern.
    *   The `sampleSize` parameter in `hLRU` provides a knob to tune this trade-off: smaller `sampleSize` for faster operations but potentially lower hit rates; larger `sampleSize` for better hit rates but slower eviction decisions.

## License

MIT
