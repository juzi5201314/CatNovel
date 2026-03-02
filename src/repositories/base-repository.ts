import { getDatabase, runInTransaction, type AppDatabase } from "@/db/client";

export abstract class BaseRepository {
  protected readonly db: AppDatabase;

  protected constructor(database?: AppDatabase) {
    this.db = database ?? getDatabase();
  }

  protected transaction<T>(handler: (tx: AppDatabase) => T): T {
    return runInTransaction(handler);
  }
}
