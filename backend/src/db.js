import fs from "fs";
import path from "path";

export class JsonDB {
  constructor(filePath) { this.filePath = filePath; this._load(); }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
        // Guard all arrays — existing DB files may be missing keys
        if (!Array.isArray(this.data.readings))   this.data.readings   = [];
        if (!Array.isArray(this.data.audit))       this.data.audit      = [];
        if (!Array.isArray(this.data.statements))  this.data.statements = [];
      } else {
        this.data = { readings: [], audit: [], statements: [] };
        this._save();
      }
    } catch (e) {
      console.error("[DB] Load error:", e.message);
      this.data = { readings: [], audit: [], statements: [] };
    }
  }

  _save() {
    try { fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2)); }
    catch (e) { console.error("[DB] Save error:", e.message); }
  }

  // ── Readings ────────────────────────────────────────────────────────────
  insertReading(reading)          { this._load(); this.data.readings.push(reading); this._save(); }
  getReadings(userId, limit = 200){ this._load(); return this.data.readings.filter(r => r.user_id === userId).sort((a,b) => b.server_ts - a.server_ts).slice(0, limit); }
  getAllReadings()                 { this._load(); return this.data.readings.sort((a,b) => b.server_ts - a.server_ts); }
  getLastReading(userId)          { this._load(); return this.data.readings.filter(r => r.user_id === userId).sort((a,b) => b.server_ts - a.server_ts)[0] || null; }
  getReadingsBefore(userId, ts)   { this._load(); return this.data.readings.filter(r => r.user_id === userId && r.server_ts < ts).sort((a,b) => b.server_ts - a.server_ts); }
  findReadingByHash(hash)         { this._load(); return this.data.readings.find(r => r.image_hash === hash) || null; }
  findReadingById(id, userId)     { this._load(); return this.data.readings.find(r => r.id === id && r.user_id === userId) || null; }
  findReadingByIdAdmin(id)        { this._load(); return this.data.readings.find(r => r.id === id) || null; }
  deleteReading(id)               { this._load(); this.data.readings = this.data.readings.filter(r => r.id !== id); this._save(); }
  deleteAllReadings()             { this._load(); this.data.readings = []; this._save(); }

  // ── Statements ──────────────────────────────────────────────────────────
  insertStatement(stmt)           { this._load(); this.data.statements.push(stmt); this._save(); }
  getStatements(userId)           { this._load(); return this.data.statements.filter(s => s.user_id === userId).sort((a,b) => b.server_ts - a.server_ts); }
  getAllStatements()               { this._load(); return this.data.statements.sort((a,b) => b.server_ts - a.server_ts); }
  findStatementByIdAdmin(id)      { this._load(); return this.data.statements.find(s => s.id === id) || null; }
  deleteStatement(id)             { this._load(); this.data.statements = this.data.statements.filter(s => s.id !== id); this._save(); }
  clearStatements()               { this._load(); this.data.statements = []; this._save(); }

  // ── Audit ────────────────────────────────────────────────────────────────
  insertAudit(entry) {
    this._load();
    this.data.audit.push(entry);
    if (this.data.audit.length > 1000) this.data.audit = this.data.audit.slice(-1000);
    this._save();
  }
  getAudit()   { this._load(); return this.data.audit.sort((a,b) => b.server_ts - a.server_ts); }
  clearAudit() { this._load(); this.data.audit = []; this._save(); }
}
