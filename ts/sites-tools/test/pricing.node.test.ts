import { describe, expect, it } from "vitest";
import { answeredUnknown, centsBucket, estimateField, ESTIMATE_UNKNOWN, flowOf, labelOf, PRICING_LIMITS, readEstimateInputs } from "../src/index";
import { MODEL } from "./support/fixtures";

const cleaning = () => MODEL;

describe("labelOf", () => {
  it("picks the page's label, else the first", () => {
    expect(labelOf({ fr: "Zone", en: "Area" }, "en")).toBe("Area");
    expect(labelOf({ fr: "Zone" }, "de")).toBe("Zone");
  });
});

describe("flowOf", () => {
  const flows = { standard: "estimate", windows: "fixed", deep: "quote", move: "estimate" } as const;

  it("runs the brand's flow when the model prices the need that way", () => {
    expect(flowOf(flows, cleaning(), "standard")).toBe("estimate");
    expect(flowOf(flows, cleaning(), "windows")).toBe("fixed");
  });

  it("is a quote otherwise — never a form with no price", () => {
    expect(flowOf(flows, cleaning(), "deep")).toBe("quote");
    expect(flowOf(flows, cleaning(), "move")).toBe("quote");
    expect(flowOf({ standard: "fixed" }, cleaning(), "standard")).toBe("quote");
    expect(flowOf(flows, null, "standard")).toBe("quote");
    expect(flowOf(undefined, cleaning(), "standard")).toBe("quote");
    expect(flowOf(flows, cleaning(), undefined)).toBe("quote");
    expect(flowOf(flows, cleaning(), "constructor")).toBe("quote");
  });
});

describe("readEstimateInputs", () => {
  it("reads only the need's inputs, and only slugs", () => {
    const posted = new Map([
      [estimateField("zone"), "centre"],
      [estimateField("bedrooms"), " t2 "],
      [estimateField("surface"), "<b>"],
      [estimateField("pets"), "cat"],
      ["quoted_cents", "1"],
    ]);
    expect(readEstimateInputs(cleaning(), "standard", f => posted.get(f) ?? null)).toEqual({ zone: "centre", bedrooms: "t2" });
    expect(readEstimateInputs(cleaning(), "windows", f => posted.get(f) ?? null)).toEqual({});
  });
});

describe("answeredUnknown", () => {
  it("is an answer \"I don't know\" to one of the need's own questions, never a slug a model could price", () => {
    expect(new RegExp(PRICING_LIMITS.slug).test(ESTIMATE_UNKNOWN)).toBe(false);
    const posted = new Map([[estimateField("surface"), ` ${ESTIMATE_UNKNOWN} `]]);
    expect(answeredUnknown(cleaning(), "standard", f => posted.get(f) ?? null)).toBe(true);
    expect(answeredUnknown(cleaning(), "windows", f => posted.get(f) ?? null)).toBe(false);
    expect(answeredUnknown(cleaning(), "standard", () => "t2")).toBe(false);
  });
});

describe("centsBucket", () => {
  it.each([
    [0, "0-2500"],
    [2499, "0-2500"],
    [2500, "2500-5000"],
    [8400, "7500-10000"],
    [18_800, "15000-20000"],
    [99_999, "50000-100000"],
    [100_000, "100000+"],
    [100_000_000, "100000+"],
  ])("%i cents is %s", (cents, bucket) => {
    expect(centsBucket(cents)).toBe(bucket);
  });
});
