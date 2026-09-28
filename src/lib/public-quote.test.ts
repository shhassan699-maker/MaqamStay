import { describe,it,expect,vi,beforeEach } from "vitest";
const find=vi.hoisted(()=>vi.fn());
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db",()=>({db:{quote:{findUnique:find}}}));
import { getPublicQuote } from "./public-quote";
import { publicQuoteSelect } from "./public-quote-select";
describe("secure public quote lookup",()=>{beforeEach(()=>vi.resetAllMocks());it("rejects malformed tokens before querying",async()=>{expect(await getPublicQuote("123")).toBeNull();expect(find).not.toHaveBeenCalled()});it("rejects expired and cancelled quotes",async()=>{find.mockResolvedValueOnce({expiresAt:new Date("2020-01-01"),request:{status:"QUOTE_SENT"}}).mockResolvedValueOnce({expiresAt:null,request:{status:"CANCELLED"}});expect(await getPublicQuote("a".repeat(64))).toBeNull();expect(await getPublicQuote("b".repeat(64))).toBeNull()});it("queries with the customer-safe field allowlist",async()=>{find.mockResolvedValue({id:"quote",expiresAt:null,request:{status:"QUOTE_SENT"},options:[]});expect(await getPublicQuote("c".repeat(64))).toBeTruthy();expect(find).toHaveBeenCalledWith(expect.objectContaining({select:publicQuoteSelect}));expect(JSON.stringify(find.mock.calls[0][0])).not.toMatch(/supplierPrice|markupValue|expectedCommission|internalNotes/)})});
