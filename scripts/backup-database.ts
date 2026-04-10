import { createDatabaseBackup } from "../lib/server/project-transfer.ts";

const outputRoot = process.argv[2];
const label = process.argv[3] ?? "manual";

const result = createDatabaseBackup({ outputRoot, label });

console.log(
  JSON.stringify(
    {
      backupDirectory: result.backupDirectory,
      backupFile: result.backupFile,
      manifest: result.manifest,
      integrity: result.integrity,
    },
    null,
    2,
  ),
);
