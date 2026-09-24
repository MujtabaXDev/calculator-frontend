import { evaluate as mjsEvaluate, combinations, permutations, complex as mjsComplex } from 'mathjs';

// ---------- angle helpers ----------
export function toRad(x, mode) {
  if (mode === 'DEG') return (x * Math.PI) / 180;
  if (mode === 'GRAD') return (x * Math.PI) / 200;
  return x;
}
export function fromRad(x, mode) {
  if (mode === 'DEG') return (x * 180) / Math.PI;
  if (mode === 'GRAD') return (x * 200) / Math.PI;
  return x;
}

// ---------- decimal <-> fraction (S<=>D) ----------
export function decimalToFraction(x, tolerance = 1e-9) {
  const negative = x < 0;
  x = Math.abs(x);
  const whole = Math.floor(x);
  const frac = x - whole;
  if (frac < tolerance) return { whole, num: 0, den: 1, sign: negative ? -1 : 1 };
  let h1 = 1,
    h2 = 0,
    k1 = 0,
    k2 = 1,
    b = frac;
  let iterations = 0;
  do {
    const a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;
    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;
    b = 1 / (b - a);
    iterations++;
  } while (Math.abs(frac - h1 / k1) > frac * tolerance && k1 < 1e7 && iterations < 30);
  return { whole, num: h1, den: k1, sign: negative ? -1 : 1 };
}

export function fractionToString(f) {
  const sign = f.sign < 0 ? '-' : '';
  if (f.num === 0) return `${sign}${f.whole}`;
  if (f.whole === 0) return `${sign}${f.num}/${f.den}`;
  return `${sign}${f.whole} ${f.num}/${f.den}`;
}

// ---------- scope builder for mathjs.evaluate ----------
export function buildScope({ mode = 'DEG', complexMode = false, Ans = 0, M = 0, X = undefined } = {}) {
  const scope = {
    Ans,
    M,
    nCr: (n, r) => combinations(n, r),
    nPr: (n, r) => permutations(n, r),
    dms: (d, m = 0, s = 0) => d + m / 60 + s / 3600,
    Ran: () => Math.random(),
    cbrt: Math.cbrt,
    log10: Math.log10,
    ln: Math.log,
  };
  if (X !== undefined) scope.X = X;
  if (!complexMode) {
    scope.sin = (x) => Math.sin(toRad(x, mode));
    scope.cos = (x) => Math.cos(toRad(x, mode));
    scope.tan = (x) => Math.tan(toRad(x, mode));
    scope.asin = (x) => fromRad(Math.asin(x), mode);
    scope.acos = (x) => fromRad(Math.acos(x), mode);
    scope.atan = (x) => fromRad(Math.atan(x), mode);
    scope.sinh = Math.sinh;
    scope.cosh = Math.cosh;
    scope.tanh = Math.tanh;
    scope.asinh = Math.asinh;
    scope.acosh = Math.acosh;
    scope.atanh = Math.atanh;
  }
  // in complex mode, leave mathjs' own complex-capable sin/cos/tan (radians) in place
  return scope;
}

export function calcEvaluate(expr, opts) {
  const scope = buildScope(opts);
  return mjsEvaluate(expr, scope);
}

// ---------- EQN mode: linear systems, quadratic, cubic ----------
export function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    if (Math.abs(M[i][i]) < 1e-12) throw new Error('No unique solution');
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

export function solveQuadratic(a, b, c) {
  const d = b * b - 4 * a * c;
  if (d >= 0) {
    const sq = Math.sqrt(d);
    return [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
  }
  const re = -b / (2 * a);
  const im = Math.sqrt(-d) / (2 * a);
  return [mjsComplex(re, im), mjsComplex(re, -im)];
}

// Cardano's method for real coefficients ax^3+bx^2+cx+d=0
export function solveCubic(a, b, c, d) {
  b /= a; c /= a; d /= a;
  const p = c - (b * b) / 3;
  const q = (2 * b * b * b) / 27 - (b * c) / 3 + d;
  const disc = (q * q) / 4 + (p * p * p) / 27;
  const roots = [];
  if (disc > 0) {
    const sqrtDisc = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + sqrtDisc);
    const v = Math.cbrt(-q / 2 - sqrtDisc);
    roots.push(u + v - b / 3);
  } else {
    const r = Math.sqrt((-p * p * p) / 27);
    const phi = Math.acos(-q / (2 * r));
    const m = 2 * Math.sqrt(-p / 3);
    for (let k = 0; k < 3; k++) {
      roots.push(m * Math.cos((phi + 2 * Math.PI * k) / 3) - b / 3);
    }
  }
  return roots;
}

// Newton-Raphson SOLVE for f(X) = 0 (SHIFT + CALC on the real device)
export function solveNewton(expr, guess = 1, opts = {}) {
  const f = (x) => calcEvaluate(expr, { ...opts, X: x });
  let x = guess;
  for (let i = 0; i < 100; i++) {
    const h = 1e-6;
    const fx = f(x);
    const dfx = (f(x + h) - f(x - h)) / (2 * h);
    if (Math.abs(dfx) < 1e-12) break;
    const x1 = x - fx / dfx;
    if (Math.abs(x1 - x) < 1e-10) return x1;
    x = x1;
  }
  return x;
}

// ---------- STAT mode (single-variable) ----------
export function computeStats(data) {
  const n = data.length;
  if (n === 0) return null;
  const sumX = data.reduce((a, v) => a + v, 0);
  const sumX2 = data.reduce((a, v) => a + v * v, 0);
  const mean = sumX / n;
  const variance = sumX2 / n - mean * mean;
  const popSD = Math.sqrt(Math.max(variance, 0));
  const sampleVariance = n > 1 ? (sumX2 - n * mean * mean) / (n - 1) : 0;
  const sampleSD = Math.sqrt(Math.max(sampleVariance, 0));
  return { n, sumX, sumX2, mean, popSD, sampleSD };
}

// ---------- MATRIX mode (2x2 / 3x3) ----------
export function matAdd(A, B) {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}
export function matSub(A, B) {
  return A.map((row, i) => row.map((v, j) => v - B[i][j]));
}
export function matMul(A, B) {
  const rows = A.length, cols = B[0].length, inner = B.length;
  const result = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < inner; k++) result[i][j] += A[i][k] * B[k][j];
  return result;
}
export function matDet(A) {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (n === 3) {
    return (
      A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
    );
  }
  throw new Error('Only up to 3x3 supported');
}
export function matTranspose(A) {
  return A[0].map((_, j) => A.map((row) => row[j]));
}
export function matInverse(A) {
  const det = matDet(A);
  if (Math.abs(det) < 1e-12) throw new Error('Matrix is singular');
  const n = A.length;
  if (n === 2) {
    return [
      [A[1][1] / det, -A[0][1] / det],
      [-A[1][0] / det, A[0][0] / det],
    ];
  }
  if (n === 3) {
    const cof = (r, c) => {
      const minor = A.filter((_, i) => i !== r).map((row) => row.filter((_, j) => j !== c));
      const sign = (r + c) % 2 === 0 ? 1 : -1;
      return sign * matDet(minor);
    };
    const cofactors = A.map((row, i) => row.map((_, j) => cof(i, j)));
    const adj = matTranspose(cofactors);
    return adj.map((row) => row.map((v) => v / det));
  }
  throw new Error('Only up to 3x3 supported');
}

// ---------- VECTOR mode (2D / 3D) ----------
export function vecAdd(a, b) {
  return a.map((v, i) => v + b[i]);
}
export function vecSub(a, b) {
  return a.map((v, i) => v - b[i]);
}
export function vecDot(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}
export function vecCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function vecMag(a) {
  return Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
}

// ---------- BASE-N mode ----------
export function toBase(num, base) {
  return (num >>> 0).toString(base).toUpperCase();
}
export function fromBase(str, base) {
  return parseInt(str, base);
}
export const baseOps = {
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
  NOT: (a) => ~a,
  NEG: (a) => -a,
  LSH: (a, b) => a << b,
  RSH: (a, b) => a >> b,
};

// ---------- Pol / Rec conversion ----------
export function pol(x, y) {
  return { r: Math.sqrt(x * x + y * y), theta: (Math.atan2(y, x) * 180) / Math.PI };
}
export function rec(r, thetaDeg) {
  const t = (thetaDeg * Math.PI) / 180;
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
}
