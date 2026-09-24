import React, { useState } from "react";
import {
  calcEvaluate,
  computeStats,
  solveLinear,
  solveQuadratic,
  solveCubic,
  matAdd,
  matSub,
  matMul,
  matDet,
  matInverse,
  matTranspose,
  vecAdd,
  vecSub,
  vecDot,
  vecCross,
  vecMag,
  toBase,
  fromBase,
  baseOps,
} from "../engine/engine";

function parseNums(str) {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length)
    .map(Number);
}

export function StatPanel() {
  const [input, setInput] = useState("");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  const run = () => {
    try {
      const data = parseNums(input);
      if (!data.length || data.some(Number.isNaN))
        throw new Error("Enter comma-separated numbers");
      setStats(computeStats(data));
      setError("");
    } catch (e) {
      setError(e.message);
      setStats(null);
    }
  };

  return (
    <div className="mode-panel">
      <h3>STAT — 1-Variable Statistics</h3>
      <p className="hint">
        Enter data separated by commas, e.g. 10, 12, 15, 12, 9
      </p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. 1,2,3,4,5"
      />
      <button onClick={run}>Compute</button>
      {error && <div className="error">{error}</div>}
      {stats && (
        <table className="result-table">
          <tbody>
            <tr>
              <td>n</td>
              <td>{stats.n}</td>
            </tr>
            <tr>
              <td>Σx</td>
              <td>{stats.sumX}</td>
            </tr>
            <tr>
              <td>Σx²</td>
              <td>{stats.sumX2}</td>
            </tr>
            <tr>
              <td>x̄ (mean)</td>
              <td>{stats.mean}</td>
            </tr>
            <tr>
              <td>σx (population SD)</td>
              <td>{stats.popSD.toFixed(6)}</td>
            </tr>
            <tr>
              <td>sx (sample SD)</td>
              <td>{stats.sampleSD.toFixed(6)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export function EqnPanel() {
  const [type, setType] = useState("linear2");
  const [coeffs, setCoeffs] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const set = (k, v) => setCoeffs({ ...coeffs, [k]: parseFloat(v) });

  const solve = () => {
    try {
      setError("");
      if (type === "linear2") {
        const { a1 = 0, b1 = 0, c1 = 0, a2 = 0, b2 = 0, c2 = 0 } = coeffs;
        setResult(
          solveLinear(
            [
              [a1, b1],
              [a2, b2],
            ],
            [c1, c2],
          ),
        );
      } else if (type === "linear3") {
        const {
          a1 = 0,
          b1 = 0,
          c1 = 0,
          d1 = 0,
          a2 = 0,
          b2 = 0,
          c2 = 0,
          d2 = 0,
          a3 = 0,
          b3 = 0,
          c3 = 0,
          d3 = 0,
        } = coeffs;
        setResult(
          solveLinear(
            [
              [a1, b1, c1],
              [a2, b2, c2],
              [a3, b3, c3],
            ],
            [d1, d2, d3],
          ),
        );
      } else if (type === "quad") {
        const { a = 0, b = 0, c = 0 } = coeffs;
        setResult(
          solveQuadratic(a, b, c).map((v) =>
            typeof v === "object" ? v.toString() : v,
          ),
        );
      } else if (type === "cubic") {
        const { a = 0, b = 0, c = 0, d = 0 } = coeffs;
        setResult(solveCubic(a, b, c, d));
      }
    } catch (e) {
      setError(e.message);
      setResult(null);
    }
  };

  const field = (key, label) => (
    <label key={key}>
      {label}{" "}
      <input
        type="number"
        step="any"
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );

  return (
    <div className="mode-panel">
      <h3>EQN — Equation Solver</h3>
      <select
        value={type}
        onChange={(e) => {
          setType(e.target.value);
          setResult(null);
        }}
      >
        <option value="linear2">2 unknowns (linear)</option>
        <option value="linear3">3 unknowns (linear)</option>
        <option value="quad">Quadratic (ax²+bx+c=0)</option>
        <option value="cubic">Cubic (ax³+bx²+cx+d=0)</option>
      </select>
      <div className="field-grid">
        {type === "linear2" &&
          ["a1", "b1", "c1", "a2", "b2", "c2"].map((k) => field(k, k))}
        {type === "linear3" &&
          [
            "a1",
            "b1",
            "c1",
            "d1",
            "a2",
            "b2",
            "c2",
            "d2",
            "a3",
            "b3",
            "c3",
            "d3",
          ].map((k) => field(k, k))}
        {type === "quad" && ["a", "b", "c"].map((k) => field(k, k))}
        {type === "cubic" && ["a", "b", "c", "d"].map((k) => field(k, k))}
      </div>
      <button onClick={solve}>Solve</button>
      {error && <div className="error">{error}</div>}
      {result && (
        <div className="result-box">
          {result.map((v, i) => (
            <div key={i}>
              x{result.length > 1 ? i + 1 : ""} ={" "}
              {typeof v === "number" ? Math.round(v * 1e8) / 1e8 : v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatrixInput({ size, values, setValues }) {
  return (
    <div
      className="matrix-grid"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {Array.from({ length: size }).map((_, i) =>
        Array.from({ length: size }).map((_, j) => (
          <input
            key={`${i}-${j}`}
            type="number"
            step="any"
            value={values[i][j]}
            onChange={(e) => {
              const copy = values.map((r) => [...r]);
              copy[i][j] = parseFloat(e.target.value) || 0;
              setValues(copy);
            }}
          />
        )),
      )}
    </div>
  );
}

export function MatrixPanel() {
  const [size, setSize] = useState(2);
  const [A, setA] = useState([
    [0, 0],
    [0, 0],
  ]);
  const [B, setB] = useState([
    [0, 0],
    [0, 0],
  ]);
  const [op, setOp] = useState("add");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const resize = (n) => {
    setSize(n);
    setA(Array.from({ length: n }, () => Array(n).fill(0)));
    setB(Array.from({ length: n }, () => Array(n).fill(0)));
    setResult(null);
  };

  const run = () => {
    try {
      setError("");
      if (op === "add") setResult(matAdd(A, B));
      else if (op === "sub") setResult(matSub(A, B));
      else if (op === "mul") setResult(matMul(A, B));
      else if (op === "det") setResult([[matDet(A)]]);
      else if (op === "inv") setResult(matInverse(A));
      else if (op === "transpose") setResult(matTranspose(A));
    } catch (e) {
      setError(e.message);
      setResult(null);
    }
  };

  return (
    <div className="mode-panel">
      <h3>MATRIX</h3>
      <div className="row">
        <label>Size: </label>
        <select value={size} onChange={(e) => resize(Number(e.target.value))}>
          <option value={2}>2×2</option>
          <option value={3}>3×3</option>
        </select>
        <select value={op} onChange={(e) => setOp(e.target.value)}>
          <option value="add">MatA + MatB</option>
          <option value="sub">MatA − MatB</option>
          <option value="mul">MatA × MatB</option>
          <option value="det">det(MatA)</option>
          <option value="inv">MatA⁻¹</option>
          <option value="transpose">MatA^T</option>
        </select>
      </div>
      <p className="hint">Matrix A</p>
      <MatrixInput size={size} values={A} setValues={setA} />
      {(op === "add" || op === "sub" || op === "mul") && (
        <>
          <p className="hint">Matrix B</p>
          <MatrixInput size={size} values={B} setValues={setB} />
        </>
      )}
      <button onClick={run}>Compute</button>
      {error && <div className="error">{error}</div>}
      {result && (
        <table className="result-table">
          <tbody>
            {result.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j}>{Math.round(v * 1e6) / 1e6}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function VectorPanel() {
  const [dim, setDim] = useState(3);
  const [a, setA] = useState([0, 0, 0]);
  const [b, setB] = useState([0, 0, 0]);
  const [op, setOp] = useState("add");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const changeDim = (n) => {
    setDim(n);
    setA(Array(n).fill(0));
    setB(Array(n).fill(0));
    setResult(null);
  };

  const run = () => {
    try {
      setError("");
      if (op === "add") setResult(vecAdd(a, b));
      else if (op === "sub") setResult(vecSub(a, b));
      else if (op === "dot") setResult([vecDot(a, b)]);
      else if (op === "cross") setResult(vecCross(a, b));
      else if (op === "mag") setResult([vecMag(a)]);
    } catch (e) {
      setError(e.message);
    }
  };

  const vecInput = (vec, setVec) => (
    <div className="row">
      {vec.map((v, i) => (
        <input
          key={i}
          type="number"
          step="any"
          value={v}
          onChange={(e) => {
            const c = [...vec];
            c[i] = parseFloat(e.target.value) || 0;
            setVec(c);
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="mode-panel">
      <h3>VECTOR</h3>
      <div className="row">
        <select value={dim} onChange={(e) => changeDim(Number(e.target.value))}>
          <option value={2}>2D</option>
          <option value={3}>3D</option>
        </select>
        <select value={op} onChange={(e) => setOp(e.target.value)}>
          <option value="add">VctA + VctB</option>
          <option value="sub">VctA − VctB</option>
          <option value="dot">VctA · VctB (dot)</option>
          {dim === 3 && <option value="cross">VctA × VctB (cross)</option>}
          <option value="mag">|VctA|</option>
        </select>
      </div>
      <p className="hint">Vector A</p>
      {vecInput(a, setA)}
      {(op === "add" || op === "sub" || op === "dot" || op === "cross") && (
        <>
          <p className="hint">Vector B</p>
          {vecInput(b, setB)}
        </>
      )}
      <button onClick={run}>Compute</button>
      {error && <div className="error">{error}</div>}
      {result && (
        <div className="result-box">
          [{result.map((v) => Math.round(v * 1e6) / 1e6).join(", ")}]
        </div>
      )}
    </div>
  );
}

export function BaseNPanel() {
  const [value, setValue] = useState("0");
  const [base, setBase] = useState(10);
  const [op, setOp] = useState("NONE");
  const [operand, setOperand] = useState("0");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = () => {
    try {
      setError("");
      const dec = parseInt(value, base);
      if (Number.isNaN(dec))
        throw new Error("Invalid number for selected base");
      let out = dec;
      if (op !== "NONE") {
        const opDec = parseInt(operand, base);
        if (op === "NOT") out = baseOps.NOT(dec);
        else out = baseOps[op](dec, opDec);
      }
      setResult({
        dec: out,
        bin: toBase(out, 2),
        oct: toBase(out, 8),
        hex: toBase(out, 16),
      });
    } catch (e) {
      setError(e.message);
      setResult(null);
    }
  };

  return (
    <div className="mode-panel">
      <h3>BASE-N</h3>
      <div className="row">
        <label>Base: </label>
        <select value={base} onChange={(e) => setBase(Number(e.target.value))}>
          <option value={2}>Bin</option>
          <option value={8}>Oct</option>
          <option value={10}>Dec</option>
          <option value={16}>Hex</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="value"
        />
      </div>
      <div className="row">
        <select value={op} onChange={(e) => setOp(e.target.value)}>
          <option value="NONE">Convert only</option>
          <option value="AND">AND</option>
          <option value="OR">OR</option>
          <option value="XOR">XOR</option>
          <option value="NOT">NOT</option>
          <option value="LSH">Logical Shift Left</option>
          <option value="RSH">Logical Shift Right</option>
        </select>
        {op !== "NONE" && op !== "NOT" && (
          <input
            value={operand}
            onChange={(e) => setOperand(e.target.value.toUpperCase())}
            placeholder="operand"
          />
        )}
      </div>
      <button onClick={run}>Compute</button>
      {error && <div className="error">{error}</div>}
      {result && (
        <table className="result-table">
          <tbody>
            <tr>
              <td>DEC</td>
              <td>{result.dec}</td>
            </tr>
            <tr>
              <td>BIN</td>
              <td>{result.bin}</td>
            </tr>
            <tr>
              <td>OCT</td>
              <td>{result.oct}</td>
            </tr>
            <tr>
              <td>HEX</td>
              <td>{result.hex}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export function TablePanel({ mode, angleUnit }) {
  const [expr, setExpr] = useState("X^2");
  const [start, setStart] = useState(-3);
  const [end, setEnd] = useState(3);
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const run = () => {
    try {
      setError("");
      const out = [];
      for (let x = start; x <= end + 1e-9; x += step) {
        const y = calcEvaluate(expr, {
          mode: angleUnit,
          complexMode: false,
          X: x,
        });
        out.push({ x: Math.round(x * 1e6) / 1e6, y });
      }
      setRows(out);
    } catch (e) {
      setError(e.message);
      setRows(null);
    }
  };

  return (
    <div className="mode-panel">
      <h3>TABLE — f(X) generator</h3>
      <label>
        f(X) = <input value={expr} onChange={(e) => setExpr(e.target.value)} />
      </label>
      <div className="row">
        <label>
          Start{" "}
          <input
            type="number"
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
          />
        </label>
        <label>
          End{" "}
          <input
            type="number"
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
          />
        </label>
        <label>
          Step{" "}
          <input
            type="number"
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
          />
        </label>
      </div>
      <button onClick={run}>Generate</button>
      {error && <div className="error">{error}</div>}
      {rows && (
        <table className="result-table">
          <thead>
            <tr>
              <th>X</th>
              <th>f(X)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.x}</td>
                <td>
                  {typeof r.y === "number"
                    ? Math.round(r.y * 1e6) / 1e6
                    : String(r.y)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
