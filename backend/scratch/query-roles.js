import { query } from "../database.js";

async function main() {
  const roles = await query.all("SELECT DISTINCT role FROM users");
  console.log("ROLES IN DB:", roles);
  const users = await query.all("SELECT id, name, role, email FROM users LIMIT 10");
  console.log("SAMPLE USERS:", users);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
