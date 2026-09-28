import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "./route";

describe("location suggestions API", () => {
  it("finds cities only within the chosen country", async () => {
    const response = await GET(new Request("http://localhost/api/locations/cities?country=PK&q=Lah"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cities).toContain("Lahore");
    expect(body.cities.length).toBeLessThanOrEqual(12);

    const pakistan = await GET(new Request("http://localhost/api/locations/cities?country=PK&q=Amritsar"));
    const india = await GET(new Request("http://localhost/api/locations/cities?country=IN&q=Amritsar"));
    expect((await pakistan.json()).cities).not.toContain("Amritsar");
    expect((await india.json()).cities).toContain("Amritsar");
  });

  it("shows major cities when a city field opens before typing", async () => {
    const response = await GET(new Request("http://localhost/api/locations/cities?country=PK"));
    expect(response.status).toBe(200);
    expect((await response.json()).cities).toEqual(expect.arrayContaining(["Lahore", "Karachi"]));
  });

  it("rejects invalid countries and unbounded queries", async () => {
    const unknown = await GET(new Request("http://localhost/api/locations/cities?country=ZZ&q=Lah"));
    const tooLong = await GET(new Request(`http://localhost/api/locations/cities?country=PK&q=${"a".repeat(81)}`));
    expect(unknown.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });

  it("does not return internal customer or supplier data", async () => {
    const response = await GET(new Request("http://localhost/api/locations/cities?country=PK&q=Kar"));
    expect(await response.json()).toEqual({ cities: expect.arrayContaining(["Karachi"]) });
  });
});
