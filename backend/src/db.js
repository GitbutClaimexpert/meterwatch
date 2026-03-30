/**
 * Simple JSON file-based database — no native compilation needed
 * Replaces better-sqlite3 for Railway compatibility
 */
import fs from "fs";
import path from "path";

export class JsonDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { readings: [], statements: [], audit_log: [] };
    this._load();
  }

  _load() {
    if (fs.existsSync(this.filePath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
        if (!this.data.readings) this.data.readings = [];
        if (!this.data.statements) this.data.statements = [];
        if (!this.data.audit_log) this.data.audit_log = [];
      } catch { this.data = { readings: [], statements: [], audit_log: [] }; }
    }
  }

  _save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  // Readings
  insertReading(r) {
    this.data.readings.push(r);
    this._save();
  }

  getReadings(userId, limit = 200) {
    return this.data.readings
      .filter(r => r.user_id === userId)
      .sort((a, b) => b.server_ts - a.server_ts)
      .slice(0, limit);
  }

  getLastReading(userId) {
    return this.data.readings
      .filter(r => r.user_id === userId)
      .sort((a, b) => b.server_ts - a.server_ts)[0] || null;
  }

  findReadingByHash(hash) {
    return this.data.readings.find(r => r.image_hash === hash) || null;
  }

  findReadingById(id, userId) {
    return this.data.readings.find(r => r.id === id && r.user_id === userId) || null;
  }

  getReadingsBefore(userId, ts) {
    return this.data.readings
      .filter(r => r.user_id === userId && r.server_ts < ts)
      .sort((a, b) => b.server_ts - a.server_ts);
  }

  getAllReadingsAsc(userId) {
    return this.data.readings
      .filter(r => r.user_id === userId)
      .sort((a, b) => a.server_ts - b.server_ts);
  }

  // Statements
  insertStatement(s) {
    this.data.statements.push(s);
    this._save();
  }

  getStatements(userId) {
    return this.data.statements
      .filter(s => s.user_id === userId)
      .sort((a, b) => b.server_ts - a.server_ts);
  }

  // Audit
  insertAudit(entry) {
    this.data.audit_log.push(entry);
    this._save();
  }

  getAudit(limit = 500) {
    return this.data.audit_log
      .sort((a, b) => b.server_ts - a.server_ts)
      .slice(0, limit);
  }
}
