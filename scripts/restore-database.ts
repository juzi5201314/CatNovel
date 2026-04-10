import { restoreDatabaseBackup } from "../lib/server/project-transfer.ts";

const backupDirectory = process.argv[2];

if (!backupDirectory) {
  throw new Error("Usage: node --experimental-strip-types scripts/restore-database.ts <backup-directory>");
}

const result = restoreDatabaseBackup(backupDirectory);

console.log(
  JSON.stringify(
    {
      restoredAt: result.restoredAt,
      sourceFile: result.sourceFile,
      targetFile: result.targetFile,
      manifest: result.manifest,
      integrity: result.integrity,
    },
    null,
    2,
  ),
);
