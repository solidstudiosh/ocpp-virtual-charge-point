import { VCP } from "./vcp";

// OCPP 1.6 meter reading interface
export interface MeterReading16 {
    connectorId: number;
    meterValue: Array<{
        timestamp: string;
        sampledValue: Array<{
            value: string;
            measurand: string;
            phase?: string;
            unit: string;
        }>;
    }>;
}

// OCPP 2.0.1/2.1 meter reading interface
export interface MeterReading201 {
    evseId: number;
    meterValue: Array<{
        timestamp: string;
        sampledValue: Array<{
            value: number;
            measurand?: string;
            phase?: string;
            unitOfMeasure?: {
                unit: string;
            };
        }>;
    }>;
}

export class MeterReadingsManager {
    private totalEnergyKwh = 0;
    private interval: NodeJS.Timeout | null = null;

    constructor(
        private vcp: VCP,
        private meterValuesMessage: any,
        private isOcpp16: boolean = false,
        private connectorId: number = 101,
        private evseId: number = 1
    ) { }

    // Check if there are active transactions
    private hasActiveTransactions(): boolean {
        // Access the transaction manager to check for active transactions
        return this.vcp.transactionManager.transactions.size > 0;
    }

    // Generate realistic Tesla Wall Connector readings
    private generateMeterData() {
        // Check if we're in idle state (no transactions)
        const isIdle = !this.hasActiveTransactions();

        // Get max current and voltage from environment variables
        const maxCurrent = Number(process.env.MAX_CURRENT_A ?? "32");
        const baseVoltage = Number(process.env.VOLTAGE_V ?? "230");

        let currentL1: number, currentL2: number, currentL3: number, power: number, soc: number;

        if (isIdle) {
            // Idle state: minimal standby current and power
            currentL1 = Number((Math.random() * 0.5).toFixed(1)); // 0-0.5A standby
            currentL2 = Number((Math.random() * 0.5).toFixed(1));
            currentL3 = Number((Math.random() * 0.5).toFixed(1));

            // Minimal standby power (charger electronics, etc.)
            power = Number((Math.random() * 20 + 10).toFixed(0)); // 10-30W standby

            // No vehicle connected or SoC not available when idle
            soc = 0; // or could be null/undefined
        } else {
            // This should not happen: MeterReadingsManager only runs when idle
            // During transactions, meter readings are handled by TransactionManager
            console.warn("⚠️ MeterReadingsManager unexpectedly called during transaction");

            // Fallback values (should not be used)
            currentL1 = 0;
            currentL2 = 0;
            currentL3 = 0;
            power = 0;
            soc = 0;
        }

        // Voltage with ±5% variation (always present)
        const voltage = Number((baseVoltage + (Math.random() - 0.5) * baseVoltage * 0.1).toFixed(1));

        // Energy accumulation: only for standby power when idle, or reset when transactions change state
        if (isIdle) {
            // Minimal energy accumulation for standby power
            this.totalEnergyKwh += (power / 1000) * (30 / 3600); // Very small accumulation
        }
        // Note: When transactions are active, energy is handled by TransactionManager

        return {
            currentL1,
            currentL2,
            currentL3,
            voltage,
            power,
            soc,
            totalEnergyKwh: Number(this.totalEnergyKwh.toFixed(3))
        };
    }

    // Create OCPP 1.6 format meter readings
    private createOcpp16MeterReading(data: ReturnType<typeof this.generateMeterData>): MeterReading16 {
        return {
            connectorId: this.connectorId,
            meterValue: [
                {
                    timestamp: new Date().toISOString(),
                    sampledValue: [
                        {
                            value: data.currentL1.toString(),
                            measurand: "Current.Import",
                            phase: "L1",
                            unit: "A",
                        },
                        {
                            value: data.currentL2.toString(),
                            measurand: "Current.Import",
                            phase: "L2",
                            unit: "A",
                        },
                        {
                            value: data.currentL3.toString(),
                            measurand: "Current.Import",
                            phase: "L3",
                            unit: "A",
                        },
                        {
                            value: data.voltage.toString(),
                            measurand: "Voltage",
                            unit: "V",
                        },
                        {
                            value: data.power.toString(),
                            measurand: "Power.Active.Import",
                            unit: "W",
                        },
                        {
                            value: data.totalEnergyKwh.toString(),
                            measurand: "Energy.Active.Import.Register",
                            unit: "kWh",
                        },
                        {
                            value: data.soc.toString(),
                            measurand: "SoC",
                            unit: "Percent",
                        },
                    ],
                },
            ],
        };
    }

    // Create OCPP 2.0.1/2.1 format meter readings
    private createOcpp201MeterReading(data: ReturnType<typeof this.generateMeterData>): MeterReading201 {
        return {
            evseId: this.evseId,
            meterValue: [
                {
                    timestamp: new Date().toISOString(),
                    sampledValue: [
                        {
                            value: data.currentL1,
                            measurand: "Current.Import",
                            phase: "L1",
                            unitOfMeasure: { unit: "A" },
                        },
                        {
                            value: data.currentL2,
                            measurand: "Current.Import",
                            phase: "L2",
                            unitOfMeasure: { unit: "A" },
                        },
                        {
                            value: data.currentL3,
                            measurand: "Current.Import",
                            phase: "L3",
                            unitOfMeasure: { unit: "A" },
                        },
                        {
                            value: data.voltage,
                            measurand: "Voltage",
                            unitOfMeasure: { unit: "V" },
                        },
                        {
                            value: data.power,
                            measurand: "Power.Active.Import",
                            unitOfMeasure: { unit: "W" },
                        },
                        {
                            value: data.totalEnergyKwh,
                            measurand: "Energy.Active.Import.Register",
                            unitOfMeasure: { unit: "kWh" },
                        },
                        {
                            value: data.soc,
                            measurand: "SoC",
                            unitOfMeasure: { unit: "%" },
                        },
                    ],
                },
            ],
        };
    }

    // Send meter readings (only when no active transactions)
    public sendMeterReadings = () => {
        // Skip sending meter readings if there are active transactions
        // The transaction manager will handle meter readings during transactions
        if (this.hasActiveTransactions()) {
            console.log(`📊 Skipping meter readings - transaction in progress`);
            return;
        }

        const data = this.generateMeterData();

        const meterReading = this.isOcpp16
            ? this.createOcpp16MeterReading(data)
            : this.createOcpp201MeterReading(data);

        this.vcp.send(this.meterValuesMessage.request(meterReading));

        console.log(`📊 Idle meter readings: ${data.currentL1}A/${data.currentL2}A/${data.currentL3}A, ${data.voltage}V, ${data.power}W, ${data.totalEnergyKwh}kWh, SoC:${data.soc}%`);
    };

    // Start periodic meter readings
    public start(intervalMs: number = 30000) {
        console.log(`📊 Starting meter readings every ${intervalMs / 1000} seconds (when no transactions)...`);
        this.interval = setInterval(this.sendMeterReadings, intervalMs);

        // Send initial reading after a short delay
        setTimeout(this.sendMeterReadings, 2000);
    }

    // Stop meter readings
    public stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    // Check if running
    public isRunning(): boolean {
        return this.interval !== null;
    }
}
