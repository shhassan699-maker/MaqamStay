import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
// Print only counts/failure labels, never a matching line or credential value.
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const forbidden = [
  /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /mongodb(?:\+srv)?:\/\/(?![^\s]*example)[^\s"']+:[^\s"'<>]+@[^\s"']*(?:\.mongodb\.net)/,
];
let count = 0;
for (const file of new Set(files)) {
  if (file === "package-lock.json") continue;
  let data;
  try {
    data = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (forbidden.some((pattern) => pattern.test(data)))
    throw new Error("Credential pattern detected in repository source");
  count++;
}
console.log(`Source secret scan: ${count} files checked`);
