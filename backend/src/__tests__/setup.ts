/**
 * Jest Test Setup
 * 
 * Global test configuration and utilities for WebSocket integration tests
 */

// Global error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Helper to wait for a condition with timeout
export const waitFor = async (
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
): Promise<void> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const result = await condition();
        if (result) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
};

// Helper to find an available port for testing
export const findAvailablePort = async (startPort: number = 3001): Promise<number> => {
    const net = require('net');

    return new Promise((resolve, reject) => {
        const server = net.createServer();

        server.listen(startPort, () => {
            const port = server.address()?.port;
            server.close(() => {
                resolve(port);
            });
        });

        server.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                // Try next port
                findAvailablePort(startPort + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
};

// Cleanup helper for tests
export const cleanup = async (cleanupFunctions: Array<() => Promise<void> | void>) => {
    for (const cleanupFn of cleanupFunctions) {
        try {
            await cleanupFn();
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
};
