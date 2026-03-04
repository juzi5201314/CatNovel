import {
  getChatSessionsDatabase,
  runInChatSessionsTransaction,
  type ChatSessionsDatabase,
} from "@/db/chat-sessions/client";

export abstract class ChatSessionsBaseRepository {
  protected readonly db: ChatSessionsDatabase;

  protected constructor(database?: ChatSessionsDatabase) {
    this.db = database ?? getChatSessionsDatabase();
  }

  protected transaction<T>(handler: (tx: ChatSessionsDatabase) => T): T {
    return runInChatSessionsTransaction(handler);
  }
}
