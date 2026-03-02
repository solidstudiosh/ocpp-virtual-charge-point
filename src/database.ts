import Database from "better-sqlite3";
import path from "node:path";
import { logger } from "./logger";

const dbPath = path.resolve(process.cwd(), "vcp.db");
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    transactionId TEXT PRIMARY KEY,
    idTag TEXT NOT NULL,
    connectorId INTEGER NOT NULL,
    evseId INTEGER,
    startedAt TEXT NOT NULL,
    meterValue REAL DEFAULT 0,
    status TEXT DEFAULT 'Active'
  );

  CREATE TABLE IF NOT EXISTS ocpp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    direction TEXT NOT NULL, -- 'IN' or 'OUT'
    messageType INTEGER NOT NULL, -- 2, 3, or 4
    messageId TEXT NOT NULL,
    action TEXT,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cp_configuration (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    readonly INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    message TEXT NOT NULL
  );
`);

logger.info(`Database initialized at ${dbPath}`);

export interface DbTransaction {
  transactionId: string;
  idTag: string;
  connectorId: number;
  evseId?: number;
  startedAt: string;
  meterValue: number;
  status: string;
}

export const dbService = {
  // Transactions
  saveTransaction: (tx: DbTransaction) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO transactions (transactionId, idTag, connectorId, evseId, startedAt, meterValue, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(tx.transactionId, tx.idTag, tx.connectorId, tx.evseId || null, tx.startedAt, tx.meterValue, tx.status);
  },

  updateTransactionMeter: (transactionId: string | number, meterValue: number) => {
    const stmt = db.prepare("UPDATE transactions SET meterValue = ? WHERE transactionId = ?");
    stmt.run(meterValue, transactionId.toString());
  },

  closeTransaction: (transactionId: string | number) => {
    const stmt = db.prepare("UPDATE transactions SET status = 'Completed' WHERE transactionId = ?");
    stmt.run(transactionId.toString());
  },

  getActiveTransactions: (): DbTransaction[] => {
    return db.prepare("SELECT * FROM transactions WHERE status = 'Active'").all() as DbTransaction[];
  },

  // OCPP Messages
  logMessage: (direction: "IN" | "OUT", messageType: number, messageId: string, action: string | undefined, payload: any) => {
    const stmt = db.prepare(`
      INSERT INTO ocpp_messages (direction, messageType, messageId, action, payload)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(direction, messageType, messageId, action, JSON.stringify(payload));
  },

  getRecentMessages: (limit = 100) => {
    return db.prepare("SELECT * FROM ocpp_messages ORDER BY id DESC LIMIT ?").all(limit);
  },

  // Security Events
  logSecurityEvent: (type: string, message: string) => {
    const stmt = db.prepare(`
      INSERT INTO security_events (type, message)
      VALUES (?, ?)
    `);
    stmt.run(type, message);
  },

  getSecurityEvents: (limit = 100) => {
    return db.prepare("SELECT * FROM security_events ORDER BY id DESC LIMIT ?").all(limit);
  }
};
