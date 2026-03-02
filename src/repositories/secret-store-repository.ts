import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { secretStore } from "@/db/schema";
import { SecretCrypto } from "@/lib/crypto/secret-crypto";

import { BaseRepository } from "./base-repository";

export type SecretRecord = {
  id: string;
  keyVersion: number;
};

export class SecretStoreRepository extends BaseRepository {
  private readonly crypto: SecretCrypto;

  constructor(database?: AppDatabase, crypto = new SecretCrypto()) {
    super(database);
    this.crypto = crypto;
  }

  createSecret(plainText: string, keyVersion = 1): SecretRecord {
    const id = crypto.randomUUID();
    const encrypted = this.crypto.encrypt(plainText, keyVersion);

    this.db
      .insert(secretStore)
      .values({
        id,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        tag: encrypted.tag,
        keyVersion: encrypted.keyVersion,
      })
      .run();

    return { id, keyVersion: encrypted.keyVersion };
  }

  readPlaintext(id: string): string | null {
    const row = this.db
      .select()
      .from(secretStore)
      .where(eq(secretStore.id, id))
      .get();

    if (!row) {
      return null;
    }

    return this.crypto.decrypt({
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      tag: row.tag,
    });
  }

  rotateSecret(id: string, plainText: string, newKeyVersion: number): boolean {
    const encrypted = this.crypto.encrypt(plainText, newKeyVersion);
    const result = this.db
      .update(secretStore)
      .set({
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        tag: encrypted.tag,
        keyVersion: newKeyVersion,
        updatedAt: new Date(),
      })
      .where(eq(secretStore.id, id))
      .run();

    return result.changes > 0;
  }
}
