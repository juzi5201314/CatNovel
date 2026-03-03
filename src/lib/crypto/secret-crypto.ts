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
const SECRET_ENV_KEY = "CATNOVEL_SECRET_KEY";
const DEFAULT_SECRET_FILE_PATH = path.join(process.cwd(), ".data", ".secret.key");

let hasLoggedFileFallback = false;

export type EncryptedSecret = {
  ciphertext: string;
  nonce: string;
  tag: string;
  keyVersion: number;
};

export type ResolveSecretKeyOptions = {
  secretFilePath?: string;
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

function normalizeOptionalKey(raw: string | undefined | null): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readSecretFile(secretFilePath: string): Buffer | null {
  if (!fs.existsSync(secretFilePath)) {
    return null;
  }

  const rawKey = normalizeOptionalKey(fs.readFileSync(secretFilePath, "utf8"));
  if (!rawKey) {
    throw new Error(
      `Invalid secret key at ${displayPath(secretFilePath)}; delete this file to regenerate`,
    );
  }

  const decoded = decodeAnyKey(rawKey);
  if (!decoded) {
    throw new Error(
      `Invalid secret key at ${displayPath(secretFilePath)}; delete this file to regenerate`,
    );
  }
  return decoded;
}

function writeSecretFile(secretFilePath: string, rawKey: string): void {
  fs.mkdirSync(path.dirname(secretFilePath), { recursive: true });
  fs.writeFileSync(secretFilePath, `${rawKey}\n`, { mode: 0o600 });
}

function decodeOrThrow(rawKey: string, source: string): Buffer {
  const decoded = decodeAnyKey(rawKey);
  if (!decoded) {
    throw new Error(
      `${source} must decode to 32 bytes (base64/hex/utf8)`,
    );
  }
  return decoded;
}

function displayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (relative.length === 0) {
    return ".env";
  }
  if (!relative.startsWith("..")) {
    return relative;
  }
  return filePath;
}

function generateAndPersistSecretKey(secretFilePath: string): string {
  const generated = randomBytes(REQUIRED_KEY_BYTES).toString("base64");
  try {
    writeSecretFile(secretFilePath, generated);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to persist secret key to ${displayPath(secretFilePath)}: ${reason}`,
    );
  }
  return generated;
}

export function resolveSecretKey(
  rawKey: string | undefined,
  options: ResolveSecretKeyOptions = {},
): Buffer {
  const directInput = normalizeOptionalKey(rawKey);
  if (directInput) {
    return decodeOrThrow(directInput, SECRET_ENV_KEY);
  }

  const processEnvValue = normalizeOptionalKey(process.env[SECRET_ENV_KEY]);
  if (processEnvValue) {
    return decodeOrThrow(processEnvValue, SECRET_ENV_KEY);
  }

  const secretFilePath = options.secretFilePath ?? DEFAULT_SECRET_FILE_PATH;
  const fromSecretFile = readSecretFile(secretFilePath);
  if (fromSecretFile) {
    if (!hasLoggedFileFallback) {
      console.warn(
        `[secret-crypto] ${SECRET_ENV_KEY} is missing; using persisted key at ${displayPath(secretFilePath)}`,
      );
      hasLoggedFileFallback = true;
    }
    return fromSecretFile;
  }

  const generated = generateAndPersistSecretKey(secretFilePath);
  console.warn(
    `[secret-crypto] ${SECRET_ENV_KEY} is missing; generated and persisted to ${displayPath(secretFilePath)}`,
  );
  return decodeOrThrow(generated, displayPath(secretFilePath));
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
