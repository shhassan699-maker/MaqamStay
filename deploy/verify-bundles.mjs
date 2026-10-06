import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const forbidden =
  /DATABASE_URL|SESSION_SECRET|INVENTORY_CATALOG_API_KEY|MONGODB_URI|STORAGE_SECRET_KEY/;
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
console.log(`Customer: ${count} browser assets passed the server-secret scan`);
