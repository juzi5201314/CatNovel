import { recoverDatabaseFromBackup } from "../lib/server/project-transfer.ts";

const backupDirectory = process.argv[2];

if (!backupDirectory) {
  throw new Error("Usage: node --experimental-strip-types scripts/recover-database.ts <backup-directory>");
}

const result = recoverDatabaseFromBackup(backupDirectory);

console.log(JSON.stringify(result, null, 2));
