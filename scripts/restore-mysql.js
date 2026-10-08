#!/usr/bin/env node

/**
 * FarmConnect MySQL Database Restore Tool
 * 
 * Safely restores a logical MySQL backup file into a target database.
 * 
 * Safety Mechanisms:
 * - HARD BLOCKS restoring over the live production database ('farmconnect' / DB_NAME)
 *   unless explicit disaster-recovery confirmation overrides are provided.
 * - Passwords are never logged or passed via CLI arguments (uses MYSQL_PWD).
 * - Exits with non-zero exit code on any failure.
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

// Locate mysql binary
function findMysqlBinary() {
  if (process.env.MYSQL_BIN_PATH) {
    const candidate = path.join(process.env.MYSQL_BIN_PATH, process.platform === 'win32' ? 'mysql.exe' : 'mysql');
    if (fs.existsSync(candidate)) return candidate;
  }

  const commonWinPaths = [
    'C:\\Program Files\\MySQL\\MySQL Server 9.6\\bin\\mysql.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\mysql.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
    'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
    'C:\\Program Files (x86)\\MySQL\\MySQL Server 9.6\\bin\\mysql.exe'
  ];

  if (process.platform === 'win32') {
    for (const p of commonWinPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  return 'mysql';
}

export async function runRestore(options = {}) {
  const backendEnv = parseEnv(path.join(projectRoot, 'backend', '.env'));
  const rootEnv = parseEnv(path.join(projectRoot, '.env'));
  const prodDbName = (process.env.DB_NAME || backendEnv.DB_NAME || rootEnv.DB_NAME || 'farmconnect').toLowerCase();

  const config = {
    host: options.host || process.env.DB_HOST || backendEnv.DB_HOST || rootEnv.DB_HOST || '127.0.0.1',
    port: options.port || process.env.DB_PORT || backendEnv.DB_PORT || rootEnv.DB_PORT || '3306',
    user: options.user || process.env.DB_USER || backendEnv.DB_USER || rootEnv.DB_USER || 'root',
    password: options.password !== undefined ? options.password : (process.env.DB_PASSWORD || backendEnv.DB_PASSWORD || rootEnv.DB_PASSWORD || ''),
    targetDb: options.targetDb || options.database,
    backupFile: options.backupFile || options.file,
    createDb: options.createDb !== undefined ? options.createDb : true
  };

  console.log('====================================================');
  console.log('FARMCONNECT MYSQL RESTORE UTILITY');
  console.log('====================================================');

  if (!config.backupFile) {
    throw new Error('Missing required option: --file=<path_to_backup.sql>');
  }

  const resolvedBackupPath = path.resolve(config.backupFile);
  if (!fs.existsSync(resolvedBackupPath)) {
    throw new Error(`Backup file does not exist: ${resolvedBackupPath}`);
  }

  const stats = fs.statSync(resolvedBackupPath);
  if (stats.size === 0) {
    throw new Error(`Backup file is empty (0 bytes): ${resolvedBackupPath}`);
  }

  if (!config.targetDb) {
    throw new Error('Missing required option: --targetDb=<database_name>');
  }

  const targetLower = config.targetDb.toLowerCase();

  // CRITICAL PRODUCTION SAFETY GUARD:
  if (targetLower === prodDbName || targetLower === 'farmconnect') {
    const isExplicitlyAuthorized = options.allowProductionOverwrite && 
      process.env.CONFIRM_PRODUCTION_RESTORE === 'I_UNDERSTAND_THE_RISKS';

    if (!isExplicitlyAuthorized) {
      throw new Error(
        `[CRITICAL SAFETY VIOLATION] Target database '${config.targetDb}' matches production database name '${prodDbName}'. ` +
        `Direct restore over production is strictly blocked. ` +
        `To test or verify, restore to a temporary test database (e.g., --targetDb=farmconnect_restore_test).`
      );
    }
  }

  const mysqlBin = findMysqlBinary();

  console.log(`Target DB:    ${config.targetDb}`);
  console.log(`Host:         ${config.host}:${config.port}`);
  console.log(`User:         ${config.user}`);
  console.log(`Backup File:  ${resolvedBackupPath}`);
  console.log(`File Size:    ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Tool Path:    ${mysqlBin}`);
  console.log('----------------------------------------------------');

  // Step 1: Ensure target database exists
  if (config.createDb) {
    console.log(`[PREP] Ensuring target database '${config.targetDb}' exists...`);
    await new Promise((resolve, reject) => {
      const child = spawn(mysqlBin, [
        `--host=${config.host}`,
        `--port=${config.port}`,
        `--user=${config.user}`,
        '--execute',
        `CREATE DATABASE IF NOT EXISTS \`${config.targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      ], {
        env: { ...process.env, MYSQL_PWD: config.password },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let errBuf = '';
      child.stderr.on('data', d => { errBuf += d.toString(); });
      child.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`Failed to create database '${config.targetDb}': ${errBuf}`));
      });
    });
  }

  // Step 2: Stream backup file into target database
  console.log(`[RESTORE] Streaming backup data into '${config.targetDb}'...`);
  const startTime = Date.now();

  await new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(resolvedBackupPath);
    let stderrOutput = '';

    const child = spawn(mysqlBin, [
      `--host=${config.host}`,
      `--port=${config.port}`,
      `--user=${config.user}`,
      '--default-character-set=utf8mb4',
      config.targetDb
    ], {
      env: {
        ...process.env,
        MYSQL_PWD: config.password
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    readStream.pipe(child.stdin);

    child.stderr.on('data', chunk => {
      stderrOutput += chunk.toString();
    });

    readStream.on('error', err => {
      child.kill();
      reject(new Error(`Error reading backup file: ${err.message}`));
    });

    child.on('error', err => {
      reject(new Error(`Failed to start mysql process: ${err.message}`));
    });

    child.on('close', code => {
      if (code === 0) {
        resolve({ stderr: stderrOutput });
      } else {
        const sanitizedStderr = stderrOutput.replace(/--password(=[^\s]*)?/gi, '--password=******');
        reject(new Error(`mysql restore exited with error code ${code}: ${sanitizedStderr}`));
      }
    });
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[SUCCESS] Restore completed successfully into '${config.targetDb}' in ${durationSec}s`);

  return {
    targetDb: config.targetDb,
    backupFile: resolvedBackupPath,
    durationSec,
    success: true
  };
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/restore-mysql.js --file=<backup.sql> --targetDb=<database_name> [options]

Options:
  --file=<path>             Path to the .sql backup file (required)
  --targetDb=<name>         Target database to restore into (required, must NOT be live prod without DR flag)
  --host=<host>             MySQL host (default: 127.0.0.1)
  --port=<port>             MySQL port (default: 3306)
  --user=<user>             MySQL user (default: root)
  --allowProductionOverwrite Allow emergency overwrite if CONFIRM_PRODUCTION_RESTORE is set
  --help                    Display this help message
      `);
      process.exit(0);
    }
    const [k, v] = arg.split('=');
    if (k === '--file') options.backupFile = v;
    if (k === '--targetDb') options.targetDb = v;
    if (k === '--database') options.targetDb = v;
    if (k === '--host') options.host = v;
    if (k === '--port') options.port = v;
    if (k === '--user') options.user = v;
    if (k === '--allowProductionOverwrite') options.allowProductionOverwrite = true;
  }

  runRestore(options)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(`[ERROR] ${err.message}`);
      process.exit(1);
    });
}
