import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type BinaryLike,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const NONCE_SIZE = 12;
const REQUIRED_KEY_BYTES = 32;

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

export function resolveSecretKey(rawKey: string | undefined): Buffer {
  if (!rawKey || rawKey.trim().length === 0) {
    throw new Error("CATNOVEL_SECRET_KEY is required");
  }

  const normalized = rawKey.trim();
  const decoded =
    decodeBase64Key(normalized) ??
    decodeHexKey(normalized) ??
    decodeUtf8Key(normalized);

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
