import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { randomBytes } from "node:crypto";

import { resolveSecretKey } from "../../src/lib/crypto/secret-crypto.ts";

const SECRET_ENV_KEY = "CATNOVEL_SECRET_KEY";

function withClearedSecretEnv<T>(handler: () => T): T {
  const previous = process.env[SECRET_ENV_KEY];
  delete process.env[SECRET_ENV_KEY];
  try {
    return handler();
  } finally {
    if (previous === undefined) {
      delete process.env[SECRET_ENV_KEY];
    } else {
      process.env[SECRET_ENV_KEY] = previous;
    }
  }
}

test("resolveSecretKey generates and persists key to .data/.secret.key when missing", () => {
  withClearedSecretEnv(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "catnovel-secret-"));
    const secretFilePath = path.join(tempDir, ".data", ".secret.key");

    const key = resolveSecretKey(undefined, { secretFilePath });
    assert.equal(key.length, 32);
    assert.ok(fs.existsSync(secretFilePath));

    const content = fs.readFileSync(secretFilePath, "utf8").trim();
    assert.ok(content.length > 0);
    assert.equal(Buffer.from(content, "base64").length, 32);
  });
});

test("resolveSecretKey loads key from .data/.secret.key when env is missing", () => {
  withClearedSecretEnv(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "catnovel-secret-"));
    const secretFilePath = path.join(tempDir, ".data", ".secret.key");
    const fileEncodedKey = randomBytes(32).toString("base64");

    fs.mkdirSync(path.dirname(secretFilePath), { recursive: true });
    fs.writeFileSync(
      secretFilePath,
      `${fileEncodedKey}\n`,
      "utf8",
    );

    const key = resolveSecretKey(undefined, { secretFilePath });
    assert.equal(key.toString("base64"), fileEncodedKey);
  });
});

test("resolveSecretKey prefers CATNOVEL_SECRET_KEY over .data/.secret.key", () => {
  withClearedSecretEnv(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "catnovel-secret-"));
    const secretFilePath = path.join(tempDir, ".data", ".secret.key");
    const fileEncodedKey = randomBytes(32).toString("base64");
    const envEncodedKey = randomBytes(32).toString("base64");

    fs.mkdirSync(path.dirname(secretFilePath), { recursive: true });
    fs.writeFileSync(secretFilePath, `${fileEncodedKey}\n`, "utf8");
    process.env.CATNOVEL_SECRET_KEY = envEncodedKey;

    const key = resolveSecretKey(undefined, { secretFilePath });
    assert.equal(key.toString("base64"), envEncodedKey);
  });
});
