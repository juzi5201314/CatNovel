import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type BinaryLike,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALGORITHM = "aes-256-gcm";
const NONCE_SIZE = 12;
const REQUIRED_KEY_BYTES = 32;
const DEV_KEY_PATH = path.join(process.cwd(), ".data", "dev-secret.key");

let cachedDevKey: Buffer | null = null;
let hasLoggedDevFallback = false;

export type EncryptedSecret = {
  ciphertext: string;
  nonce: string;
  tag: string;
  keyVersion: number;
};

function decodeBase64Key(raw: string): Buffer | null {
  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.byteLength === REQUIRED_KEY_BYTES) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

function decodeHexKey(raw: string): Buffer | null {
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    return null;
  }
  const decoded = Buffer.from(raw, "hex");
  if (decoded.byteLength !== REQUIRED_KEY_BYTES) {
    return null;
  }
  return decoded;
}

function decodeUtf8Key(raw: string): Buffer | null {
  const decoded = Buffer.from(raw, "utf8");
  if (decoded.byteLength !== REQUIRED_KEY_BYTES) {
    return null;
  }
  return decoded;
}

function decodeAnyKey(raw: string): Buffer | null {
  return (
    decodeBase64Key(raw) ??
    decodeHexKey(raw) ??
    decodeUtf8Key(raw)
  );
}

function isProductionMode(): boolean {
  return (process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

function readDevKeyFromFile(): Buffer | null {
  if (!fs.existsSync(DEV_KEY_PATH)) {
    return null;
  }

  const raw = fs.readFileSync(DEV_KEY_PATH, "utf8").trim();
  const decoded = decodeAnyKey(raw);
  if (!decoded) {
    throw new Error(
      `Invalid dev secret key at ${DEV_KEY_PATH}; delete this file to regenerate`,
    );
  }

  return decoded;
}

function writeDevKeyToFile(key: Buffer): void {
  fs.mkdirSync(path.dirname(DEV_KEY_PATH), { recursive: true });
  fs.writeFileSync(DEV_KEY_PATH, key.toString("base64"), { mode: 0o600 });
}

function resolveDevelopmentSecretKey(): Buffer {
  if (cachedDevKey) {
    return cachedDevKey;
  }

  const existing = readDevKeyFromFile();
  if (existing) {
    cachedDevKey = existing;
    return cachedDevKey;
  }

  const generated = randomBytes(REQUIRED_KEY_BYTES);
  writeDevKeyToFile(generated);
  cachedDevKey = generated;
  return cachedDevKey;
}

export function resolveSecretKey(rawKey: string | undefined): Buffer {
  if (!rawKey || rawKey.trim().length === 0) {
    if (isProductionMode()) {
      throw new Error("CATNOVEL_SECRET_KEY is required");
    }

    const devKey = resolveDevelopmentSecretKey();
    if (!hasLoggedDevFallback) {
      console.warn(
        "[secret-crypto] CATNOVEL_SECRET_KEY is missing; using persisted dev key at .data/dev-secret.key",
      );
      hasLoggedDevFallback = true;
    }
    return devKey;
  }

  const normalized = rawKey.trim();
  const decoded = decodeAnyKey(normalized);

  if (!decoded) {
    throw new Error(
      "CATNOVEL_SECRET_KEY must decode to 32 bytes (base64/hex/utf8)",
    );
  }

  return decoded;
}

export class SecretCrypto {
  private readonly key: BinaryLike;

  constructor(rawKey = process.env.CATNOVEL_SECRET_KEY) {
    this.key = resolveSecretKey(rawKey);
  }

  encrypt(plainText: string, keyVersion = 1): EncryptedSecret {
    const nonce = randomBytes(NONCE_SIZE);
    const cipher = createCipheriv(ALGORITHM, this.key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plainText, "utf8")),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString("base64"),
      nonce: nonce.toString("base64"),
      tag: tag.toString("base64"),
      keyVersion,
    };
  }

  decrypt(payload: Omit<EncryptedSecret, "keyVersion">): string {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(payload.nonce, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);
    return clear.toString("utf8");
  }
}
