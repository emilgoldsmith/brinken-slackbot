// https://math.stackexchange.com/questions/34328/how-to-rotate-n-individuals-at-a-dinner-party-so-that-every-guest-meets-every-ot
const n = parseInt(process.argv[2])

const seen = {}

for (let i = 0; i < n; i++) {seen[i] = {}; for (let j = 0; j < n; j++) seen[i][j] = 0;}

const t = [];
const b = [];

for (let i = 0; i < n / 2; i++) {
  t.push(i);
  b.push(i + n/2);
}

matches = [];


for (let i = 0; i < n-1; i++) {
  for (let j = 0; j < n / 2; j++) {
    matches.push([t[j], b[j]]);
    seen[t[j]][b[j]]++;
    seen[b[j]][t[j]]++;
  }

  const xt = t.pop();
  const xb = b.shift();
  t.unshift(xb);
  t[1] = t[0];
  t[0] = 0;
  b.push(xt);
}

console.log(JSON.stringify(seen, null, 4));

const lastSeen = {}
let minDist = n;
let maxDist = -1;
for (let i = 0; i < matches.length; i++) {
  for (const x of matches[i]) {
    if (lastSeen[x] !== undefined) {
      console.log(i - lastSeen[x], x, matches[i]);
      minDist = Math.min(minDist, i - lastSeen[x]);
      maxDist = Math.max(maxDist, i - lastSeen[x]);
    }
    lastSeen[x] = i;
  }
}

console.log(minDist);
console.log(maxDist);

const numFirsts = {};
for (let i = 0; i < n; i++) numFirsts[i] = 0;
for (const x of matches) {
  if (numFirsts[x[0]] > numFirsts[x[1]]) {
    [x[0], x[1]] = [x[1], x[0]];
  }
  numFirsts[x[0]]++;
}

console.log(JSON.stringify(numFirsts, null, 4))
