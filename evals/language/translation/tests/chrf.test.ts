import { expect, test } from "bun:test";
import { corpusChrf } from "../scripts/chrf.ts";
import cases from "./chrf-cases.json";
import values from "./chrf-values.json";

// make-chrf-values.sh wrote the values with sacreBLEU 2.5.1 (6 decimals).
for (const c of cases) {
  test(`chrF++ agrees with sacreBLEU: ${c.id}`, () => {
    const pairs = c.hyp.map((hyp, i) => ({ hyp, ref: c.ref[i]! }));
    expect(corpusChrf(pairs)).toBeCloseTo((values as Record<string, number>)[c.id]!, 5);
  });
}
