import { HyperbolicLRUCache } from './index.js';

let testCount = 0;
let passCount = 0;
let testsCompleted = 0;
let allTestsQueued = false;

async function test(name, fn) {
    testCount++;
    const currentTestNumber = testCount;
    try {
        await fn();
        passCount++;
        console.log(`ok ${currentTestNumber} - ${name}`);
    } catch (e) {
        console.log(`not ok ${currentTestNumber} - ${name}`);
        const errorStack = e.stack || e.toString();
        console.error(errorStack.split('\n').map(line => `  # ${line.trim()}`).join('\n'));
    } finally {
        testsCompleted++;
        if (allTestsQueued && testsCompleted === testCount) {
            summary();
        }
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: Expected ${expected}, but got ${actual}`);
    }
}

function assertTruthy(value, message) {
    if (!value) {
        throw new Error(`${message}: Expected truthy, but got ${value}`);
    }
}

function assertFalsy(value, message) {
    if (value) {
        throw new Error(`${message}: Expected falsy, but got ${value}`);
    }
}

console.log('TAP version 13');


(async () => {
    await test('Create cache with positive capacity', () => {
        const cache = new HyperbolicLRUCache(10);
        assertTruthy(cache, 'Cache instance should be created');
        assertEquals(cache.capacity, 10, 'Cache capacity should be set');
    });

    await test('Throws error for zero or negative capacity', () => {
        let errored = false;
        try {
            new HyperbolicLRUCache(0);
        } catch (e) {
            errored = true;
            assertTruthy(e.message.includes('Capacity must be positive'), 'Error message for zero capacity');
        }
        assertTruthy(errored, 'Error should be thrown for zero capacity');

        errored = false;
        try {
            new HyperbolicLRUCache(-5);
        } catch (e) {
            errored = true;
            assertTruthy(e.message.includes('Capacity must be positive'), 'Error message for negative capacity');
        }
        assertTruthy(errored, 'Error should be thrown for negative capacity');
    });

    await test('Set and get a single item', () => {
        const cache = new HyperbolicLRUCache(5);
        cache.set('key1', 'value1');
        assertEquals(cache.get('key1'), 'value1', 'Should retrieve the correct value');
        assertEquals(cache.size(), 1, 'Size should be 1');
    });

    await test('Set and get multiple items within capacity', () => {
        const cache = new HyperbolicLRUCache(3);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        assertEquals(cache.get('a'), 1, 'Value for key a');
        assertEquals(cache.get('b'), 2, 'Value for key b');
        assertEquals(cache.get('c'), 3, 'Value for key c');
        assertEquals(cache.size(), 3, 'Size should be 3');
    });

    await test('Update an existing item', () => {
        const cache = new HyperbolicLRUCache(5);
        cache.set('key1', 'value1');
        cache.set('key1', 'valueUpdated');
        assertEquals(cache.get('key1'), 'valueUpdated', 'Should retrieve the updated value');
        assertEquals(cache.size(), 1, 'Size should remain 1 after update');
    });

    await test('Get a non-existent item returns undefined', () => {
        const cache = new HyperbolicLRUCache(5);
        assertFalsy(cache.get('missingKey'), 'Getting a missing key should return undefined');
    });

    await test('Cache does not exceed capacity - simple eviction', () => {
        const cache = new HyperbolicLRUCache(2);
        cache.set('key1', 'val1');
        cache.set('key2', 'val2');
        assertEquals(cache.size(), 2, 'Cache size should be 2 before exceeding capacity');
        cache.set('key3', 'val3');
        assertEquals(cache.size(), 2, 'Cache size should remain 2 after eviction');
        assertTruthy(cache.get('key3') === 'val3', 'The newly added item (key3) should be present');
    });

    await test('onEvict callback is triggered', () => {
        let evictedKey = null;
        let evictedValue = null;
        const onEvict = (key, value) => {
            evictedKey = key;
            evictedValue = value;
        };
        const cache = new HyperbolicLRUCache(1, { onEvict });
        cache.set('a', 100);
        cache.set('b', 200);

        assertTruthy(evictedKey === 'a' || evictedKey === 'b', 'Evicted key should be one of the set keys');
        if (evictedKey === 'a') {
            assertEquals(evictedValue, 100, 'Evicted value for key a');
        }
        assertEquals(evictedKey, 'a', 'Actually, key \'a\' must have been evicted.'); 
        assertEquals(cache.size(), 1, 'Cache size should be 1 after eviction');
        assertTruthy(cache.get('b') === 200, 'Key \'b\' should be present');
    });

    await test('has method returns correct boolean', () => {
        const cache = new HyperbolicLRUCache(2);
        cache.set('k1', 'v1');
        assertTruthy(cache.has('k1'), 'has should return true for existing key');
        assertFalsy(cache.has('k2'), 'has should return false for non-existing key');
        cache.set('k2', 'v2');
        assertTruthy(cache.has('k2'), 'has should return true for newly added key');
    });

    await test('clear method empties the cache', () => {
        const cache = new HyperbolicLRUCache(3);
        cache.set('x', 1);
        cache.set('y', 2);
        cache.clear();
        assertEquals(cache.size(), 0, 'Size should be 0 after clear');
        assertFalsy(cache.get('x'), 'Getting cleared key x should return undefined');
        assertFalsy(cache.has('y'), 'Has for cleared key y should return false');
    });

    await test('size method updates correctly', () => {
        const cache = new HyperbolicLRUCache(10);
        assertEquals(cache.size(), 0, 'Initial size should be 0');
        cache.set('item1', 'data1');
        assertEquals(cache.size(), 1, 'Size after 1 set');
        cache.set('item2', 'data2');
        assertEquals(cache.size(), 2, 'Size after 2 sets');
        cache.set('item1', 'updatedData1');
        assertEquals(cache.size(), 2, 'Size after updating existing item');
        cache.clear();
        assertEquals(cache.size(), 0, 'Size after clear');
    });

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    await test('cleanup method evicts old items', async () => {
        let evictedItems = {};
        const onEvict = (key, value) => { evictedItems[key] = value; };
        const cache = new HyperbolicLRUCache(5, { onEvict });

        cache.set('old1', 'data_old1');
        await delay(20);
        cache.set('new1', 'data_new1');
        await delay(20);
        cache.set('old2', 'data_old2');
        await delay(20);
        cache.set('new2', 'data_new2');

        assertEquals(cache.size(), 4, 'Size before cleanup');
        
        await delay(1);
        cache.cleanup(35);

        assertEquals(cache.size(), 2, 'Size after cleanup (new2, old2 should remain)');
        assertFalsy(cache.has('old1'), 'old1 should be cleaned up');
        assertTruthy(evictedItems['old1'] === 'data_old1', 'onEvict for old1');
        assertFalsy(cache.has('new1'), 'new1 should be cleaned up');
        assertTruthy(evictedItems['new1'] === 'data_new1', 'onEvict for new1');
        assertTruthy(cache.has('old2'), 'old2 should remain');
        assertTruthy(cache.has('new2'), 'new2 should remain');
    });

    await test('Set operations with capacity 1', () => {
        const cache = new HyperbolicLRUCache(1);
        cache.set('first', 'f_val');
        assertEquals(cache.get('first'), 'f_val', 'First item in capacity 1 cache');
        cache.set('second', 's_val');
        assertEquals(cache.get('second'), 's_val', 'Second item should replace first');
        assertFalsy(cache.get('first'), 'First item should be evicted');
        assertEquals(cache.size(), 1, 'Size should remain 1');
    });

    await test('Sketch integration basic check - frequently accessed less likely to be evicted early', () => {
        const cache = new HyperbolicLRUCache(3, { sampleSize: 3 }); 
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);

        for (let i = 0; i < 20; i++) {
            cache.get('a');
        }
        for (let i = 0; i < 5; i++) {
            cache.get('b');
        }

        let aEvictedCount = 0;
        const runs = 10;

        for (let run = 0; run < runs; run++) {
            const freshCache = new HyperbolicLRUCache(3, { sampleSize: 3 });
            freshCache.set('itemA', 'A');
            freshCache.set('itemB', 'B');
            freshCache.set('itemC', 'C');

            for (let i = 0; i < 20; i++) freshCache.get('itemA');
            for (let i = 0; i < 5; i++) freshCache.get('itemB');

            let evictedKeyOnD = null;
            freshCache.onEvict = (key, value) => { evictedKeyOnD = key; };
            freshCache.set('itemD', 'D');

            if (evictedKeyOnD === 'itemA') {
                aEvictedCount++;
            }
        }
        assertEquals(aEvictedCount, 0, `Item A (most frequent) should not be evicted when sampleSize is capacity (got: ${aEvictedCount}/${runs})`);
    });

    summary();

})();

function summary() {
    console.log(`\n1..${testCount}`);
    console.log(`# tests ${testCount}`);
    console.log(`# pass  ${passCount}`);
    if (testCount !== passCount) {
        console.log(`# fail  ${testCount - passCount}`);
        process.exitCode = 1;
    }
}

allTestsQueued = true;
if (testsCompleted === testCount && testCount > 0) {
    summary();
} 