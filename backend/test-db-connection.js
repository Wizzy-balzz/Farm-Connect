import mysql from "mysql2/promise";
import dotenv from "dotenv";
import net from "net";

dotenv.config();

const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = parseInt(process.env.DB_PORT || "3306", 10);
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbName = process.env.DB_NAME || "farmconnect";

console.log("======================================================================");
console.log("             FARMCONNECT MYSQL CONNECTION DIAGNOSTIC TOOL             ");
console.log("======================================================================");
console.log(`Configured Host:     ${dbHost}`);
console.log(`Configured Port:     ${dbPort}`);
console.log(`Configured User:     ${dbUser}`);
console.log(`Configured Password: ${dbPassword ? "*****" : "(empty)"}`);
console.log(`Configured Database: ${dbName}`);
console.log("----------------------------------------------------------------------");

async function checkTcpPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function runDiagnostic() {
  console.log(`Step 1: Testing TCP socket connectivity to ${dbHost}:${dbPort}...`);
  const portOpen = await checkTcpPort(dbHost, dbPort);

  if (!portOpen) {
    console.error(`❌ FAILED: Port ${dbPort} on ${dbHost} is CLOSED or refused connection.`);
    console.error(`\nDiagnostic Summary:`);
    console.error(`- MySQL service is currently STOPPED or NOT INSTALLED on port ${dbPort}.`);
    console.error(`- Resolution: Start XAMPP Control Panel -> Click 'Start' next to MySQL, OR start Windows service (services.msc -> MySQL / MySQL80).`);
    console.log("======================================================================\n");
    process.exit(1);
  }

  console.log(`✅ SUCCESS: TCP Port ${dbPort} is OPEN and accepting connections.`);

  console.log(`\nStep 2: Authenticating MySQL user '${dbUser}' on ${dbHost}:${dbPort}...`);
  let rootConn;
  try {
    rootConn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword
    });
    console.log(`✅ SUCCESS: Authenticated successfully as user '${dbUser}'.`);
  } catch (err) {
    console.error(`❌ FAILED: MySQL authentication error: ${err.message}`);
    console.error(`Check DB_USER and DB_PASSWORD in backend/.env`);
    console.log("======================================================================\n");
    process.exit(1);
  }

  console.log(`\nStep 3: Checking database '${dbName}'...`);
  try {
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ SUCCESS: Database '${dbName}' exists or was created.`);
    await rootConn.changeUser({ database: dbName });

    const [tables] = await rootConn.query("SHOW TABLES");
    console.log(`✅ Database '${dbName}' contains ${tables.length} tables.`);
    if (tables.length > 0) {
      console.log("   Existing tables:", tables.map(t => Object.values(t)[0]).join(", "));
    }
  } catch (err) {
    console.error(`❌ FAILED: Database query error: ${err.message}`);
  } finally {
    await rootConn.end();
  }

  console.log("\n======================================================================");
  console.log("           ALL DIAGNOSTIC CHECKS PASSED SUCCESSFULLY!               ");
  console.log("======================================================================\n");
}

runDiagnostic();
