import { describe, it, expect } from "vitest";
import { heatColor, textOn } from "@/components/analytics-charts";

function lum(rgb: number[]) {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]);
}
const parse = (c: string) => (c.startsWith("#") ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/\d+/g)!.map(Number));
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(parse(a)), lum(parse(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("heatmap cell text contrast", () => {
  for (const scale of ["purple", "health"] as const) {
    it(`meets WCAG AA (4.5:1) everywhere on the ${scale} scale`, () => {
      for (let t = 0; t <= 1.0001; t += 0.02) {
        const bg = heatColor(t, scale);
        expect(ratio(bg, textOn(bg)), `${scale} at ${t.toFixed(2)} (${bg})`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
