export const titleCase = (value: string) => value.toLowerCase().replace(/(^|_)(\w)/g, (_, sep, char: string) => `${sep ? " " : ""}${char.toUpperCase()}`);
export const dateLabel = (value: Date | string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
export const dateInput = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
