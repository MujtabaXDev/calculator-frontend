import React, { useEffect, useReducer, useState, useCallback } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  calcEvaluate,
  decimalToFraction,
  fractionToString,
  solveNewton,
} from "../engine/engine";
import {
  StatPanel,
  EqnPanel,
  MatrixPanel,
  VectorPanel,
  BaseNPanel,
  TablePanel,
} from "./ModePanels";
import { parse as parseMath } from "mathjs";

/* =========================================================================
   TREE NODE TYPES
   ========================================================================= */
const FIELD_ORDER = {
  frac: ["num", "den"],
  sqrt: ["radicand"],
  nthroot: ["index", "radicand"],
  pow: ["base", "exp"],
  group: ["body"],
  func: ["body"],
};
const COMPOUND_TYPES = new Set([
  "frac",
  "sqrt",
  "nthroot",
  "pow",
  "group",
  "func",
]);
const isCompound = (it) => it && COMPOUND_TYPES.has(it.t);
const VALUE_TYPES = new Set([
  "digit",
  "frac",
  "sqrt",
  "nthroot",
  "pow",
  "group",
  "func",
  "const",
  "ans",
  "text",
]);
const isValue = (it) => it && VALUE_TYPES.has(it.t);

function getIn(row, path) {
  let r = row;
  for (const s of path) r = r[s.index][s.field];
  return r;
}
function setIn(row, path, newRow) {
  if (path.length === 0) return newRow;
  const [s, ...rest] = path;
  const item = row[s.index];
  const copy = row.slice();
  copy[s.index] = { ...item, [s.field]: setIn(item[s.field], rest, newRow) };
  return copy;
}

function emptyTree() {
  return { expr: [], path: [], pos: 0 };
}

/* ------------- INSERT PRIMITIVES ------------- */
function insertRaw(state, item, enterField = null) {
  const row = getIn(state.expr, state.path);
  const newRow = [...row.slice(0, state.pos), item, ...row.slice(state.pos)];
  const newExpr = setIn(state.expr, state.path, newRow);
  let path = state.path,
    pos = state.pos + 1;
  if (enterField) {
    path = [...state.path, { index: state.pos, field: enterField }];
    pos = 0;
  }
  return { expr: newExpr, path, pos };
}

function insertDigit(state, ch) {
  const row = getIn(state.expr, state.path);
  const prev = state.pos > 0 ? row[state.pos - 1] : null;

  if (ch === ".") {
    if (!prev || prev.t !== "digit")
      return insertRaw(state, { t: "digit", v: "0." });
    let k = state.pos - 1;
    while (k >= 0 && row[k].t === "digit") {
      if (row[k].v.includes(".")) return state;
      k--;
    }
  }
  if (prev && prev.t === "digit") {
    const merged = { t: "digit", v: prev.v + ch };
    const newRow = [
      ...row.slice(0, state.pos - 1),
      merged,
      ...row.slice(state.pos),
    ];
    return { ...state, expr: setIn(state.expr, state.path, newRow) };
  }
  return insertRaw(state, { t: "digit", v: ch });
}

function insertOp(state, v) {
  const row = getIn(state.expr, state.path);
  const prev = state.pos > 0 ? row[state.pos - 1] : null;
  const expectingFactor =
    state.pos === 0 || (prev && (prev.t === "op" || prev.t === "neg"));
  if (v === "-" && expectingFactor) return insertRaw(state, { t: "neg" });
  if (prev && prev.t === "op") return state;
  return insertRaw(state, { t: "op", v });
}

/* capture the "factor" immediately before cursor (used only by frac & pow) */
function captureBase(row, pos) {
  if (pos === 0) return { start: pos, end: pos, items: [] };
  const item = row[pos - 1];
  if (item.t === "digit") {
    let start = pos - 1;
    while (start > 0 && row[start - 1].t === "digit") start--;
    return { start, end: pos, items: row.slice(start, pos) };
  }
  if (isCompound(item) || item.t === "ans" || item.t === "const") {
    return { start: pos - 1, end: pos, items: [item] };
  }
  return { start: pos, end: pos, items: [] };
}

function replaceRange(state, start, end, newItem, enterField = null) {
  const row = getIn(state.expr, state.path);
  const newRow = [...row.slice(0, start), newItem, ...row.slice(end)];
  const newExpr = setIn(state.expr, state.path, newRow);
  const path = [
    ...state.path,
    { index: start, field: enterField || FIELD_ORDER[newItem.t][0] },
  ];
  return { expr: newExpr, path, pos: 0 };
}

/* ---- Fraction: CAPTURES preceding factor as numerator (real CASIO) ---- */
function insertFrac(state) {
  const row = getIn(state.expr, state.path);
  const { start, end, items } = captureBase(row, state.pos);
  if (items.length === 0) {
    return insertRaw(state, { t: "frac", num: [], den: [] }, "num");
  }
  return replaceRange(
    state,
    start,
    end,
    { t: "frac", num: items, den: [] },
    "den",
  );
}

/* ---- √: DOES NOT capture. Always inserts an empty √(∎) as a new value. ---- */
function insertSqrt(state) {
  return insertRaw(state, { t: "sqrt", radicand: [] }, "radicand");
}

/* ---- ⁿ√: same as sqrt ---- */
function insertNthRoot(state, preIndex = null) {
  return insertRaw(
    state,
    {
      t: "nthroot",
      index: preIndex ? [{ t: "digit", v: String(preIndex) }] : [],
      radicand: [],
    },
    preIndex ? "radicand" : "index",
  );
}

/* ---- ( ) group: DOES NOT capture ---- */
function insertGroup(state) {
  return insertRaw(state, { t: "group", body: [] }, "body");
}
function insertAns(state) {
  return insertRaw(state, { t: "ans" });
}
function insertConst(state, name) {
  return insertRaw(state, { t: "const", name });
}

/* ---- xʸ: CAPTURES preceding factor as base ---- */
function insertPow(state) {
  const row = getIn(state.expr, state.path);
  const { start, end, items } = captureBase(row, state.pos);
  if (items.length === 0) {
    return insertRaw(state, { t: "pow", base: [], exp: [] }, "exp");
  }
  return replaceRange(
    state,
    start,
    end,
    { t: "pow", base: items, exp: [] },
    "exp",
  );
}

function insertSquare(state) {
  return wrapPowWithExp(state, [{ t: "digit", v: "2" }]);
}
function insertCube(state) {
  return wrapPowWithExp(state, [{ t: "digit", v: "3" }]);
}
function insertReciprocal(state) {
  return wrapPowWithExp(state, [{ t: "neg" }, { t: "digit", v: "1" }]);
}

function wrapPowWithExp(state, expItems) {
  const row = getIn(state.expr, state.path);
  const { start, end, items } = captureBase(row, state.pos);
  if (items.length === 0) return state;
  const newRow = [
    ...row.slice(0, start),
    { t: "pow", base: items, exp: expItems },
    ...row.slice(end),
  ];
  const newExpr = setIn(state.expr, state.path, newRow);
  return { expr: newExpr, path: state.path, pos: start + 1 };
}

function insertPow10(state) {
  return insertRaw(
    state,
    { t: "pow", base: [{ t: "digit", v: "10" }], exp: [] },
    "exp",
  );
}

/* ---- log/sin/cos/… : DOES NOT capture ---- */
function insertFunc(state, name) {
  return insertRaw(state, { t: "func", name, body: [] }, "body");
}

/* ------------- CURSOR NAV ------------- */
function moveRight(state) {
  const row = getIn(state.expr, state.path);
  if (state.pos < row.length) {
    const it = row[state.pos];
    if (isCompound(it))
      return {
        ...state,
        path: [
          ...state.path,
          { index: state.pos, field: FIELD_ORDER[it.t][0] },
        ],
        pos: 0,
      };
    return { ...state, pos: state.pos + 1 };
  }
  if (state.path.length === 0) return state;
  const last = state.path[state.path.length - 1];
  const parentPath = state.path.slice(0, -1);
  const parent = getIn(state.expr, parentPath)[last.index];
  const fields = FIELD_ORDER[parent.t];
  const fi = fields.indexOf(last.field);
  if (fi < fields.length - 1)
    return {
      ...state,
      path: [...parentPath, { index: last.index, field: fields[fi + 1] }],
      pos: 0,
    };
  return { ...state, path: parentPath, pos: last.index + 1 };
}

function moveLeft(state) {
  if (state.pos > 0) {
    const row = getIn(state.expr, state.path);
    const it = row[state.pos - 1];
    if (isCompound(it)) {
      const fields = FIELD_ORDER[it.t];
      const f = fields[fields.length - 1];
      return {
        ...state,
        path: [...state.path, { index: state.pos - 1, field: f }],
        pos: it[f].length,
      };
    }
    return { ...state, pos: state.pos - 1 };
  }
  if (state.path.length === 0) return state;
  const last = state.path[state.path.length - 1];
  const parentPath = state.path.slice(0, -1);
  const parent = getIn(state.expr, parentPath)[last.index];
  const fields = FIELD_ORDER[parent.t];
  const fi = fields.indexOf(last.field);
  if (fi > 0) {
    const pf = fields[fi - 1];
    return {
      ...state,
      path: [...parentPath, { index: last.index, field: pf }],
      pos: parent[pf].length,
    };
  }
  return { ...state, path: parentPath, pos: last.index };
}

function moveUpDown(state, dir) {
  if (state.path.length === 0) return state;
  const last = state.path[state.path.length - 1];
  const parentPath = state.path.slice(0, -1);
  const parent = getIn(state.expr, parentPath)[last.index];
  let target = null;
  if (parent.t === "frac") target = dir === "up" ? "num" : "den";
  else if (parent.t === "nthroot") target = dir === "up" ? "index" : "radicand";
  else if (parent.t === "pow") target = dir === "up" ? "exp" : "base";
  if (target && last.field !== target) {
    return {
      ...state,
      path: [...parentPath, { index: last.index, field: target }],
      pos: Math.min(state.pos, parent[target].length),
    };
  }
  return state;
}

function backspace(state) {
  if (state.pos > 0) {
    const row = getIn(state.expr, state.path);
    const it = row[state.pos - 1];
    if (isCompound(it)) {
      const fields = FIELD_ORDER[it.t];
      const empty = fields.every((f) => it[f].length === 0);
      if (empty) {
        const newRow = [
          ...row.slice(0, state.pos - 1),
          ...row.slice(state.pos),
        ];
        return {
          ...state,
          expr: setIn(state.expr, state.path, newRow),
          pos: state.pos - 1,
        };
      }
      const f = fields[fields.length - 1];
      return {
        ...state,
        path: [...state.path, { index: state.pos - 1, field: f }],
        pos: it[f].length,
      };
    }
    const newRow = [...row.slice(0, state.pos - 1), ...row.slice(state.pos)];
    return {
      ...state,
      expr: setIn(state.expr, state.path, newRow),
      pos: state.pos - 1,
    };
  }
  if (state.path.length === 0) return state;
  const last = state.path[state.path.length - 1];
  return { ...state, path: state.path.slice(0, -1), pos: last.index };
}

/* ------------- SERIALIZE for calcEvaluate ------------- */
function serializeTree(row) {
  let out = "";
  let prevVal = false;
  for (const it of row) {
    const v = isValue(it);
    if (v && prevVal) out += "*";
    out += serializeItem(it);
    prevVal = v;
  }
  return out;
}
function serializeItem(it) {
  switch (it.t) {
    case "digit":
      return it.v;
    case "op":
      return it.v === "×" ? "*" : it.v === "÷" ? "/" : it.v;
    case "neg":
      return "-";
    case "frac":
      return `((${serializeTree(it.num)})/(${serializeTree(it.den)}))`;
    case "sqrt":
      return `sqrt(${serializeTree(it.radicand)})`;
    case "nthroot":
      return `nthRoot(${serializeTree(it.radicand)},(${serializeTree(it.index)}))`;
    case "pow":
      return `((${serializeTree(it.base)})^(${serializeTree(it.exp)}))`;
    case "group":
      return `(${serializeTree(it.body)})`;
    case "func":
      return `${it.name}(${serializeTree(it.body)})`;
    case "const":
      return it.name;
    case "ans":
      return "Ans";
    case "text":
      return it.v;
    default:
      return "";
  }
}

/* ===================== RESULT RENDER ===================== */
function superscript(str) {
  return String(str).replace(
    /[0-9-]/g,
    (c) =>
      ({
        0: "⁰",
        1: "¹",
        2: "²",
        3: "³",
        4: "⁴",
        5: "⁵",
        6: "⁶",
        7: "⁷",
        8: "⁸",
        9: "⁹",
        "-": "⁻",
      })[c],
  );
}
function displayExpression(value) {
  return String(value)
    .replace(/\basin\(/g, "sin⁻¹(")
    .replace(/\bacos\(/g, "cos⁻¹(")
    .replace(/\batan\(/g, "tan⁻¹(")
    .replace(/cbrt\(/g, "∛(")
    .replace(/sqrt\(/g, "√(")
    .replace(/log10\(/g, "log(")
    .replace(/exp\(/g, "eˣ(")
    .replace(/\*10\^(-?\d+)/g, (_, e) => `×10${superscript(e)}`)
    .replace(/\*10\^/g, "×10ˣ")
    .replace(/·/g, "×")
    .replace(/\*/g, "×")
    .replace(/\^(-?\d+)/g, (_, e) => superscript(e));
}
function scientificDisplay(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const a = Math.abs(n);
  if (a === 0 || (a >= 1e-6 && a < 1e9)) return null;
  const [c, e] = n.toExponential(6).split("e");
  return `${Number(c)} × 10${superscript(Number(e))}`;
}
function NaturalDisplay({ value, className = "", isResult = false }) {
  if (!value) return null;
  const norm = typeof value === "string" ? value.replace(/·/g, "*") : value;
  if (!isResult)
    return (
      <span className={`natural-display ${className}`}>
        {displayExpression(norm)}
      </span>
    );

  const mixed = String(norm)
    .trim()
    .match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const [, w, n, d] = mixed;
    return (
      <span className={`natural-display mixed-fraction ${className}`}>
        <span className="mixed-whole">{w}</span>
        <span className="mixed-part">
          <span>{n}</span>
          <span className="mixed-rule" />
          <span>{d}</span>
        </span>
      </span>
    );
  }
  if (norm === "/") {
    return (
      <span className={`natural-display fraction-placeholder ${className}`}>
        <span className="fraction-slot" />
        <span className="fraction-bar" />
        <span className="fraction-slot" />
      </span>
    );
  }
  const num = String(norm).trim();
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(num)) {
    const s = scientificDisplay(num);
    return (
      <span className={`natural-display ${className}`}>
        {s || displayExpression(num)}
      </span>
    );
  }
  if (
    /[+\-*/^,(]$/.test(num) ||
    /\*(?!10\^)/.test(String(norm)) ||
    /\*10\^/.test(String(norm)) ||
    /\b(?:asin|acos|atan)\(/.test(num)
  ) {
    return (
      <span className={`natural-display ${className}`}>
        {displayExpression(norm)}
      </span>
    );
  }
  try {
    const tex = parseMath(String(norm)).toTex({ parenthesis: "keep" });
    return (
      <span
        className={`natural-display ${className}`}
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(tex, {
            displayMode: false,
            throwOnError: false,
          }),
        }}
      />
    );
  } catch {
    return (
      <span className={`natural-display ${className}`}>
        {displayExpression(norm)}
      </span>
    );
  }
}

/* ===================== TREE RENDERER ===================== */
function pathsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++)
    if (a[i].index !== b[i].index || a[i].field !== b[i].field) return false;
  return true;
}
function Cursor({ variant = "caret" }) {
  return <span className={variant} />;
}

function ItemView({ item, editable, cursorPath, cursorPos, basePath, index }) {
  const childPath = (f) => [...basePath, { index, field: f }];
  switch (item.t) {
    case "digit":
      return <span>{item.v}</span>;
    case "op":
      return (
        <span className="op-token">
          {item.v === "*" ? "×" : item.v === "/" ? "÷" : item.v}
        </span>
      );
    case "neg":
      return <span className="op-token">-</span>;
    case "ans":
      return <span className="italic">Ans</span>;
    case "const":
      return <span>{item.name === "pi" ? "π" : item.name}</span>;
    case "text":
      return <span>{item.v}</span>;

    case "frac":
      return (
        <span className="fraction-editor">
          <span className="fraction-part">
            <RowView
              row={item.num}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("num")}
            />
          </span>
          <span className="fraction-rule" />
          <span className="fraction-part">
            <RowView
              row={item.den}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("den")}
            />
          </span>
        </span>
      );

    case "sqrt":
      return (
        <span className="sqrt-editor">
          <span className="sqrt-symbol">√</span>
          <span className="sqrt-radicand">
            <RowView
              row={item.radicand}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("radicand")}
            />
          </span>
        </span>
      );

    case "nthroot":
      return (
        <span className="nthroot-editor">
          <span className="nthroot-index">
            <RowView
              row={item.index}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("index")}
            />
          </span>
          <span className="sqrt-symbol">√</span>
          <span className="sqrt-radicand">
            <RowView
              row={item.radicand}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("radicand")}
            />
          </span>
        </span>
      );

    case "pow":
      return (
        <span className="pow-editor">
          <span className="pow-base">
            <RowView
              row={item.base}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("base")}
            />
          </span>
          <span className="pow-exp">
            <RowView
              row={item.exp}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("exp")}
            />
          </span>
        </span>
      );

    case "group":
      return (
        <span className="group-editor">
          <span className="paren">(</span>
          <RowView
            row={item.body}
            editable={editable}
            cursorPath={cursorPath}
            cursorPos={cursorPos}
            path={childPath("body")}
          />
          <span className="paren">)</span>
        </span>
      );

    case "func":
      return (
        <span className="func-editor">
          <span className="func-name">{item.name}</span>
          <span className="paren">(</span>
          <RowView
            row={item.body}
            editable={editable}
            cursorPath={cursorPath}
            cursorPos={cursorPos}
            path={childPath("body")}
          />
          <span className="paren">)</span>
        </span>
      );

    default:
      return null;
  }
}

function RowView({ row, editable, cursorPath, cursorPos, path }) {
  const here = editable && pathsEqual(path, cursorPath);
  const inFrac = path.some((s) => s.field === "num" || s.field === "den");
  if (row.length === 0)
    return here ? (
      <Cursor variant={inFrac ? "fraction-caret" : "caret"} />
    ) : (
      <span className="empty-slot">&nbsp;</span>
    );
  const out = [];
  for (let i = 0; i <= row.length; i++) {
    if (here && cursorPos === i)
      out.push(
        <Cursor key={"c" + i} variant={inFrac ? "fraction-caret" : "caret"} />,
      );
    if (i < row.length)
      out.push(
        <ItemView
          key={i}
          item={row[i]}
          editable={editable}
          cursorPath={cursorPath}
          cursorPos={cursorPos}
          basePath={path}
          index={i}
        />,
      );
  }
  return <span className="row-view">{out}</span>;
}

/* ===================== REDUCER ===================== */
function treeReducer(state, action) {
  switch (action.type) {
    case "digit":
      return insertDigit(state, action.v);
    case "op":
      return insertOp(state, action.v);
    case "frac":
      return insertFrac(state);
    case "sqrt":
      return insertSqrt(state);
    case "nthroot":
      return insertNthRoot(state, action.index ?? null);
    case "group":
      return insertGroup(state);
    case "ans":
      return insertAns(state);
    case "const":
      return insertConst(state, action.name);
    case "pow":
      return insertPow(state);
    case "square":
      return insertSquare(state);
    case "cube":
      return insertCube(state);
    case "reciprocal":
      return insertReciprocal(state);
    case "pow10":
      return insertPow10(state);
    case "func":
      return insertFunc(state, action.name);
    case "text":
      return insertRaw(state, { t: "text", v: action.v });
    case "left":
      return moveLeft(state);
    case "right":
      return moveRight(state);
    case "up":
      return moveUpDown(state, "up");
    case "down":
      return moveUpDown(state, "down");
    case "backspace":
      return backspace(state);
    case "clear":
      return emptyTree();
    default:
      return state;
  }
}

/* ===================== MODES ===================== */
const MODES = [
  "COMP",
  "CMPLX",
  "STAT",
  "BASE-N",
  "EQN",
  "MATRIX",
  "TABLE",
  "VECTOR",
];

function preprocess(expr) {
  const opPattern = /([\w.]+|\([^()]*\))\s*(nCr|nPr)\s*([\w.]+|\([^()]*\))/g;
  let prev,
    out = expr,
    guard = 0;
  do {
    prev = out;
    out = out.replace(opPattern, (_, a, op, b) => `${op}(${a},${b})`);
    guard++;
  } while (out !== prev && guard < 10);
  out = out.replace(/\)\s*(?=[A-Za-z\d(])/g, ")*");
  out = out.replace(
    /(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)\s*(?=[A-Za-z(])/g,
    "$1*",
  );
  return out;
}

/* Decides if a decimal can be shown as a nice a/b. Returns "n/d" or null. */
function niceFractionString(num) {
  if (!Number.isFinite(num)) return null;
  if (Number.isInteger(num)) return null;
  try {
    const frac = decimalToFraction(num);
    if (!frac) return null;
    const n =
      typeof frac.n === "bigint" ? frac.n : BigInt(Math.round(Number(frac.n)));
    const d =
      typeof frac.d === "bigint" ? frac.d : BigInt(Math.round(Number(frac.d)));
    if (d === 1n) return null;
    if (d > 100000n) return null;
    if ((n < 0n ? -n : n) > 100000000n) return null;
    if (
      Math.abs(Number(n) / Number(d) - num) >
      1e-9 * Math.max(1, Math.abs(num))
    )
      return null;
    return `${n}/${d}`;
  } catch {
    return null;
  }
}

export default function Calculator({
  mode,
  setMode,
  angleUnit,
  setAngleUnit,
  onResult,
}) {
  const [tree, dispatch] = useReducer(treeReducer, undefined, emptyTree);
  const [display, setDisplay] = useState("0");
  const [Ans, setAns] = useState(0);
  const [M, setM] = useState(0);
  const [shiftActive, setShiftActive] = useState(false);
  const [alphaActive, setAlphaActive] = useState(false);
  const [hypActive, setHypActive] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [fractionView, setFractionView] = useState(false);
  const [localHistory, setLocalHistory] = useState([]);
  const [error, setError] = useState(false);
  const [evaluatedExpr, setEvaluatedExpr] = useState(null);

  const complexMode = mode === "CMPLX";
  const basicDisplayMode = mode === "COMP" || mode === "CMPLX";

  const insert = useCallback((text) => {
    if (text === "/100") {
      dispatch({ type: "frac" });
      return;
    }
    if (text === "*10^") {
      dispatch({ type: "pow10" });
      return;
    }
    if (text === " nPr ") {
      dispatch({ type: "text", v: " nPr " });
      return;
    }
    if (text === " nCr ") {
      dispatch({ type: "text", v: " nCr " });
      return;
    }
    if (/^[0-9.]$/.test(text)) return dispatch({ type: "digit", v: text });
    if (text === "+" || text === "-" || text === "*" || text === "×")
      return dispatch({ type: "op", v: text === "×" ? "*" : text });
    if (text === "/" || text === "÷") return dispatch({ type: "frac" });
    if (text === "^") return dispatch({ type: "pow" });
    if (text === "^2") return dispatch({ type: "square" });
    if (text === "^3") return dispatch({ type: "cube" });
    if (text === "^(-1)") return dispatch({ type: "reciprocal" });
    if (text === "10^(") return dispatch({ type: "pow10" });
    if (text === "sqrt(") return dispatch({ type: "sqrt" });
    if (text === "cbrt(") return dispatch({ type: "nthroot", index: 3 });
    if (text === "pi") return dispatch({ type: "const", name: "pi" });
    if (text === "e") return dispatch({ type: "const", name: "e" });
    if (text === "i") return dispatch({ type: "const", name: "i" });
    if (text === "M") return dispatch({ type: "const", name: "M" });
    if (text === "Ans") return dispatch({ type: "ans" });
    if (text === "(") return dispatch({ type: "group" });
    if (text === ")") return dispatch({ type: "right" });
    const m = text.match(/^([a-zA-Z][a-zA-Z0-9_]*)\($/);
    if (m) return dispatch({ type: "func", name: m[1] });
    dispatch({ type: "text", v: text });
  }, []);

  const clearAll = () => {
    dispatch({ type: "clear" });
    setDisplay("0");
    setError(false);
    setEvaluatedExpr(null);
  };
  function fullReset() {
    clearAll();
    setAns(0);
    setM(0);
    setMode("COMP");
    setAngleUnit("DEG");
    setShiftActive(false);
    setAlphaActive(false);
    setHypActive(false);
    setFractionView(false);
  }
  function pushHistory(e, r) {
    const entry = { expression: e, result: String(r), mode, angleUnit };
    setLocalHistory((h) => [entry, ...h].slice(0, 100));
    onResult && onResult(entry);
  }
  function classifyError(src, err) {
    const msg = String(err?.message || err || "");
    const s = String(src || "");
    const engineSaysSyntax =
      /(Unexpected end|Unexpected operator|Unexpected part|Unexpected type|Parenthesis|Value expected|Character .* is not allowed|Syntax|Unexpected token|Value expected)/i.test(
        msg,
      );
    let depth = 0,
      bad = false;
    for (const ch of s) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (depth < 0) {
        bad = true;
        break;
      }
    }
    const endsOp = /[+\-*/^(,]$/.test(s.trim());
    const endsFunc =
      /\b(?:sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|asinh|acosh|atanh|sqrt|cbrt|log10|ln|exp|abs|dms|pol|rec|round|sum|integral|randomInt|Ran|nthRoot)$/i.test(
        s.trim(),
      );
    if (engineSaysSyntax || bad || depth !== 0 || endsOp || endsFunc)
      return "Syntax ERROR";
    if (
      /[A-Za-z]/.test(s) &&
      /(Undefined symbol|Unknown symbol|is not defined|not defined|Variable)/i.test(
        msg,
      )
    )
      return "Variable Error";
    return "Math ERROR";
  }

  /* ---------- EVALUATE ---------- */
  function doEvaluate() {
    let clean;
    try {
      const serialized = serializeTree(tree.expr) || "0";
      clean = preprocess(serialized);
      const result = calcEvaluate(clean, {
        mode: angleUnit,
        complexMode,
        Ans,
        M,
      });
      const numVal = typeof result === "number" ? result : Number(result);

      let shown;
      let asFraction = false;
      if (!Number.isFinite(numVal)) {
        shown =
          typeof result === "object" && result.toString
            ? result.toString()
            : String(result);
      } else {
        const fracStr = niceFractionString(numVal);
        if (fracStr) {
          shown = fracStr;
          asFraction = true;
        } else {
          shown = String(numVal);
        }
      }
      setDisplay(String(shown));
      setAns(numVal);
      setError(false);
      setEvaluatedExpr(tree.expr);
      setFractionView(asFraction);
      pushHistory(serializeTree(tree.expr), shown);
    } catch (e) {
      setDisplay(classifyError(clean ?? serializeTree(tree.expr), e));
      setError(true);
    }
  }

  function doSolve() {
    let target;
    try {
      const serialized = serializeTree(tree.expr);
      target = serialized;
      const root = solveNewton(preprocess(target), Ans || 1, {
        mode: angleUnit,
      });
      setDisplay(`X = ${Math.round(root * 1e9) / 1e9}`);
      setAns(root);
      pushHistory(`SOLVE: ${serialized}`, root);
      setError(false);
    } catch (e) {
      setDisplay(classifyError(target, e));
      setError(true);
    }
  }

  function toggleFractionView() {
    const v = String(display).trim();
    if (v === "Math ERROR" || v === "Syntax ERROR" || v === "Variable Error")
      return;
    const fracMatch = v.match(/^(-?\d+)\/(\d+)$/);
    if (fracMatch) {
      setDisplay(String(Number(fracMatch[1]) / Number(fracMatch[2])));
      setFractionView(false);
      return;
    }
    const numVal = Number(v);
    if (!Number.isFinite(numVal)) return;
    const nice = niceFractionString(numVal);
    if (nice) {
      setDisplay(nice);
      setFractionView(true);
      return;
    }
    try {
      const frac = decimalToFraction(numVal);
      if (frac) {
        const n =
          typeof frac.n === "bigint"
            ? frac.n
            : BigInt(Math.round(Number(frac.n)));
        const d =
          typeof frac.d === "bigint"
            ? frac.d
            : BigInt(Math.round(Number(frac.d)));
        if (d !== 1n && d <= 100000n) {
          setDisplay(`${n}/${d}`);
          setFractionView(true);
          return;
        }
      }
    } catch {}
  }

  function consumeModifiers(mainFn, shiftFn, hypFn, hypShiftFn) {
    let fn = mainFn;
    if (hypActive && shiftActive && hypShiftFn) fn = hypShiftFn;
    else if (hypActive && hypFn) fn = hypFn;
    else if (shiftActive && shiftFn) fn = shiftFn;
    fn && fn();
    setShiftActive(false);
    setHypActive(false);
  }

  function press(btn) {
    if (btn.id === "SHIFT") {
      setShiftActive((v) => !v);
      return;
    }
    if (btn.id === "ALPHA") {
      setAlphaActive((v) => !v);
      return;
    }
    if (alphaActive && btn.alpha) {
      insert(btn.alpha);
      setAlphaActive(false);
      return;
    }
    if (btn.id === "HYP") {
      if (shiftActive && btn.shiftAction) {
        btn.shiftAction();
        setShiftActive(false);
        return;
      }
      setHypActive((v) => !v);
      return;
    }
    if (shiftActive && btn.shiftAction) {
      btn.shiftAction();
      setShiftActive(false);
      return;
    }

    if (btn.id === "LEFT") {
      dispatch({ type: "left" });
      return;
    }
    if (btn.id === "RIGHT") {
      dispatch({ type: "right" });
      return;
    }
    if (btn.id === "UP") {
      dispatch({ type: "up" });
      return;
    }
    if (btn.id === "DOWN") {
      dispatch({ type: "down" });
      return;
    }
    if (btn.id === "MENU") {
      if (shiftActive) {
        setAngleUnit((u) =>
          u === "DEG" ? "RAD" : u === "RAD" ? "GRAD" : "DEG",
        );
        setShiftActive(false);
      } else setShowMenu((v) => !v);
      return;
    }
    if (btn.id === "ON") {
      fullReset();
      return;
    }
    if (btn.id === "AC") {
      clearAll();
      return;
    }
    if (btn.id === "DEL") {
      dispatch({ type: "backspace" });
      return;
    }
    if (btn.id === "CALC" || btn.id === "EQ") {
      if (shiftActive && btn.id === "CALC") {
        doSolve();
        setShiftActive(false);
        return;
      }
      doEvaluate();
      return;
    }
    if (btn.id === "FRAC") {
      dispatch({ type: "frac" });
      return;
    }
    if (btn.id === "SD") {
      toggleFractionView();
      setShiftActive(false);
      return;
    }
    if (
      btn.id === "STO" ||
      btn.id === "MPLUS" ||
      btn.id === "MMINUS" ||
      btn.id === "RCL"
    ) {
      try {
        const s = serializeTree(tree.expr) || String(Ans);
        const v = calcEvaluate(preprocess(s), {
          mode: angleUnit,
          complexMode,
          Ans,
          M,
        });
        if (btn.id === "RCL") {
          setM(v);
          setDisplay(`M = ${v}`);
          clearAll();
        } else if (btn.id === "STO") {
          setM(v);
          setDisplay(`M = ${v}`);
          clearAll();
        } else if (btn.id === "MPLUS") {
          setM((m) => m + v);
          setDisplay(`M = ${M + v}`);
          clearAll();
        } else {
          setM((m) => m - v);
          setDisplay(`M = ${M - v}`);
          clearAll();
        }
      } catch {
        setDisplay("Math ERROR");
        setError(true);
      }
      return;
    }

    if (btn.id === "SIN")
      return consumeModifiers(
        () => insert("sin("),
        () => insert("asin("),
        () => insert("sinh("),
        () => insert("asinh("),
      );
    if (btn.id === "COS")
      return consumeModifiers(
        () => insert("cos("),
        () => insert("acos("),
        () => insert("cosh("),
        () => insert("acosh("),
      );
    if (btn.id === "TAN")
      return consumeModifiers(
        () => insert("tan("),
        () => insert("atan("),
        () => insert("tanh("),
        () => insert("atanh("),
      );

    if (shiftActive && btn.shift) {
      insert(btn.shift);
      setShiftActive(false);
      return;
    }
    if (btn.main) insert(btn.main);
  }

  useEffect(() => {
    function onKey(e) {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input, select, textarea, [contenteditable='true']")
      )
        return;
      const map = {
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        Backspace: "DEL",
        Delete: "DEL",
      };
      if (map[e.key]) {
        e.preventDefault();
        press({ id: map[e.key] });
        return;
      }
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        press({ id: "EQ" });
        return;
      }
      if (/^[0-9.+\-*/()]$/.test(e.key)) {
        e.preventDefault();
        insert(e.key);
        return;
      }
      if (e.key === "^") {
        e.preventDefault();
        dispatch({ type: "pow" });
      }
      if (e.key === "Escape") {
        e.preventDefault();
        clearAll();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line

  function renderModePanel() {
    if (mode === "STAT") return <StatPanel />;
    if (mode === "EQN") return <EqnPanel />;
    if (mode === "MATRIX") return <MatrixPanel />;
    if (mode === "VECTOR") return <VectorPanel />;
    if (mode === "BASE-N") return <BaseNPanel />;
    if (mode === "TABLE")
      return <TablePanel mode={mode} angleUnit={angleUnit} />;
    return null;
  }

  const rows = [
    [
      {
        id: "CALC",
        main: "CALC",
        shift: "SOLVE",
        alpha: "=",
        alphaLabel: "=",
        cls: "k-fn calc-btn",
        topLabel: "SOLVE",
      },
      {
        id: "INTEGRAL",
        main: "integral(",
        shift: "d/dx",
        cls: "k-fn calc-btn",
        label: "∫dx",
        topLabel: "d/dx",
        shiftLabel: "d/dx",
      },
      {
        id: "POWINV",
        main: "^(-1)",
        cls: "k-fn calc-btn",
        label: "x⁻¹",
        topLabel: "xⁱ",
        shiftAction: () => insert("!"),
      },
      {
        id: "LOGBLOCK",
        main: "log10(",
        cls: "k-fn calc-btn",
        label: "log□",
        topLabel: "∑",
        shiftAction: () => insert("sum("),
      },
    ],
    [
      { id: "FRAC", cls: "k-fn", label: "a b/c", shiftLabel: "□/□" },
      {
        id: "SQRT",
        main: "sqrt(",
        shift: "cbrt(",
        cls: "k-fn",
        label: "√",
        shiftLabel: "∛",
      },
      {
        id: "SQ",
        main: "^2",
        shift: "^3",
        cls: "k-fn",
        label: "x²",
        shiftLabel: "x³",
      },
      {
        id: "POW",
        main: "^",
        shift: "^(-1)",
        cls: "k-fn",
        label: "x^y",
        shiftLabel: "x⁻¹",
      },
      {
        id: "LOG",
        main: "log10(",
        shift: "10^(",
        cls: "k-fn",
        label: "log",
        shiftLabel: "10ˣ",
      },
      {
        id: "LN",
        main: "ln(",
        shift: "exp(",
        cls: "k-fn",
        label: "ln",
        shiftLabel: "eˣ",
      },
    ],
    [
      {
        id: "NEG",
        main: "-",
        cls: "k-fn",
        label: "(-)",
        alpha: "A",
        alphaLabel: "[A]",
      },
      {
        id: "DMS",
        main: "dms(",
        cls: "k-fn",
        label: "°′″",
        alpha: "B",
        alphaLabel: "[B]",
      },
      {
        id: "HYP",
        main: "hyp",
        topLabel: "Abs",
        shiftAction: () => insert("abs("),
        alpha: "C",
        alphaLabel: "[C]",
        cls: "k-fn",
      },
      {
        id: "SIN",
        label: "sin",
        shiftLabel: "sin⁻¹",
        alpha: "D",
        alphaLabel: "[D]",
        cls: "k-fn",
      },
      {
        id: "COS",
        label: "cos",
        shiftLabel: "cos⁻¹",
        alpha: "E",
        alphaLabel: "[E]",
        cls: "k-fn",
      },
      {
        id: "TAN",
        label: "tan",
        shiftLabel: "tan⁻¹",
        alpha: "F",
        alphaLabel: "[F]",
        cls: "k-fn",
      },
    ],
    [
      {
        id: "RCL",
        main: "M",
        topLabel: "STO",
        shiftAction: () => press({ id: "STO" }),
        cls: "k-fn",
        label: "RCL",
      },
      {
        id: "ENG",
        main: "eng",
        shift: "i",
        topLabel: "←",
        shiftAction: () =>
          complexMode ? insert("i") : dispatch({ type: "left" }),
        cls: "k-fn",
        label: "ENG",
      },
      {
        id: "LP",
        main: "(",
        label: "(",
        topLabel: "%",
        shiftAction: () => insert("/100"),
        cls: "k-fn",
      },
      {
        id: "RP",
        main: ")",
        topLabel: ",",
        shiftAction: () => insert(","),
        alpha: "X",
        alphaLabel: "[X]",
        cls: "k-fn",
      },
      {
        id: "SD",
        main: "",
        topLabel: "a b/c",
        alpha: "Y",
        alphaLabel: "[Y]",
        cls: "k-fn",
        label: "S⇔D",
      },
      {
        id: "MPLUS",
        main: "",
        topLabel: "M",
        shiftAction: () => press({ id: "MMINUS" }),
        cls: "k-fn",
        label: "M+",
      },
    ],
    [
      {
        id: "7",
        main: "7",
        topLabel: "CONST",
        shiftAction: () => insert("pi"),
        cls: "k-num",
      },
      {
        id: "8",
        main: "8",
        topLabel: "CONV",
        shiftAction: () => setDisplay("CONV: use MODE"),
        cls: "k-num",
      },
      {
        id: "9",
        main: "9",
        topLabel: "CLR",
        shiftAction: clearAll,
        cls: "k-num",
      },
      {
        id: "DEL",
        main: "",
        topLabel: "INS",
        shiftAction: () => dispatch({ type: "right" }),
        cls: "k-del",
      },
      {
        id: "AC",
        main: "",
        topLabel: "OFF",
        shiftAction: fullReset,
        cls: "k-ac",
      },
    ],
    [
      {
        id: "4",
        main: "4",
        topLabel: "MATRIX",
        shiftAction: () => {
          setMode("MATRIX");
          clearAll();
        },
        cls: "k-num",
      },
      {
        id: "5",
        main: "5",
        topLabel: "VECTOR",
        shiftAction: () => {
          setMode("VECTOR");
          clearAll();
        },
        cls: "k-num",
      },
      {
        id: "6",
        main: "6",
        topLabel: "BASE-N",
        shiftAction: () => {
          setMode("BASE-N");
          clearAll();
        },
        cls: "k-num",
      },
      {
        id: "MUL",
        main: "*",
        topLabel: "nPr",
        shiftAction: () => insert(" nPr "),
        cls: "k-op",
        label: "×",
      },
      {
        id: "DIV",
        main: "/",
        topLabel: "nCr",
        shiftAction: () => insert(" nCr "),
        cls: "k-op",
        label: "÷",
      },
    ],
    [
      {
        id: "1",
        main: "1",
        topLabel: "STAT",
        shiftAction: () => {
          setMode("STAT");
          clearAll();
        },
        cls: "k-num",
      },
      {
        id: "2",
        main: "2",
        topLabel: "CMPLX",
        shiftAction: () => {
          setMode("CMPLX");
          clearAll();
        },
        cls: "k-num",
      },
      {
        id: "3",
        main: "3",
        topLabel: "BASE",
        shiftAction: () => {
          setMode("BASE-N");
          clearAll();
        },
        cls: "k-num",
      },
      {
        id: "ADD",
        main: "+",
        topLabel: "Pol",
        shiftAction: () => insert("pol("),
        cls: "k-op",
      },
      {
        id: "SUB",
        main: "-",
        topLabel: "Rec",
        shiftAction: () => insert("rec("),
        cls: "k-op",
        label: "−",
      },
    ],
    [
      {
        id: "0",
        main: "0",
        topLabel: "Rnd",
        shiftAction: () => insert("round("),
        cls: "k-num",
      },
      {
        id: "DOT",
        main: ".",
        topLabel: "Ran#",
        shiftAction: () => insert("Ran()"),
        cls: "k-num",
      },
      {
        id: "EXP10",
        main: "*10^",
        topLabel: "RanInt",
        shiftAction: () => insert("randomInt("),
        cls: "k-fn",
        label: "×10ˣ",
      },
      {
        id: "ANS",
        main: "Ans",
        topLabel: "DRG▶",
        shiftAction: () =>
          setAngleUnit((u) =>
            u === "DEG" ? "RAD" : u === "RAD" ? "GRAD" : "DEG",
          ),
        cls: "k-fn",
      },
      { id: "EQ", main: "", cls: "k-eq", label: "=", alpha: "=" },
    ],
  ];

  return (
    <div className="calc-body">
      <div className="calculator-brand">
        <div className="brand-name">fx-991ES PLUS</div>
      </div>
      <div
        className={`calc-display ${!basicDisplayMode ? "mode-expanded" : ""}`}
      >
        <div className="status-row">
          <span className={shiftActive ? "active" : ""}>S</span>
          <span className={alphaActive ? "active" : ""}>A</span>
          <span className={hypActive ? "active" : ""}>HYP</span>
          <span>{mode}</span>
          <span>{angleUnit}</span>
          {M !== 0 && <span className="active">M</span>}
        </div>
        {basicDisplayMode && (
          <>
            <div className="expr-line">
              <div className="active-expr">
                <RowView
                  row={tree.expr}
                  editable={true}
                  cursorPath={tree.path}
                  cursorPos={tree.pos}
                  path={[]}
                />
              </div>
            </div>
            <div
              className={`result-line ${error ? "err" : ""} ${String(display).length > 12 ? "compact-result" : ""}`}
            >
              <NaturalDisplay value={display} isResult />
            </div>
          </>
        )}
        {!basicDisplayMode && (
          <div className="calc-mode-inline-panel">{renderModePanel()}</div>
        )}
        {showMenu && (
          <div className="mode-overlay">
            {MODES.map((m) => (
              <div
                key={m}
                className="mode-item"
                onClick={() => {
                  setMode(m);
                  setShowMenu(false);
                  clearAll();
                }}
              >
                {m}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="top-controls">
        <button className="key k-shift" onClick={() => press({ id: "SHIFT" })}>
          SHIFT
        </button>
        <button className="key k-alpha" onClick={() => press({ id: "ALPHA" })}>
          ALPHA
        </button>
        <div className="replay-pad">
          <button className="replay-up" onClick={() => press({ id: "UP" })}>
            ▲
          </button>
          <button className="replay-left" onClick={() => press({ id: "LEFT" })}>
            ◀
          </button>
          <span className="replay-center" />
          <button
            className="replay-right"
            onClick={() => press({ id: "RIGHT" })}
          >
            ▶
          </button>
          <button className="replay-down" onClick={() => press({ id: "DOWN" })}>
            ▼
          </button>
        </div>
        <button className="key k-fn" onClick={() => press({ id: "MENU" })}>
          MODE
        </button>
        <button className="key k-on" onClick={() => press({ id: "ON" })}>
          ON
        </button>
      </div>

      <div className="keypad">
        {rows
          .filter(
            (row) => basicDisplayMode || (row.length !== 4 && row.length !== 6),
          )
          .map((row, ri) => (
            <div
              className={`keypad-row keypad-row-${row.length}`}
              key={`row-${ri}`}
            >
              {row.map((btn) => (
                <button
                  key={btn.id}
                  className={`key ${btn.cls || ""} ${btn.disabled ? "disabled" : ""}`}
                  disabled={btn.disabled}
                  onClick={() => press(btn)}
                >
                  {btn.topLabel && (
                    <span className="top-label">{btn.topLabel}</span>
                  )}
                  {btn.shiftLabel && (
                    <span className="shift-label">{btn.shiftLabel}</span>
                  )}
                  {btn.alphaLabel && (
                    <span className="alpha-label">{btn.alphaLabel}</span>
                  )}
                  <span className="main-label">
                    {btn.label !== undefined
                      ? btn.label
                      : btn.main === ""
                        ? btn.id
                        : btn.main.replace(/\($/, "")}
                  </span>
                </button>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
