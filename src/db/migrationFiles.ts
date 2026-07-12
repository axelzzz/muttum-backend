import fs from 'fs';
import path from 'path';

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export function readSchemaFiles(): string[] {
  const migrationFileNames = fs.existsSync(MIGRATIONS_DIR)
    ? fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((fileName) => fileName.endsWith('.sql'))
        .sort()
    : [];

  return [
    fs.readFileSync(SCHEMA_PATH, 'utf8'),
    ...migrationFileNames.map((fileName) => fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8')),
  ];
}
