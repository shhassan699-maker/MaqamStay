import { readFileSync, appendFileSync } from "node:fs";
import { request, rollbackReference, images, services } from "./deployment.mjs";
const input = request([
  process.argv[2],
  process.env.COMMIT,
  process.env.FIRST_DIGEST,
  process.env.SECOND_DIGEST,
]);
const evidence = JSON.parse(readFileSync("deployment-evidence.json", "utf8"));
if (
  evidence.commit !== input.commit ||
  evidence.app !== input.app ||
  evidence.repository !== input.repository ||
  JSON.stringify(evidence.references) !== JSON.stringify(input.references)
)
  throw new Error("Evidence does not match published images");
for (const [index, service] of services[input.app].entries()) {
  if (!rollbackReference(evidence.previous[service], images[input.app][index]))
    throw new Error("Missing rollback reference");
}
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `Commit: ${input.commit}\n\nDeployment: ${evidence.status}\n\nRelease job: ${evidence.release}\n\nFinished: ${evidence.finishedAt}\n\nSee deployment artifact for digests, health and rollback results.\n`,
  );
if (
  evidence.status !== "succeeded" ||
  evidence.release !== "passed" ||
  !evidence.finishedAt ||
  services[input.app].some((service) => evidence.health[service] !== true)
) {
  throw new Error("Deployment did not pass every gate");
}
