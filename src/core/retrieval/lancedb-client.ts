import fs from "node:fs/promises";
import path from "node:path";

import { connect, type Connection, type Table } from "@lancedb/lancedb";

import { CHUNK_TABLE_NAME, type ChunkVectorRecord } from "./chunk-schema";

const DEFAULT_LANCEDB_URI = path.join(process.cwd(), ".data", "lancedb");

export type LanceDbClientOptions = {
  uri?: string;
  tableName?: string;
};

export class LanceDbClient {
  private readonly uri: string;
  private readonly tableName: string;
  private connectionPromise?: Promise<Connection>;

  constructor(options: LanceDbClientOptions = {}) {
    this.uri = options.uri ?? process.env.CATNOVEL_LANCEDB_URI ?? DEFAULT_LANCEDB_URI;
    this.tableName = options.tableName ?? CHUNK_TABLE_NAME;
  }

  async getConnection(): Promise<Connection> {
    if (!this.connectionPromise) {
      this.connectionPromise = (async () => {
        await fs.mkdir(this.uri, { recursive: true });
        return connect(this.uri);
      })();
    }
    return this.connectionPromise;
  }

  async openTableIfExists(): Promise<Table | null> {
    const connection = await this.getConnection();
    const tableNames = await connection.tableNames();
    if (!tableNames.includes(this.tableName)) {
      return null;
    }
    return connection.openTable(this.tableName);
  }

  async getOrCreateTable(seedRows: ChunkVectorRecord[]): Promise<Table> {
    const existingTable = await this.openTableIfExists();
    if (existingTable) {
      return existingTable;
    }

    const initialRows = [this.buildSeedRow(seedRows[0]), ...seedRows];
    const connection = await this.getConnection();
    const table = await connection.createTable(this.tableName, initialRows);
    await table.delete("project_id = '__seed__'");
    return table;
  }

  private buildSeedRow(source?: ChunkVectorRecord): ChunkVectorRecord {
    const seedVector =
      source && Array.isArray(source.vector) && source.vector.length > 0
        ? source.vector.map((value) => Number(value))
        : [0];

    return {
      project_id: "__seed__",
      chapter_no: -1,
      chapter_id: "__seed__",
      chunk_id: "__seed__",
      chunk_type: "summary",
      entity_ids: ["__seed_entity__"],
      position_in_chapter: -1,
      updated_at: new Date(0).toISOString(),
      vector: seedVector,
      text: "seed",
    };
  }
}
