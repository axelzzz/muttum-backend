import fs from 'node:fs';
import path from 'node:path';

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const FILE_ENCODING = 'utf8';
const SQL_FILE_EXTENSION = '.sql';

function listMigrationFilePaths(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith(SQL_FILE_EXTENSION))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => path.join(MIGRATIONS_DIR, fileName));
}

export function readSchemaFiles(): string[] {
  const filePaths = [SCHEMA_PATH, ...listMigrationFilePaths()];

  return filePaths.map((filePath) => fs.readFileSync(filePath, FILE_ENCODING));
}
