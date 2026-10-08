# FarmConnect MySQL Database Backup & Restore Runbook

**Authoritative Database**: MySQL Server 9.6.0  
**Default Host / Port**: `127.0.0.1:3306`  
**Production Database Name**: `farmconnect`  
**Storage Engine**: `InnoDB`  
**Charset / Collation**: `utf8mb4_unicode_ci`  

---

## 1. Prerequisites

Before executing database backups or restores, ensure the following are present on the host environment:
1. **Node.js**: v18.x or higher (v24.x tested).
2. **MySQL Client Tools**:
   - `mysqldump.exe` (v8.0, v8.4, v9.0, or v9.6)
   - `mysql.exe`
   - *Default Windows Location*: `C:\Program Files\MySQL\MySQL Server 9.6\bin`
   - *Alternative*: Specify `MYSQL_BIN_PATH` in environment or ensure tools are in system `PATH`.
3. **Network & Permissions**:
   - Access to MySQL port 3306.
   - User credentials with `SELECT`, `LOCK TABLES`, `SHOW VIEW`, `TRIGGER`, `EVENT` privileges for backup.
   - User credentials with `CREATE`, `DROP`, `ALTER`, `INSERT`, `UPDATE` privileges for restore.

---

## 2. Environment Variables

The backup and restore scripts read configuration hierarchically from CLI arguments > `process.env` > `backend/.env` > project root `.env`:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DB_HOST` | `127.0.0.1` | MySQL server host address |
| `DB_PORT` | `3306` | MySQL server port |
| `DB_USER` | `root` | Database username |
| `DB_PASSWORD` | *(empty)* | Database password (passed securely via `MYSQL_PWD`) |
| `DB_NAME` | `farmconnect` | Target production database name |
| `MYSQL_BACKUP_DIR` | `./backups/mysql` | Root directory where timestamped backups are stored |
| `MYSQL_BACKUP_RETENTION` | `0` *(preserve all)* | Number of newest backups to retain (0 = no automatic deletion) |
| `MYSQL_BIN_PATH` | *(auto-detected)* | Custom directory containing `mysqldump.exe` and `mysql.exe` |

---

## 3. How to Create a Backup

### Using npm script:
```bash
npm run db:backup
```

### Using Node directly:
```bash
node scripts/backup-mysql.js
```

### With custom options:
```bash
node scripts/backup-mysql.js --backupDir=D:/backups/mysql --retention=14
```

### Script Execution Characteristics:
- **Consistent Snapshot**: Runs with `--single-transaction` so InnoDB tables are read without blocking production read/write traffic.
- **Low Memory Overhead**: Runs with `--quick` to stream rows directly to disk.
- **Full Preserved Objects**: Includes stored routines (`--routines`), triggers (`--triggers`), and binary data (`--hex-blob`).
- **Portability**: Uses `--set-gtid-purged=OFF` and `--default-character-set=utf8mb4` for safe cross-instance imports.
- **Fail-Safe**: If `mysqldump` fails or creates a 0-byte file, the incomplete file is immediately unlinked and a non-zero exit code is returned.

---

## 4. Where Backups are Stored

By default, backups are written to:
```
<repository_root>/backups/mysql/
```

### Filename Format:
```
farmconnect_backup_YYYY-MM-DD_HH-mm-ss.sql
```
*Example*: `farmconnect_backup_2026-10-02_20-49-30.sql`

> [!NOTE]
> Backup files in `backups/` are automatically ignored by git via `.gitignore` to prevent committing sensitive database dumps into source control.

---

## 5. How to Verify a Backup

To inspect the generated `.sql` file without executing a restore:
1. **Check File Size**: Confirm file size is > 0 bytes (typical populated size is ~600KB–10MB+).
2. **Check Footer Marker**: Inspect the last 20 lines of the file. A valid dump ends with:
   ```sql
   -- Dump completed on 2026-10-02 20:49:31
   ```
3. **Verify Table Definitions**: Confirm key tables exist in the dump:
   ```bash
   findstr /I "CREATE TABLE `users`" backups\mysql\farmconnect_backup_*.sql
   findstr /I "CREATE TABLE `orders`" backups\mysql\farmconnect_backup_*.sql
   ```

---

## 6. How to Create a Temporary Restore Database

Always test backups against an isolated sandbox database before any production operation:

```sql
CREATE DATABASE `farmconnect_restore_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 7. How to Restore

### Restoring to a Test Database:
```bash
node scripts/restore-mysql.js --file=backups/mysql/farmconnect_backup_2026-10-02_20-49-30.sql --targetDb=farmconnect_restore_test
```

The script will:
1. Ensure `farmconnect_restore_test` exists with `utf8mb4` character set.
2. Stream the SQL dump directly into `mysql.exe` using `MYSQL_PWD` for credential masking.
3. Validate exit code and timing.

---

## 8. How to Validate the Restored Database

Run the automated equivalence validation script:
```bash
node scripts/verify-backup.js --sourceDb=farmconnect --targetDb=farmconnect_restore_test --cleanup
```

### What this checks:
- **Table Count**: Asserts exactly 27 tables exist in both.
- **Table Names**: Verifies 100% table name parity.
- **Row Counts**: Iterates every single table and compares row counts.
- **Constraints**: Compares count of keys, primary keys, and foreign keys in `information_schema.TABLE_CONSTRAINTS`.
- **Domain Records**: Asserts valid users, products, orders, AI messages, and audit actions match.
- **Cleanup**: If `--cleanup` is supplied, drops `farmconnect_restore_test` once verification passes.

---

## 9. How to Perform Production Recovery (Disaster Recovery Only)

> [!CAUTION]
> Restoring directly over the live production database (`farmconnect`) is an irreversible operation that will overwrite all current tables and rows.

By default, `scripts/restore-mysql.js` strictly rejects any command targeting `farmconnect` or `DB_NAME`:
```
[ERROR] [CRITICAL SAFETY VIOLATION] Target database 'farmconnect' matches production database name.
```

### Emergency Disaster Recovery Procedure:
If production data is corrupted and recovery from a backup is genuinely required:
1. **Take an emergency snapshot of current state first**:
   ```bash
   node scripts/backup-mysql.js --backupDir=./backups/pre-recovery
   ```
2. **Stop application servers**:
   Stop Node.js backend and Python AI service to close active database connections.
3. **Execute authorized production restore**:
   Set `CONFIRM_PRODUCTION_RESTORE=I_UNDERSTAND_THE_RISKS` in the environment and supply `--allowProductionOverwrite`:
   ```bash
   cmd /C "set CONFIRM_PRODUCTION_RESTORE=I_UNDERSTAND_THE_RISKS && node scripts/restore-mysql.js --file=backups/mysql/farmconnect_backup_<TIMESTAMP>.sql --targetDb=farmconnect --allowProductionOverwrite"
   ```
4. **Run Regression Suites**:
   ```bash
   node backend/test-all-phases.js
   ```
5. **Restart application services**.

---

## 10. Rollback Considerations

1. If a disaster recovery restore fails midway, use the pre-recovery snapshot created in Step 9.1 to restore the prior state.
2. All transactional tables in FarmConnect use the `InnoDB` storage engine. Foreign keys and indexes will be reconstructed according to the dump file.

---

## 11. Security Precautions

- **No Passwords on CLI**: Passwords are supplied to `mysqldump` and `mysql` strictly through the `MYSQL_PWD` subshell environment variable. They never appear in process listings (`ps`, Task Manager) or stdout/stderr logs.
- **Access Control**: Restrict filesystem permissions on `./backups/mysql` so only server administrators have read access.
- **Git Protection**: The `./backups/` directory is listed in `.gitignore` to guarantee dump files are never pushed to remote repositories.

---

## 12. What Must NEVER Be Done

1. **NEVER** run `migrate-sqlite-to-mysql.js` — that is an obsolete legacy script from August 2026.
2. **NEVER** restore an unverified backup directly to production without testing on `farmconnect_restore_test` first.
3. **NEVER** commit `.sql` dump files or plaintext database passwords to git.
4. **NEVER** delete all historical backups automatically without retaining off-site archives.
5. **NEVER** execute DDL alterations or restores without taking a fresh backup immediately beforehand.
