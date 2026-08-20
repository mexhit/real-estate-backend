const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { Client } = require('pg');

const requiredEnvironmentVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
];

async function run() {
  const missingVariables = requiredEnvironmentVariables.filter(
    (name) => !process.env[name],
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }

  const migrationPath = process.argv[2];
  if (!migrationPath) {
    throw new Error('Usage: node scripts/run-migration.js <migration.sql>');
  }

  const absoluteMigrationPath = resolve(migrationPath);
  const sql = await readFile(absoluteMigrationPath, 'utf8');
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log(`Migration completed: ${migrationPath}`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});
