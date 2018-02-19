let perf = typeof window !== 'undefined' ? window.performance : null;

// polyfill for browser performance module
if (!perf) {
    const start = Date.now();

    perf = {
        now() {
            return Date.now() - start;
        },
    };
}

export default perf;
