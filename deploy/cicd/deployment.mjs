// Pure deployment state machine. Host commands are supplied by host.mjs; tests
// supply a simulator and never open a network connection or invoke Docker.
export const images = {
  customer: ["maqamstay-customer", "maqamstay-customer-release"],
  inventory: ["maqamstay-inventory-api", "maqamstay-inventory-admin"],
};
export const services = {
  customer: ["customer"],
  inventory: ["inventory-api", "inventory-admin"],
};
export function request(args) {
  const [app, commit, ...digests] = args;
  if (
    !Object.hasOwn(images, app) ||
    !/^[a-f0-9]{40}$/.test(commit ?? "") ||
    digests.length !== 2 ||
    digests.some((d) => !/^sha256:[a-f0-9]{64}$/.test(d))
  ) {
    throw new Error("Invalid immutable deployment request");
  }
  return {
    app,
    commit,
    references: images[app].map(
      (name, i) => `ghcr.io/shhassan699-maker/${name}@${digests[i]}`,
    ),
  };
}
export function immutable(reference, name) {
  return (
    typeof reference === "string" &&
    reference.startsWith(`ghcr.io/shhassan699-maker/${name}@sha256:`) &&
    /^[a-f0-9]{64}$/.test(reference.split("@sha256:")[1])
  );
}
export function rollbackReference(reference, name) {
  return (
    immutable(reference, name) || /^sha256:[a-f0-9]{64}$/.test(reference ?? "")
  );
}
export async function deploy(input, host) {
  const report = {
    ...input,
    tags: images[input.app].map(
      (name) => `ghcr.io/shhassan699-maker/${name}:${input.commit}`,
    ),
    startedAt: host.now(),
    finishedAt: null,
    release: "not-run",
    status: "failed",
    previous: {},
    health: {},
    rollback: {},
  };
  const touched = new Set();
  let selected;
  try {
    await host.preflight(input.app);
    for (const [i, service] of services[input.app].entries()) {
      const previous = await host.previous(service);
      if (!rollbackReference(previous, images[input.app][i]))
        throw new Error("No immutable rollback image");
      report.previous[service] = previous;
    }
    await host.journal(report); // Durable checkpoint BEFORE migrations or recreation.
    for (const reference of input.references) await host.pull(reference);
    await host.safety(); // A pull can consume the free disk checked above.
    report.release = "running";
    await host.release(input);
    report.release = "passed";
    selected = Object.fromEntries(
      services[input.app].map((service, i) => [service, input.references[i]]),
    );
    await host.select(selected, input);
    for (const service of services[input.app]) {
      touched.add(service); // Compose can fail after it has already replaced a container.
      await host.recreate(service);
    }
    for (const service of services[input.app]) {
      report.health[service] = await host.health(service);
    }
    if (Object.values(report.health).some((ok) => !ok))
      throw new Error("Health failed");
    report.status = "succeeded";
  } catch {
    if (report.release === "running") report.release = "failed";
    // Keep independently healthy new Inventory services. An unknown result or
    // interrupted recreation restores every touched service whose health is unknown.
    for (const service of touched) {
      if (report.health[service] === true) continue;
      try {
        await host.select({ [service]: report.previous[service] });
        await host.recreate(service, true);
        report.rollback[service] = {
          reference: report.previous[service],
          healthy: await host.health(service, true),
        };
      } catch {
        report.rollback[service] = {
          reference: report.previous[service],
          healthy: false,
        };
      }
    }
    // If no container was touched, undo any selectors written before a failure.
    if (selected) {
      const untouched = Object.fromEntries(
        Object.entries(report.previous).filter(([s]) => !touched.has(s)),
      );
      if (Object.keys(untouched).length) {
        try {
          await host.select(untouched);
        } catch {
          report.selectorRecovery = "failed";
        }
      }
    }
  }
  report.finishedAt = host.now();
  await host.journal(report);
  return report;
}
