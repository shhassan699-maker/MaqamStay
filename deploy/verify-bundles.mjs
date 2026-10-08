import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const forbidden =
  /CUSTOMER_CRM_ORIGIN|DATABASE_URL|SESSION_SECRET|INVENTORY_CATALOG_API_KEY|MONGODB_URI|STORAGE_SECRET_KEY|STORAGE_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|ADMIN_PASSWORD/;
let count = 0;
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(js|map)$/.test(entry.name)) {
      const data = await readFile(file, "utf8");
      if (forbidden.test(data))
        throw new Error("Server configuration in browser bundle");
      for (const key of [
        "SESSION_SECRET",
        "INVENTORY_CATALOG_API_KEY",
        "DATABASE_URL",
      ])
        if (process.env[key]?.length >= 20 && data.includes(process.env[key]))
          throw new Error("Server value in browser bundle");
      count++;
    }
  }
}
await scan(resolve(process.argv[2] || ".next/static"));
if (count === 0) throw new Error("No customer browser assets inspected");
console.log(`Customer: ${count} browser assets passed the server-secret scan`);
