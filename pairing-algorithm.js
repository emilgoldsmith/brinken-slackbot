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



for (let i = 0; i < n-1; i++) {
  for (let j = 0; j < n / 2; j++) {
    console.log(t[j], b[j]);
    seen[t[j]][b[j]]++;
    seen[b[j]][t[j]]++;
  }
  console.log("DONE")

  const xt = t.pop();
  const xb = b.shift();
  t.unshift(xb);
  t[1] = t[0];
  t[0] = 0;
  b.push(xt);
}

console.log(JSON.stringify(seen, null, 4));
