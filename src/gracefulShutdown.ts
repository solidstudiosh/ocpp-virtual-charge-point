import { VCP } from "./vcp";

// Configuration for different OCPP versions
export interface ShutdownConfig {
    // For OCPP 1.6
    connectorId?: number;
    // For OCPP 2.0.1 and 2.1  
    evseId?: number;
    connectorId201?: number;
}

// Helper function to send OCPP 1.6 StopTransaction
const sendStopTransactionOcpp16 = async (vcp: VCP, transactionId: any, transaction: any) => {
    try {
        // Import the stopTransaction message dynamically to avoid circular dependencies
        const { stopTransactionOcppMessage } = await import("./v16/messages/stopTransaction");

        vcp.send(
            stopTransactionOcppMessage.request({
                transactionId: transactionId,
                timestamp: new Date().toISOString(),
                meterStop: transaction.meterValue || 0,
                reason: "Other", // Shutdown reason
            })
        );
    } catch (error) {
        console.error(`❌ Error stopping OCPP 1.6 transaction ${transactionId}:`, error);
    }
};

// Helper function to send OCPP 2.0.1/2.1 TransactionEvent
const sendStopTransactionOcpp201 = async (vcp: VCP, transactionId: any, transaction: any, config: ShutdownConfig) => {
    try {
        // Import the transactionEvent message dynamically to avoid circular dependencies
        const { transactionEventOcppOutgoing } = await import("./v201/messages/transactionEvent");

        vcp.send(
            transactionEventOcppOutgoing.request({
                eventType: "Ended",
                timestamp: new Date().toISOString(),
                seqNo: 1,
                triggerReason: "ChargingStateChanged",
                transactionInfo: {
                    transactionId: transactionId,
                },
                evse: {
                    id: config.evseId ?? 1,
                    connectorId: config.connectorId201 ?? 1,
                },
                meterValue: [
                    {
                        timestamp: new Date().toISOString(),
                        sampledValue: [
                            {
                                value: transaction.meterValue || 0,
                                measurand: "Energy.Active.Import.Register",
                                unitOfMeasure: {
                                    unit: "kWh",
                                },
                            },
                        ],
                    },
                ],
            })
        );
    } catch (error) {
        console.error(`❌ Error stopping OCPP 2.0.1/2.1 transaction ${transactionId}:`, error);
    }
};// Function to send status notification for shutdown
export const sendShutdownStatus = (
    vcp: VCP,
    statusNotificationMessage: any,
    config: ShutdownConfig
) => {
    if (config.connectorId !== undefined) {
        // OCPP 1.6 format
        vcp.send(
            statusNotificationMessage.request({
                connectorId: config.connectorId,
                errorCode: "NoError",
                status: "Unavailable",
                timestamp: new Date().toISOString(),
            })
        );
    } else {
        // OCPP 2.0.1 and 2.1 format
        vcp.send(
            statusNotificationMessage.request({
                evseId: config.evseId ?? 1,
                connectorId: config.connectorId201 ?? 1,
                connectorStatus: "Unavailable",
                timestamp: new Date().toISOString(),
            })
        );
    }
};

// Common graceful shutdown handler
export const createGracefulShutdown = (
    vcp: VCP,
    statusNotificationMessage: any,
    config: ShutdownConfig,
    cleanupCallback?: () => void
) => {
    return async (signal: string) => {
        console.log(`\n📴 Received ${signal}, checking for active transactions...`);

        // Check for active transactions
        const activeTransactions = vcp.transactionManager.transactions.size;

        if (activeTransactions > 0) {
            console.log(`⚠️  WARNING: ${activeTransactions} active charging transaction(s) detected!`);
            console.log(`🔋 Shutdown blocked to prevent interrupting ongoing charging sessions.`);
            console.log(`💡 To force shutdown anyway, press Ctrl+Q within 10 seconds.`);
            console.log(`💡 To cancel shutdown, wait 10 seconds or press any other key.`);

            // Wait for special force confirmation (Ctrl+Q instead of Ctrl+C)
            const forceShutdown = await waitForForceConfirmation(10000);

            if (!forceShutdown) {
                console.log(`✅ Shutdown cancelled - charging sessions continue safely.`);
                console.log(`� Press Ctrl+C when no active transactions to shutdown gracefully.`);
                return;
            }

            console.log(`� FORCE SHUTDOWN CONFIRMED - This will interrupt active charging!`);
        }

        try {
            // Run any custom cleanup (e.g., stop meter readings)
            if (cleanupCallback) {
                cleanupCallback();
            }

            // Send "Unavailable" status to indicate charger is going offline
            sendShutdownStatus(vcp, statusNotificationMessage, config);

            if (activeTransactions > 0) {
                console.log(`⚠️  Charger taken offline with ${activeTransactions} active transaction(s) - these will remain incomplete!`);
            } else {
                console.log("✅ Charger taken offline gracefully");
            }

            // Ensure stdin is properly restored before exit
            try {
                if (process.stdin.isRaw) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause();
            } catch (e) {
                // Ignore cleanup errors
            }

            // Close the connection and exit immediately
            vcp.close();
            process.exit(0);

        } catch (error) {
            console.error("❌ Error during shutdown:", error);

            // Ensure stdin is restored even on error
            try {
                if (process.stdin.isRaw) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause();
            } catch (e) {
                // Ignore cleanup errors
            }

            process.exit(1);
        }
    };
};

// Wait for force confirmation (Ctrl+Q) during active transactions
const waitForForceConfirmation = (timeoutMs: number): Promise<boolean> => {
    return new Promise((resolve) => {
        let confirmed = false;
        let timeoutId: NodeJS.Timeout;

        // Define the key code constant for better readability
        const CTRL_Q_KEY_CODE = 17; // Ctrl+Q ASCII code

        const cleanup = () => {
            try {
                // Remove all data listeners
                process.stdin.removeAllListeners('data');

                // Only set raw mode to false if it was previously true
                if (process.stdin.isRaw) {
                    process.stdin.setRawMode(false);
                }

                // Pause stdin to prevent further input processing
                process.stdin.pause();

                clearTimeout(timeoutId);
            } catch (error) {
                // Ignore cleanup errors, just ensure we continue
                console.debug('Cleanup warning:', error);
            }
        };

        // Set up timeout
        timeoutId = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeoutMs);

        try {
            // Set up stdin to detect key presses
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', (key) => {
                const keyCode = key[0];

                // Check for Ctrl+Q using named constant
                if (keyCode === CTRL_Q_KEY_CODE) {
                    confirmed = true;
                    cleanup();
                    resolve(true);
                } else {
                    // Any other key cancels
                    cleanup();
                    resolve(false);
                }
            });
        } catch (error) {
            console.error('Error setting up key detection:', error);
            cleanup();
            resolve(false);
        }
    });
};// Register signal handlers for graceful shutdown
export const registerShutdownHandlers = (gracefulShutdown: (signal: string) => Promise<void>) => {
    process.on('SIGINT', () => {
        console.log('\n🛑 Interrupt signal received...');
        gracefulShutdown('SIGINT (Ctrl+C)');
    });

    process.on('SIGTERM', () => {
        gracefulShutdown('SIGTERM');
    });

    process.on('SIGHUP', () => {
        gracefulShutdown('SIGHUP');
    });

    // Handle unexpected exits
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
};
