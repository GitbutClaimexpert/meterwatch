import fs from "fs/promises";
import path from "path";

export class JsonDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      readings: [],
      statements: [],
      audit: []
    };
    this._load();
  }

  async _load() {
    try {
      const content = await fs.readFile(this.filePath, "utf-8");
      this.data = JSON.parse(content);
      
      // Safety Checks: Ensure arrays exist even if the JSON file was old
      if (!Array.isArray(this.data.readings)) this.data.readings = [];
      if (!Array.isArray(this.data.statements)) this.data.statements = [];
      if (!Array.isArray(this.data.audit)) this.data.audit = [];
      
    } catch (err) {
      // If file doesn't exist, it will use the default empty arrays from constructor
      await this.save();
    }
  }

  async save() {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error("DB Save Error:", err);
    }
  }

  async insertReading(reading) {
    if (!Array.isArray(this.data.readings)) this.data.readings = [];
    this.data.readings.push(reading);
    await this.save();
  }

  async insertStatement(statement) {
    if (!Array.isArray(this.data.statements)) this.data.statements = [];
    this.data.statements.push(statement);
    await this.save();
  }

  async insertAudit(entry) {
    if (!Array.isArray(this.data.audit)) this.data.audit = [];
    this.data.audit.push(entry);
    await this.save();
  }
}
