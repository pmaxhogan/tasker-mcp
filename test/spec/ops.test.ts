import { describe, expect, it } from "vitest";
import { OPS, opByCode, opByName } from "../../src/model/ops.ts";

describe("condition operators", () => {
  it("covers codes 0..13 once each", () => {
    expect(OPS.map((o) => o.code)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it.each(OPS.map((o) => [o.code, o] as const))("code %i round-trips", (code, op) => {
    expect(opByCode(code)).toBe(op);
    expect(opByName(op.name)).toBe(op);
    expect(opByName(op.symbol)).toBe(op);
    expect(opByName(op.label)).toBe(op);
    expect(opByName(String(code))).toBe(op);
  });

  it("only Even, Odd, Set and Not Set skip the rhs", () => {
    expect(OPS.filter((o) => !o.takesRhs).map((o) => o.code)).toEqual([10, 11, 12, 13]);
  });

  it.each([
    ["~", 2],
    ["!~", 3],
    ["~R", 4],
    ["~r", 4],
    ["!~R", 5],
    ["<", 6],
    [">", 7],
    ["=", 8],
    ["==", 8],
    ["!=", 9],
    ["eq", 0],
    ["Equals", 0],
    ["neq", 1],
    ["Doesn't Equal", 1],
    ["Matches", 2],
    ["matches regex", 4],
    ["Is Set", 12],
    ["is set", 12],
    ["Set", 12],
    ["!Set", 13],
    ["Not Set", 13],
    ["Isn't Set", 13],
    ["not_set", 13],
    ["Maths: Equals", 8],
    ["maths equals", 8],
    ["Maths: Is Even", 10],
    ["odd", 11],
    ["  Matches  ", 2],
  ])("opByName(%j) -> %i", (q, code) => {
    expect(opByName(q)?.code).toBe(code);
  });

  it("unknown operators", () => {
    expect(opByCode(14)).toBeUndefined();
    expect(opByName("approximately")).toBeUndefined();
    expect(opByName("99")).toBeUndefined();
  });
});
