import { writeFileSync } from "node:fs";
import { request, images } from "./deployment.mjs";
const input = request([
  process.argv[2],
  process.env.COMMIT,
  process.env.FIRST_DIGEST,
  process.env.SECOND_DIGEST,
]);
writeFileSync(
  "image-evidence.json",
  JSON.stringify(
    {
      ...input,
      timestamp: new Date().toISOString(),
      tags: images[input.app].map(
        (name) => `ghcr.io/shhassan699-maker/${name}:${input.commit}`,
      ),
    },
    null,
    2,
  ) + "\n",
);
