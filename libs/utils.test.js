import { generateAllPairings } from "./utils";

// Only test with 10 because that's what we're making the function for
const n = 10;

describe("generateAllPairings", () => {
  it("has exactly n * (n-1) / 2 pairings", () => {
    const pairings = generateAllPairings(n);
    expect(pairings.length).toBe((n * (n - 1)) / 2);
  });

  it("includes every pairing", () => {
    const pairings = generateAllPairings(n);
    const seen = {};

    for (let i = 1; i <= n; i++) {
      seen[i] = {};
      for (let j = 1; j <= n; j++) seen[i][j] = 0;
    }

    for (const x of pairings) {
      seen[x[0]][x[1]]++;
      seen[x[1]][x[0]]++;
    }

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= n; j++) {
        if (i !== j) expect(seen[i][j], `${i} ${j}`).toBe(1);
      }
    }
  });

  it("doesn't repeat pairings", () => {
    const pairings = generateAllPairings(n);
    const seen = {};

    for (let i = 0; i < pairings.length; i++) {
      for (let j = i + 1; j < pairings.length; j++) {
        const pair1 = pairings[i];
        const pair2 = pairings[j];
        expect(JSON.stringify(pair1)).not.toBe(JSON.stringify(pair2));
        expect(JSON.stringify(pair1)).not.toBe(JSON.stringify(pair2.reverse()));
      }
    }
  });

  it("has 1-based indices", () => {
    const pairings = generateAllPairings(n);
    for (const [a, b] of pairings) {
      expect(a).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(0);
      expect(a).toBeLessThanOrEqual(n);
      expect(b).toBeLessThanOrEqual(n);
    }
  });

  it("spaces out people fairly", () => {
    const pairings = generateAllPairings(n);
    const lastSeen = {};
    for (let i = 0; i < pairings.length; i++) {
      for (const x of pairings[i]) {
        if (lastSeen[x] !== undefined) {
          expect(i - lastSeen[x], `${i} ${pairings[i]}`).toBeGreaterThanOrEqual(
            3
          );
        }
        lastSeen[x] = i;
      }
    }
  });
});
