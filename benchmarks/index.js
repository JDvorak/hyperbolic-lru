import b from 'nanobench';
import { HyperbolicLRUCache } from '../index.js';
import { LRUCache } from 'lru-cache'; // Import lru-cache
import zipfian from 'zipfian-integer'; // Import zipfian

const N = 1000; // Number of operations for some tests
const CAPACITY = 100;

// --- HyperbolicLRUCache Benchmarks ---

b(`hLRU: set ${N} items (no eviction)`, (bench) => {
    const cache = new HyperbolicLRUCache(N + 1);
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.end();
});

b(`hLRU: set ${N} items (forcing eviction)`, (bench) => {
    const cache = new HyperbolicLRUCache(CAPACITY);
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.end();
});

b(`hLRU: get ${N} items (all hits)`, (bench) => {
    const cache = new HyperbolicLRUCache(N);
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.get(`key${i}`);
    }
    bench.end();
});

b(`hLRU: get ${N} items (all misses)`, (bench) => {
    const cache = new HyperbolicLRUCache(CAPACITY);
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.get(`missingKey${i}`);
    }
    bench.end();
});

b(`hLRU: get ${N} items (likely many misses due to eviction)`, (bench) => {
    const cache = new HyperbolicLRUCache(CAPACITY);
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.get(`key${i}`);
    }
    bench.end();
});

b(`hLRU: has ${N} items (all hits)`, (bench) => {
    const cache = new HyperbolicLRUCache(N);
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.has(`key${i}`);
    }
    bench.end();
});

b(`hLRU: has ${N} items (all misses)`, (bench) => {
    const cache = new HyperbolicLRUCache(CAPACITY);
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.has(`missingKey${i}`);
    }
    bench.end();
});

// --- lru-cache Benchmarks ---
// Note: lru-cache uses 'max' for capacity

b(`lru-cache: set ${N} items (no eviction)`, (bench) => {
    const cache = new LRUCache({ max: N + 1 });
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.end();
});

b(`lru-cache: set ${N} items (forcing eviction)`, (bench) => {
    const cache = new LRUCache({ max: CAPACITY });
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.end();
});

b(`lru-cache: get ${N} items (all hits)`, (bench) => {
    const cache = new LRUCache({ max: N });
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.get(`key${i}`);
    }
    bench.end();
});

b(`lru-cache: get ${N} items (all misses)`, (bench) => {
    const cache = new LRUCache({ max: CAPACITY });
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.get(`missingKey${i}`);
    }
    bench.end();
});

b(`lru-cache: get ${N} items (likely many misses due to eviction)`, (bench) => {
    const cache = new LRUCache({ max: CAPACITY });
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.get(`key${i}`);
    }
    bench.end();
});

b(`lru-cache: has ${N} items (all hits)`, (bench) => {
    const cache = new LRUCache({ max: N });
    for (let i = 0; i < N; i++) {
        cache.set(`key${i}`, i);
    }
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.has(`key${i}`);
    }
    bench.end();
});

b(`lru-cache: has ${N} items (all misses)`, (bench) => {
    const cache = new LRUCache({ max: CAPACITY });
    bench.start();
    for (let i = 0; i < N; i++) {
        cache.has(`missingKey${i}`);
    }
    bench.end();
});

// --- Zipfian Distribution Benchmarks ---

const ZIPF_N_UNIQUE_KEYS = 500; // Number of unique items available
const ZIPF_SKEW = 1.0; // Skew factor (1.0 is typical for caches)
const ZIPF_N_OPERATIONS = 10000; // Number of get/set operations to perform
const ZIPF_CACHE_CAPACITY = 100; // Cache capacity for these tests

// Create a Zipfian distribution sampler
// It will generate integers between 0 and ZIPF_N_UNIQUE_KEYS - 1
const zipfSampler = zipfian(0, ZIPF_N_UNIQUE_KEYS - 1, ZIPF_SKEW);

// Generate a sequence of keys based on the distribution
const zipfKeySequence = [];
for (let i = 0; i < ZIPF_N_OPERATIONS; i++) {
    zipfKeySequence.push(`zipfKey${zipfSampler()}`);
}

// Helper function to run the Zipfian workload and measure hits/misses
function runZipfianWorkload(cache, name) {
    let hits = 0;
    let misses = 0;

    for (const key of zipfKeySequence) {
        const value = cache.get(key);
        if (value !== undefined) {
            hits++;
        } else {
            misses++;
            // On miss, set the value (simulating fetching/calculating it)
            cache.set(key, `valueFor_${key}`);
        }
    }
    const hitRate = (hits / (hits + misses)) * 100;
    console.log(`  ${name} - Hits: ${hits}, Misses: ${misses}, Hit Rate: ${hitRate.toFixed(2)}%`);
}

b(`hLRU: Zipfian workload (${ZIPF_N_OPERATIONS} ops, ${ZIPF_N_UNIQUE_KEYS} keys, capacity ${ZIPF_CACHE_CAPACITY}, skew ${ZIPF_SKEW})`, (bench) => {
    const cache = new HyperbolicLRUCache(ZIPF_CACHE_CAPACITY);
    bench.start();
    runZipfianWorkload(cache, 'hLRU');
    bench.end();
});

b(`hLRU: Max Hit Rate Zipfian (sampleSize=${ZIPF_CACHE_CAPACITY / 2}, ${ZIPF_N_OPERATIONS} ops, capacity ${ZIPF_CACHE_CAPACITY})`, (bench) => {
    const cache = new HyperbolicLRUCache(ZIPF_CACHE_CAPACITY, { sampleSize: ZIPF_CACHE_CAPACITY / 2 });
    bench.start();
    runZipfianWorkload(cache, `hLRU (sampleSize ${ZIPF_CACHE_CAPACITY / 2})`);
    bench.end();
});

b(`hLRU: Max Hit Rate Zipfian (sampleSize=${ZIPF_CACHE_CAPACITY}, ${ZIPF_N_OPERATIONS} ops, capacity ${ZIPF_CACHE_CAPACITY})`, (bench) => {
    const cache = new HyperbolicLRUCache(ZIPF_CACHE_CAPACITY, { sampleSize: ZIPF_CACHE_CAPACITY });
    bench.start();
    runZipfianWorkload(cache, `hLRU (sampleSize ${ZIPF_CACHE_CAPACITY})`);
    bench.end();
});

b(`lru-cache: Zipfian workload (${ZIPF_N_OPERATIONS} ops, ${ZIPF_N_UNIQUE_KEYS} keys, capacity ${ZIPF_CACHE_CAPACITY}, skew ${ZIPF_SKEW})`, (bench) => {
    const cache = new LRUCache({ max: ZIPF_CACHE_CAPACITY });
    bench.start();
    runZipfianWorkload(cache, 'lru-cache');
    bench.end();
}); 