import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { secretStore } from "@/db/schema";
import { SecretCrypto } from "@/lib/crypto/secret-crypto";

import { BaseRepository } from "./base-repository";

export type SecretRecord = {
  id: string;
  keyVersion: number;
};

export type SecretMetaRecord = SecretRecord;

export class SecretStoreRepository extends BaseRepository {
  private crypto?: SecretCrypto;

  constructor(database?: AppDatabase, crypto?: SecretCrypto) {
    super(database);
    this.crypto = crypto;
  }

  private getCrypto(): SecretCrypto {
    if (!this.crypto) {
      this.crypto = new SecretCrypto();
    }
    return this.crypto;
  }

  createSecret(plainText: string, keyVersion = 1): SecretRecord {
    const id = crypto.randomUUID();
    const encrypted = this.getCrypto().encrypt(plainText, keyVersion);

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

  getSecretMeta(id: string): SecretMetaRecord | null {
    const row = this.db
      .select({ id: secretStore.id, keyVersion: secretStore.keyVersion })
      .from(secretStore)
      .where(eq(secretStore.id, id))
      .get();
    return row ?? null;
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

    return this.getCrypto().decrypt({
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      tag: row.tag,
    });
  }

  rotateSecret(id: string, plainText: string, newKeyVersion: number): boolean {
    const encrypted = this.getCrypto().encrypt(plainText, newKeyVersion);
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
