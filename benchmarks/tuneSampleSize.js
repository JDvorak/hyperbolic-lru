import { HyperbolicLRUCache } from '../index.js';
import zipfian from 'zipfian-integer';
import { performance } from 'perf_hooks';

// --- Configuration for Tuning ---
const SAMPLE_SIZES_TO_TEST = [2, 3, 4, 5, 8, 10, 12, 16, 20, 24, 32]; // Add or modify as needed

// --- Zipfian Workload Parameters (consistent with main benchmark) ---
const ZIPF_N_UNIQUE_KEYS = 500;
const ZIPF_SKEW = 1.0;
const ZIPF_N_OPERATIONS = 10000;
const ZIPF_CACHE_CAPACITY = 100;
const SKETCH_EPSILON = 0.01;
const SKETCH_DELTA = 0.01;

// --- Helper: Generate Zipfian Key Sequence ---
const zipfSampler = zipfian(0, ZIPF_N_UNIQUE_KEYS - 1, ZIPF_SKEW);
const zipfKeySequence = [];
for (let i = 0; i < ZIPF_N_OPERATIONS; i++) {
    zipfKeySequence.push(`zipfKey${zipfSampler()}`);
}

// --- Helper: Run Workload for a given sampleSize ---
async function testSampleSize(sampleSize) {
    const cache = new HyperbolicLRUCache(ZIPF_CACHE_CAPACITY, {
        sampleSize: sampleSize,
        sketchEpsilon: SKETCH_EPSILON,
        sketchDelta: SKETCH_DELTA
    });

    let hits = 0;
    let misses = 0;

    const startTime = performance.now();

    for (const key of zipfKeySequence) {
        const value = cache.get(key);
        if (value !== undefined) {
            hits++;
        } else {
            misses++;
            cache.set(key, `valueFor_${key}`);
        }
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const hitRate = (hits / (hits + misses)) * 100;

    return {
        sampleSize,
        durationMs,
        hits,
        misses,
        hitRate
    };
}

// --- Main Tuning Logic ---
async function runTuning() {
    console.log('--- HyperbolicLRUCache sampleSize Tuning ---');
    console.log(`Workload: ${ZIPF_N_OPERATIONS} ops, ${ZIPF_N_UNIQUE_KEYS} unique keys, capacity ${ZIPF_CACHE_CAPACITY}, skew ${ZIPF_SKEW}`);
    console.log('\nResults:');
    console.log('SampleSize | Duration (ms) | Hit Rate (%) | Hits    | Misses ');
    console.log('-----------|---------------|--------------|---------|---------');

    for (const size of SAMPLE_SIZES_TO_TEST) {
        // Small delay to allow any previous console output to flush, and give a slight breather
        // This is mostly for cleaner console output during rapid iterations.
        await new Promise(resolve => setTimeout(resolve, 50)); 
        
        // Clear console log from previous hLRU sketch creation if any
        // This is a bit of a hack; ideally, the HyperbolicLRUCache wouldn't log to console during creation.
        // If the `console.log` in HyperbolicLRUCache constructor is removed, this line isn't strictly necessary.
        // process.stdout.write('\x1B[1A\x1B[K'); // Moves cursor up one line and clears it, might not work everywhere

        const result = await testSampleSize(size);
        console.log(
            `${String(result.sampleSize).padStart(10)} | ` +
            `${result.durationMs.toFixed(2).padStart(13)} | ` +
            `${result.hitRate.toFixed(2).padStart(12)} | ` +
            `${String(result.hits).padStart(7)} | ` +
            `${String(result.misses).padStart(7)}`
        );
    }
    console.log('\n--- Tuning Complete ---');
}

runTuning().catch(console.error); 