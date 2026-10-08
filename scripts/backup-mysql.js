#!/usr/bin/env node

/**
 * FarmConnect MySQL Database Backup Tool
 * 
 * Safely creates timestamped logical dumps of the authoritative MySQL database
 * using mysqldump with InnoDB transactional consistency.
 * 
 * Security:
 * - Passwords are never logged or passed via CLI arguments (uses MYSQL_PWD).
 * - Exits with non-zero status on any failure.
 * - Never overwrites existing backup files.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to parse .env file without external dependencies
function parseEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

// Locate mysqldump binary
function findMysqldumpBinary() {
  if (process.env.MYSQL_BIN_PATH) {
    const candidate = path.join(process.env.MYSQL_BIN_PATH, process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump');
    if (fs.existsSync(candidate)) return candidate;
  }

  const commonWinPaths = [
    'C:\\Program Files\\MySQL\\MySQL Server 9.6\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
    'C:\\Program Files (x86)\\MySQL\\MySQL Server 9.6\\bin\\mysqldump.exe'
  ];

  if (process.platform === 'win32') {
    for (const p of commonWinPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  return 'mysqldump';
}

// Format timestamp safe for filenames across operating systems
function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
}

export async function runBackup(options = {}) {
  // Load configuration with hierarchy: CLI options > process.env > backend/.env > root .env > defaults
  const backendEnv = parseEnv(path.join(projectRoot, 'backend', '.env'));
  const rootEnv = parseEnv(path.join(projectRoot, '.env'));
  const config = {
    host: options.host || process.env.DB_HOST || backendEnv.DB_HOST || rootEnv.DB_HOST || '127.0.0.1',
    port: options.port || process.env.DB_PORT || backendEnv.DB_PORT || rootEnv.DB_PORT || '3306',
    user: options.user || process.env.DB_USER || backendEnv.DB_USER || rootEnv.DB_USER || 'root',
    password: options.password !== undefined ? options.password : (process.env.DB_PASSWORD || backendEnv.DB_PASSWORD || rootEnv.DB_PASSWORD || ''),
    database: options.database || process.env.DB_NAME || backendEnv.DB_NAME || rootEnv.DB_NAME || 'farmconnect',
    backupDir: options.backupDir || process.env.MYSQL_BACKUP_DIR || path.join(projectRoot, 'backups', 'mysql'),
    retention: parseInt(options.retention || process.env.MYSQL_BACKUP_RETENTION || '0', 10)
  };

  const dumpBin = findMysqldumpBinary();

  console.log('====================================================');
  console.log('FARMCONNECT MYSQL BACKUP UTILITY');
  console.log('====================================================');
  console.log(`Database:     ${config.database}`);
  console.log(`Host:         ${config.host}:${config.port}`);
  console.log(`User:         ${config.user}`);
  console.log(`Backup Dir:   ${config.backupDir}`);
  console.log(`Tool Path:    ${dumpBin}`);
  console.log('----------------------------------------------------');

  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
    console.log(`[INIT] Created backup directory: ${config.backupDir}`);
  }

  const timestamp = getTimestamp();
  const backupFileName = `${config.database}_backup_${timestamp}.sql`;
  const backupFilePath = path.join(config.backupDir, backupFileName);

  if (fs.existsSync(backupFilePath)) {
    throw new Error(`Safety violation: Target backup file already exists: ${backupFilePath}`);
  }

  const dumpArgs = [
    `--host=${config.host}`,
    `--port=${config.port}`,
    `--user=${config.user}`,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    '--hex-blob',
    '--set-gtid-purged=OFF',
    '--default-character-set=utf8mb4',
    config.database
  ];

  console.log(`[BACKUP] Starting mysqldump into: ${backupFileName}...`);

  const startTime = Date.now();

  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(backupFilePath, { flags: 'wx' });
    let stderrOutput = '';

    const child = spawn(dumpBin, dumpArgs, {
      env: {
        ...process.env,
        MYSQL_PWD: config.password
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.pipe(fileStream);

    child.stderr.on('data', chunk => {
      stderrOutput += chunk.toString();
    });

    fileStream.on('error', err => {
      child.kill();
      reject(new Error(`Failed to write backup file: ${err.message}`));
    });

    child.on('error', err => {
      fileStream.close();
      reject(new Error(`Failed to start mysqldump process: ${err.message}`));
    });

    child.on('close', code => {
      fileStream.close(() => {
        if (code === 0) {
          resolve({ stderr: stderrOutput });
        } else {
          if (fs.existsSync(backupFilePath)) {
            try { fs.unlinkSync(backupFilePath); } catch {
              // Ignore unlink errors on already missing file
            }
          }
          const sanitizedStderr = stderrOutput.replace(/--password(=[^\s]*)?/gi, '--password=******');
          reject(new Error(`mysqldump exited with error code ${code}: ${sanitizedStderr}`));
        }
      });
    });
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const stats = fs.statSync(backupFilePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  if (stats.size === 0) {
    fs.unlinkSync(backupFilePath);
    throw new Error('Backup failed: Created dump file is 0 bytes.');
  }

  // Quick sanity verification on the generated file tail
  const buffer = Buffer.alloc(Math.min(4096, stats.size));
  const fd = fs.openSync(backupFilePath, 'r');
  fs.readSync(fd, buffer, 0, buffer.length, stats.size - buffer.length);
  fs.closeSync(fd);
  const tailText = buffer.toString('utf-8');

  const hasCompletionMarker = tailText.includes('Dump completed on') || tailText.includes('-- Dump completed');

  console.log(`[SUCCESS] Backup completed successfully in ${durationSec}s`);
  console.log(`File:         ${backupFilePath}`);
  console.log(`Size:         ${stats.size} bytes (${sizeMb} MB)`);
  console.log(`Integrity:    ${hasCompletionMarker ? 'Verified completion signature' : 'No footer marker (check contents)'}`);

  // Optional safe retention management
  if (config.retention > 0) {
    applyRetentionPolicy(config.backupDir, config.database, config.retention);
  }

  return {
    filePath: backupFilePath,
    fileName: backupFileName,
    sizeBytes: stats.size,
    sizeMb,
    durationSec,
    timestamp,
    verified: hasCompletionMarker
  };
}

function applyRetentionPolicy(backupDir, database, keepCount) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith(`${database}_backup_`) && f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      console.log(`[RETENTION] Found ${files.length} backups. Retaining newest ${keepCount}, deleting ${toDelete.length} older backups:`);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
        console.log(`  - Deleted: ${item.name}`);
      }
    } else {
      console.log(`[RETENTION] Found ${files.length} backups. Total is within retention limit (${keepCount}).`);
    }
  } catch (err) {
    console.warn(`[WARN] Retention policy enforcement warning: ${err.message}`);
  }
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/backup-mysql.js [options]

Options:
  --backupDir=<path>    Custom directory for backups (default: ./backups/mysql)
  --database=<name>     Database to dump (default: from .env DB_NAME or farmconnect)
  --host=<host>         MySQL host (default: 127.0.0.1)
  --port=<port>         MySQL port (default: 3306)
  --user=<user>         MySQL user (default: root)
  --retention=<count>   Number of backups to keep (default: 0 = preserve all)
  --help                Display this help message
      `);
      process.exit(0);
    }
    const [k, v] = arg.split('=');
    if (k === '--backupDir') options.backupDir = v;
    if (k === '--database') options.database = v;
    if (k === '--host') options.host = v;
    if (k === '--port') options.port = v;
    if (k === '--user') options.user = v;
    if (k === '--retention') options.retention = v;
  }

  runBackup(options)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(`[ERROR] ${err.message}`);
      process.exit(1);
    });
}
