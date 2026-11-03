require('dotenv').config()
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@libsql/client')

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations')

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  const folders = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory())
    .sort()

  await client.execute(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      checksum TEXT NOT NULL,
      finished_at DATETIME,
      migration_name TEXT NOT NULL,
      logs TEXT,
      rolled_back_at DATETIME,
      started_at DATETIME NOT NULL DEFAULT current_timestamp,
      applied_steps_count INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `)

  const applied = await client.execute('SELECT migration_name FROM _prisma_migrations')
  const appliedNames = new Set(applied.rows.map((r) => r.migration_name))

  for (const folder of folders) {
    if (appliedNames.has(folder)) {
      console.log(`Skipping ${folder} (already applied)`)
      continue
    }
    const sqlPath = path.join(MIGRATIONS_DIR, folder, 'migration.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)

    console.log(`Applying ${folder} (${statements.length} statements)...`)
    for (const stmt of statements) {
      await client.execute(stmt)
    }

    const checksum = crypto.createHash('sha256').update(sql).digest('hex')
    await client.execute({
      sql: `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
            VALUES (?, ?, datetime('now'), ?, ?)`,
      args: [crypto.randomUUID(), checksum, folder, statements.length],
    })
    console.log(`  done.`)
  }

  console.log('All migrations applied to Turso.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
