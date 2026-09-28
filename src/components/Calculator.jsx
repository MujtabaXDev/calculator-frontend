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
   SCIENTIFIC CONSTANTS (SHIFT + 7)
   ========================================================================= */
const SCI_CONSTS = [
  { id: 1, symbol: "mp", value: 1.67262192369e-27 },
  { id: 2, symbol: "mn", value: 1.67492749804e-27 },
  { id: 3, symbol: "me", value: 9.1093837015e-31 },
  { id: 4, symbol: "mμ", value: 1.883531627e-28 },
  { id: 5, symbol: "a₀", value: 5.29177210903e-11 },
  { id: 6, symbol: "h", value: 6.62607015e-34 },
  { id: 7, symbol: "μN", value: 5.050783699e-27 },
  { id: 8, symbol: "μB", value: 9.2740100783e-24 },
  { id: 9, symbol: "ħ", value: 1.054571817e-34 },
  { id: 10, symbol: "α", value: 7.2973525693e-3 },
  { id: 11, symbol: "re", value: 2.8179403262e-15 },
  { id: 12, symbol: "λc", value: 2.42631023867e-12 },
  { id: 13, symbol: "γp", value: 2.6752218744e8 },
  { id: 14, symbol: "λcp", value: 1.32140985539e-15 },
  { id: 15, symbol: "λcn", value: 1.31959090581e-15 },
  { id: 16, symbol: "R∞", value: 10973731.56816 },
  { id: 17, symbol: "u", value: 1.6605390666e-27 },
  { id: 18, symbol: "μp", value: 1.41060679736e-26 },
  { id: 19, symbol: "μe", value: -9.2847647043e-24 },
  { id: 20, symbol: "μn", value: -9.6623651e-27 },
  { id: 21, symbol: "μμ", value: -4.4904483e-26 },
  { id: 22, symbol: "F", value: 96485.33212 },
  { id: 23, symbol: "e", value: 1.602176634e-19 },
  { id: 24, symbol: "Nₐ", value: 6.02214076e23 },
  { id: 25, symbol: "k", value: 1.380649e-23 },
  { id: 26, symbol: "Vm", value: 2.24139696e-2 },
  { id: 27, symbol: "R", value: 8.314462618 },
  { id: 28, symbol: "c₀", value: 299792458 },
  { id: 29, symbol: "c₁", value: 3.741771852e-16 },
  { id: 30, symbol: "c₂", value: 1.438776877e-2 },
  { id: 31, symbol: "σ", value: 5.670374419e-8 },
  { id: 32, symbol: "ε₀", value: 8.8541878128e-12 },
  { id: 33, symbol: "μ₀", value: 1.25663706212e-6 },
  { id: 34, symbol: "φ₀", value: 2.067833848e-15 },
  { id: 35, symbol: "g", value: 9.80665 },
  { id: 36, symbol: "G₀", value: 7.748091729e-5 },
  { id: 37, symbol: "Z₀", value: 376.730313668 },
  { id: 38, symbol: "t", value: 273.15 },
  { id: 39, symbol: "G", value: 6.6743e-11 },
  { id: 40, symbol: "atm", value: 101325 },
];

/* =========================================================================
   UNIT CONVERSIONS (SHIFT + 8)
   ========================================================================= */
const UNIT_CONVS = [
  { id: 1, from: "in", to: "cm", factor: 2.54 },
  { id: 2, from: "cm", to: "in", factor: 0.393701 },
  { id: 3, from: "ft", to: "m", factor: 0.3048 },
  { id: 4, from: "m", to: "ft", factor: 3.28084 },
  { id: 5, from: "yd", to: "m", factor: 0.9144 },
  { id: 6, from: "m", to: "yd", factor: 1.09361 },
  { id: 7, from: "mile", to: "km", factor: 1.60934 },
  { id: 8, from: "km", to: "mile", factor: 0.621371 },
  { id: 9, from: "n mile", to: "m", factor: 1852 },
  { id: 10, from: "m", to: "n mile", factor: 0.000539957 },
  { id: 11, from: "acre", to: "m²", factor: 4046.86 },
  { id: 12, from: "m²", to: "acre", factor: 0.000247105 },
  { id: 13, from: "gal(US)", to: "L", factor: 3.78541 },
  { id: 14, from: "L", to: "gal(US)", factor: 0.264172 },
  { id: 15, from: "gal(UK)", to: "L", factor: 4.54609 },
  { id: 16, from: "L", to: "gal(UK)", factor: 0.219969 },
  { id: 17, from: "pc", to: "km", factor: 3.0857e13 },
  { id: 18, from: "km", to: "pc", factor: 3.2408e-14 },
  { id: 19, from: "km", to: "m", factor: 1000 },
  { id: 20, from: "m", to: "km", factor: 0.001 },
  { id: 21, from: "oz", to: "g", factor: 28.3495 },
  { id: 22, from: "g", to: "oz", factor: 0.035274 },
  { id: 23, from: "lb", to: "kg", factor: 0.453592 },
  { id: 24, from: "kg", to: "lb", factor: 2.20462 },
  { id: 25, from: "atm", to: "Pa", factor: 101325 },
  { id: 26, from: "Pa", to: "atm", factor: 9.86923e-6 },
  { id: 27, from: "mmHg", to: "Pa", factor: 133.322 },
  { id: 28, from: "Pa", to: "mmHg", factor: 0.00750062 },
  { id: 29, from: "hp", to: "kW", factor: 0.7457 },
  { id: 30, from: "kW", to: "hp", factor: 1.34102 },
  { id: 31, from: "kgf/cm²", to: "Pa", factor: 98066.5 },
  { id: 32, from: "Pa", to: "kgf/cm²", factor: 1.01972e-5 },
  { id: 33, from: "kgf·m", to: "J", factor: 9.80665 },
  { id: 34, from: "J", to: "kgf·m", factor: 0.101972 },
  { id: 35, from: "lbf/in²", to: "kPa", factor: 6.89476 },
  { id: 36, from: "kPa", to: "lbf/in²", factor: 0.145038 },
  { id: 37, from: "°F", to: "°C", factor: null },
  { id: 38, from: "°C", to: "°F", factor: null },
  { id: 39, from: "J", to: "cal", factor: 0.238846 },
  { id: 40, from: "cal", to: "J", factor: 4.184 },
];

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
  integral: ["lower", "upper", "integrand"],
  derivative: ["expr", "point"],
  log: ["base", "arg"],
  sum: ["var", "start", "upper", "body"],
  mixedfrac: ["whole", "num", "den"],
};
const COMPOUND_TYPES = new Set([
  "frac",
  "sqrt",
  "nthroot",
  "pow",
  "group",
  "func",
  "integral",
  "derivative",
  "log",
  "sum",
  "mixedfrac",
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
  "integral",
  "derivative",
  "log",
  "sum",
  "mixedfrac",
  "sciConst",
  "unitFactor",
  "const",
  "ans",
  "text",
]);
const isValue = (it) => it && VALUE_TYPES.has(it.t);

/* spaced-operator check — nPr / nCr should NOT get implicit * around them */
function isSpacedOp(it) {
  return (
    it && it.t === "text" && (it.v.trim() === "nPr" || it.v.trim() === "nCr")
  );
}

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
function insertRaw(state, item, enterField = null, enterPos = 0) {
  const row = getIn(state.expr, state.path);
  const newRow = [...row.slice(0, state.pos), item, ...row.slice(state.pos)];
  const newExpr = setIn(state.expr, state.path, newRow);
  let path = state.path,
    pos = state.pos + 1;
  if (enterField) {
    path = [...state.path, { index: state.pos, field: enterField }];
    pos = enterPos;
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

/* ---- Mixed fraction a b/c ---- */
function insertMixedFrac(state) {
  return insertRaw(
    state,
    { t: "mixedfrac", whole: [], num: [], den: [] },
    "whole",
  );
}

function insertSqrt(state) {
  return insertRaw(state, { t: "sqrt", radicand: [] }, "radicand");
}

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

function insertGroup(state) {
  return insertRaw(state, { t: "group", body: [] }, "body");
}
function insertAns(state) {
  return insertRaw(state, { t: "ans" });
}
function insertConst(state, name) {
  return insertRaw(state, { t: "const", name });
}

/* ---- Scientific constant ---- */
function insertSciConst(state, id) {
  return insertRaw(state, { t: "sciConst", id });
}

/* ---- Unit-conversion factor (prefixed by ×) ---- */
function insertUnitFactor(state, factor, label) {
  const s = insertRaw(state, { t: "op", v: "*" });
  return insertRaw(s, { t: "unitFactor", factor, label });
}

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

/* ×10ˣ — prepends × when needed */
function insertPow10(state) {
  const row = getIn(state.expr, state.path);
  const prev = state.pos > 0 ? row[state.pos - 1] : null;
  const needsMul = prev && prev.t !== "op" && prev.t !== "neg";
  let s = state;
  if (needsMul) {
    s = insertRaw(s, { t: "op", v: "*" });
  }
  return insertRaw(
    s,
    { t: "pow", base: [{ t: "digit", v: "10" }], exp: [] },
    "exp",
  );
}

/* e^□ — pow with base = e */
function insertEPow(state) {
  return insertRaw(
    state,
    { t: "pow", base: [{ t: "const", name: "e" }], exp: [] },
    "exp",
  );
}

function insertFunc(state, name) {
  return insertRaw(state, { t: "func", name, body: [] }, "body");
}

function insertIntegral(state) {
  return insertRaw(
    state,
    { t: "integral", lower: [], upper: [], integrand: [] },
    "lower",
  );
}

function insertDerivative(state) {
  return insertRaw(state, { t: "derivative", expr: [], point: [] }, "expr");
}

function insertLog(state) {
  return insertRaw(state, { t: "log", base: [], arg: [] }, "arg");
}

function insertSum(state) {
  return insertRaw(
    state,
    {
      t: "sum",
      var: [{ t: "text", v: "X" }],
      start: [],
      upper: [],
      body: [],
    },
    "var",
    1,
  );
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
  else if (parent.t === "mixedfrac") {
    if (dir === "up") {
      if (last.field === "num") target = "whole";
      else if (last.field === "den") target = "num";
    } else {
      if (last.field === "whole") target = "num";
      else if (last.field === "num") target = "den";
    }
  } else if (parent.t === "nthroot")
    target = dir === "up" ? "index" : "radicand";
  else if (parent.t === "pow") target = dir === "up" ? "exp" : "base";
  else if (parent.t === "integral") {
    if (dir === "up") {
      if (last.field === "lower") target = "upper";
      else if (last.field === "integrand") target = "upper";
    } else {
      if (last.field === "upper") target = "lower";
      else if (last.field === "lower") target = "integrand";
    }
  } else if (parent.t === "log") {
    if (dir === "up") target = "base";
    else target = "arg";
  } else if (parent.t === "sum") {
    if (dir === "up") {
      if (last.field === "start") target = "upper";
      else if (last.field === "body") target = "upper";
      else if (last.field === "var") target = "upper";
    } else {
      if (last.field === "upper") target = "start";
      else if (last.field === "start") target = "body";
    }
  }
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

/* ------------- SERIALIZE — key fix for nPr/nCr ------------- */
function serializeTree(row) {
  let out = "";
  let prevVal = false;
  for (const it of row) {
    const v = isValue(it) && !isSpacedOp(it);
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
    case "mixedfrac": {
      const w = serializeTree(it.whole) || "0";
      const n = serializeTree(it.num) || "0";
      const d = serializeTree(it.den) || "1";
      return `((${w})+(${n})/(${d}))`;
    }
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
    case "sciConst": {
      const c = SCI_CONSTS.find((x) => x.id === it.id);
      return c ? String(c.value) : "0";
    }
    case "unitFactor":
      return String(it.factor);
    case "integral":
      return `INTEGRAL(${serializeTree(it.lower)},${serializeTree(it.upper)},${serializeTree(it.integrand)})`;
    case "derivative":
      return `DDX(${serializeTree(it.expr)},${serializeTree(it.point)})`;
    case "log": {
      const baseStr = serializeTree(it.base);
      const argStr = serializeTree(it.arg);
      if (!baseStr || baseStr === "10") return `log10(${argStr})`;
      return `(ln(${argStr})/ln(${baseStr}))`;
    }
    case "sum":
      return `SUM(${serializeTree(it.upper)},${serializeTree(it.var)},${serializeTree(it.start)},${serializeTree(it.body)})`;
    case "text":
      return it.v;
    default:
      return "";
  }
}

/* =========================================================================
   NUMERICAL INTEGRATION + DIFFERENTIATION
   ========================================================================= */
function simpsonIntegral(f, a, b, n = 1000) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  if (n % 2 !== 0) n++;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    const fx = f(x);
    if (!Number.isFinite(fx)) return NaN;
    sum += fx * (i % 2 === 0 ? 2 : 4);
  }
  return (h / 3) * sum;
}

function numericalDerivative(f, x) {
  if (!Number.isFinite(x)) return NaN;
  const scale = Math.max(1, Math.abs(x));
  const D = (h) => {
    const fp = f(x + h);
    const fm = f(x - h);
    if (!Number.isFinite(fp) || !Number.isFinite(fm)) return NaN;
    return (fp - fm) / (2 * h);
  };
  const h1 = scale * 1e-4;
  const h2 = scale * 1e-5;
  const h3 = scale * 1e-6;
  const d1 = D(h1),
    d2 = D(h2),
    d3 = D(h3);
  if (Number.isFinite(d1) && Number.isFinite(d2) && Number.isFinite(d3)) {
    const r1 = (4 * d2 - d1) / 3;
    const r2 = (4 * d3 - d2) / 3;
    const result = (16 * r2 - r1) / 15;
    if (Number.isFinite(result)) return result;
  }
  if (Number.isFinite(d3)) return d3;
  if (Number.isFinite(d2)) return d2;
  if (Number.isFinite(d1)) return d1;
  return NaN;
}

function substituteVar(row, varName, value) {
  return row.map((it) => {
    if (it.t === "text" && it.v === varName) {
      return { t: "digit", v: String(value) };
    }
    if (it.t === "var" && it.name === varName) {
      return { t: "digit", v: String(value) };
    }
    if (isCompound(it)) {
      const copy = { ...it };
      for (const f of FIELD_ORDER[it.t]) {
        copy[f] = substituteVar(it[f], varName, value);
      }
      return copy;
    }
    return it;
  });
}

function resolveSpecialNodes(row, ctx) {
  return row.map((it) => {
    if (it.t === "derivative") {
      const innerExpr = resolveSpecialNodes(it.expr, ctx);
      const innerPoint = resolveSpecialNodes(it.point, ctx);
      try {
        const pointStr = serializeTree(innerPoint) || "0";
        const pointResult = calcEvaluate(preprocess(pointStr), ctx);
        const pointVal =
          typeof pointResult === "number" ? pointResult : Number(pointResult);
        if (!Number.isFinite(pointVal)) return { t: "digit", v: "0" };

        const f = (x) => {
          try {
            const sub = substituteVar(innerExpr, "X", x);
            const s = serializeTree(sub) || "0";
            const r = calcEvaluate(preprocess(s), ctx);
            const num = typeof r === "number" ? r : Number(r);
            return Number.isFinite(num) ? num : NaN;
          } catch {
            return NaN;
          }
        };
        const d = numericalDerivative(f, pointVal);
        return { t: "digit", v: Number.isFinite(d) ? String(d) : "0" };
      } catch {
        return { t: "digit", v: "0" };
      }
    }

    if (it.t === "integral") {
      const loRow = resolveSpecialNodes(it.lower, ctx);
      const hiRow = resolveSpecialNodes(it.upper, ctx);
      const integrandRow = resolveSpecialNodes(it.integrand, ctx);
      try {
        const loStr = serializeTree(loRow) || "0";
        const hiStr = serializeTree(hiRow) || "0";
        const lo = Number(calcEvaluate(preprocess(loStr), ctx));
        const hi = Number(calcEvaluate(preprocess(hiStr), ctx));
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
          return { t: "digit", v: "0" };
        }
        const f = (x) => {
          try {
            const sub = substituteVar(integrandRow, "X", x);
            const s = serializeTree(sub) || "0";
            const r = calcEvaluate(preprocess(s), ctx);
            const num = typeof r === "number" ? r : Number(r);
            return Number.isFinite(num) ? num : NaN;
          } catch {
            return NaN;
          }
        };
        const raw = simpsonIntegral(f, lo, hi, 1000);
        return { t: "digit", v: Number.isFinite(raw) ? String(raw) : "0" };
      } catch {
        return { t: "digit", v: "0" };
      }
    }

    if (it.t === "sum") {
      const upperRow = resolveSpecialNodes(it.upper, ctx);
      const startRow = resolveSpecialNodes(it.start, ctx);
      const bodyRow = resolveSpecialNodes(it.body, ctx);
      const varName =
        it.var.find((n) => n.t === "text" && /^[A-Za-z]/.test(n.v))?.v || "X";
      try {
        const upperStr = serializeTree(upperRow) || "0";
        const startStr = serializeTree(startRow) || "0";
        const upperVal = Number(calcEvaluate(preprocess(upperStr), ctx));
        const startVal = Number(calcEvaluate(preprocess(startStr), ctx));
        if (!Number.isFinite(upperVal) || !Number.isFinite(startVal)) {
          return { t: "digit", v: "0" };
        }
        if (Math.abs(upperVal - startVal) > 10000) {
          return { t: "digit", v: "0" };
        }
        const step = upperVal >= startVal ? 1 : -1;
        let total = 0;
        for (
          let i = startVal;
          step > 0 ? i <= upperVal : i >= upperVal;
          i += step
        ) {
          const sub = substituteVar(bodyRow, varName, i);
          try {
            const r = calcEvaluate(preprocess(serializeTree(sub) || "0"), ctx);
            const n = typeof r === "number" ? r : Number(r);
            if (Number.isFinite(n)) total += n;
          } catch {
            /* skip bad term */
          }
        }
        return { t: "digit", v: String(total) };
      } catch {
        return { t: "digit", v: "0" };
      }
    }

    if (isCompound(it)) {
      const copy = { ...it };
      for (const f of FIELD_ORDER[it.t]) {
        copy[f] = resolveSpecialNodes(it[f], ctx);
      }
      return copy;
    }
    return it;
  });
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
    case "sciConst": {
      const c = SCI_CONSTS.find((x) => x.id === item.id);
      return <span className="sci-const">{c ? c.symbol : "?"}</span>;
    }
    case "unitFactor":
      return <span className="unit-factor">{item.label}</span>;

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

    case "mixedfrac":
      return (
        <span className="mixedfrac-editor">
          <span className="mixedfrac-whole">
            <RowView
              row={item.whole}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("whole")}
            />
          </span>
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

    case "func": {
      const lower = item.name.toLowerCase();
      const displayName =
        lower === "log10"
          ? "log"
          : lower === "pol"
            ? "Pol"
            : lower === "rec"
              ? "Rec"
              : item.name;
      return (
        <span className="func-editor">
          <span className="func-name">{displayName}</span>
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
    }

    case "integral":
      return (
        <span className="integral-editor">
          <span className="integral-symbol-wrap">
            <span className="integral-symbol">∫</span>
            <span className="integral-bounds">
              <span className="integral-upper">
                <RowView
                  row={item.upper}
                  editable={editable}
                  cursorPath={cursorPath}
                  cursorPos={cursorPos}
                  path={childPath("upper")}
                />
              </span>
              <span className="integral-lower">
                <RowView
                  row={item.lower}
                  editable={editable}
                  cursorPath={cursorPath}
                  cursorPos={cursorPos}
                  path={childPath("lower")}
                />
              </span>
            </span>
          </span>
          <span className="integral-body">
            <RowView
              row={item.integrand}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("integrand")}
            />
          </span>
          <span className="integral-dx">dx</span>
        </span>
      );

    case "derivative":
      return (
        <span className="derivative-editor">
          <span className="derivative-op">
            <span className="derivative-d">d</span>
            <span className="derivative-rule" />
            <span className="derivative-dx">dx</span>
          </span>
          <span className="paren">(</span>
          <RowView
            row={item.expr}
            editable={editable}
            cursorPath={cursorPath}
            cursorPos={cursorPos}
            path={childPath("expr")}
          />
          <span className="paren">)</span>
          <span className="derivative-bar">|</span>
          <span className="derivative-var">x=</span>
          <RowView
            row={item.point}
            editable={editable}
            cursorPath={cursorPath}
            cursorPos={cursorPos}
            path={childPath("point")}
          />
        </span>
      );

    case "log":
      return (
        <span className="log-editor">
          <span className="log-name">log</span>
          <span className="log-base">
            <RowView
              row={item.base}
              editable={editable}
              cursorPath={cursorPath}
              cursorPos={cursorPos}
              path={childPath("base")}
            />
          </span>
          <span className="log-paren">(</span>
          <RowView
            row={item.arg}
            editable={editable}
            cursorPath={cursorPath}
            cursorPos={cursorPos}
            path={childPath("arg")}
          />
          <span className="log-paren">)</span>
        </span>
      );

    case "sum":
      return (
        <span className="sum-editor">
          <span className="sum-symbol-wrap">
            <span className="sum-symbol">Σ</span>
            <span className="sum-bounds">
              <span className="sum-upper">
                <RowView
                  row={item.upper}
                  editable={editable}
                  cursorPath={cursorPath}
                  cursorPos={cursorPos}
                  path={childPath("upper")}
                />
              </span>
              <span className="sum-lower">
                <span className="sum-var-slot">
                  <RowView
                    row={item.var}
                    editable={editable}
                    cursorPath={cursorPath}
                    cursorPos={cursorPos}
                    path={childPath("var")}
                  />
                </span>
                <span className="sum-eq">=</span>
                <span className="sum-start-slot">
                  <RowView
                    row={item.start}
                    editable={editable}
                    cursorPath={cursorPath}
                    cursorPos={cursorPos}
                    path={childPath("start")}
                  />
                </span>
              </span>
            </span>
          </span>
          <span className="sum-body-wrap">
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
        </span>
      );

    default:
      return null;
  }
}

function RowView({ row, editable, cursorPath, cursorPos, path }) {
  const here = editable && pathsEqual(path, cursorPath);
  const inFrac = path.some((s) => s.field === "num" || s.field === "den");
  const variant = inFrac ? "fraction-caret" : "caret";

  if (row.length === 0) {
    return (
      <span className="empty-slot">
        {here && <Cursor variant={variant} />}
        <span className="empty-box" aria-hidden="true" />
      </span>
    );
  }

  const out = [];
  for (let i = 0; i <= row.length; i++) {
    if (here && cursorPos === i)
      out.push(<Cursor key={"c" + i} variant={variant} />);
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
    case "mixedfrac":
      return insertMixedFrac(state);
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
    case "epow":
      return insertEPow(state);
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
    case "integral":
      return insertIntegral(state);
    case "derivative":
      return insertDerivative(state);
    case "log":
      return insertLog(state);
    case "sum":
      return insertSum(state);
    case "sciConst":
      return insertSciConst(state, action.id);
    case "unitFactor":
      return insertUnitFactor(state, action.factor, action.label);
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
const HYP_MENU = [
  { key: "1", name: "sinh(", label: "sinh", desc: "Hyperbolic sine" },
  { key: "2", name: "cosh(", label: "cosh", desc: "Hyperbolic cosine" },
  { key: "3", name: "tanh(", label: "tanh", desc: "Hyperbolic tangent" },
  { key: "4", name: "coth(", label: "coth", desc: "Hyperbolic cotangent" },
  { key: "5", name: "sech(", label: "sech", desc: "Hyperbolic secant" },
  { key: "6", name: "csch(", label: "csch", desc: "Hyperbolic cosecant" },
];

/* -------- preprocess — expand nPr/nCr to factorial expressions -------- */
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

  /* Expand nPr / nCr to factorial form (mathjs has no nPr/nCr built-ins) */
  out = out.replace(
    /\bnPr\(([^,]+),([^)]+)\)/g,
    "((factorial($1))/(factorial(($1)-($2))))",
  );
  out = out.replace(
    /\bnCr\(([^,]+),([^)]+)\)/g,
    "((factorial($1))/((factorial($2))*(factorial(($1)-($2)))))",
  );

  out = out.replace(/\)\s*(?=[A-Za-z\d(])/g, ")*");
  out = out.replace(
    /(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)\s*(?=[A-Za-z(])/g,
    "$1*",
  );
  return out;
}

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
  const [hypMenuOpen, setHypMenuOpen] = useState(false);
  const [constMenuOpen, setConstMenuOpen] = useState(false);
  const [convMenuOpen, setConvMenuOpen] = useState(false);

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
    if (text === "log10(") return dispatch({ type: "log" });
    if (text === "sum(") return dispatch({ type: "sum" });
    if (text === "exp(") return dispatch({ type: "epow" });
    if (text === "pi") return dispatch({ type: "const", name: "pi" });
    if (text === "e") return dispatch({ type: "const", name: "e" });
    if (text === "i") return dispatch({ type: "const", name: "i" });
    if (text === "M") return dispatch({ type: "const", name: "M" });
    if (text === "Ans") return dispatch({ type: "ans" });
    if (text === "(") return dispatch({ type: "group" });
    if (text === ")") return dispatch({ type: "right" });
    const m = text.match(/^([a-zA-Z][a-zA-Z0-9_]*)\($/);
    if (m) {
      const lower = m[1].toLowerCase();
      const name = lower === "pol" ? "pol" : lower === "rec" ? "rec" : m[1];
      return dispatch({ type: "func", name });
    }
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

  function doEvaluate() {
    let clean;
    try {
      const evalCtx = { mode: angleUnit, complexMode, Ans, M };
      const resolvedExpr = resolveSpecialNodes(tree.expr, evalCtx);

      const serialized = serializeTree(resolvedExpr) || "0";
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

      setHypMenuOpen(true);
      return;
    }

    if (btn.id === "INTEGRAL") {
      if (shiftActive) {
        dispatch({ type: "derivative" });
        setShiftActive(false);
        return;
      }
      dispatch({ type: "integral" });
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
      if (hypMenuOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setHypMenuOpen(false);
          return;
        }
        const item = HYP_MENU.find((m) => m.key === e.key);
        if (item) {
          e.preventDefault();
          insert(item.name);
          setHypMenuOpen(false);
          return;
        }
        return;
      }
      if (constMenuOpen || convMenuOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setConstMenuOpen(false);
          setConvMenuOpen(false);
          return;
        }
        return;
      }
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
  }, [hypMenuOpen, constMenuOpen, convMenuOpen]); // eslint-disable-line

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
      {
        id: "FRAC",
        cls: "k-fn",
        label: "a b/c",
        shiftLabel: "d/c",
        shiftAction: () => dispatch({ type: "mixedfrac" }),
      },
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
        shiftAction: () => dispatch({ type: "epow" }),
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
        shiftAction: () => setConstMenuOpen((v) => !v),
        cls: "k-num",
      },
      {
        id: "8",
        main: "8",
        topLabel: "CONV",
        shiftAction: () => setConvMenuOpen((v) => !v),
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
        shiftAction: () => insert("Pol("),
        cls: "k-op",
      },
      {
        id: "SUB",
        main: "-",
        topLabel: "Rec",
        shiftAction: () => insert("Rec("),
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
        topLabel: "π",
        shiftAction: () => insert("pi"),
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

      {/* ================= TOP CONTROLS (Now 2 Rows) ================= */}
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

        {/* 👇 INSERTED: The 4-key row (CALC, ∫dx, x⁻¹, log□) mapped directly into the grid 👇 */}
        {basicDisplayMode &&
          rows[0] &&
          rows[0].map((btn) => (
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

      {/* ================= MAIN KEYPAD ================= */}
      <div className="keypad">
        {rows
          .filter((row) => {
            // 👇 UPDATED: Exclude the 4-key row from the main keypad in basic mode,
            // because we just moved it into top-controls above.
            if (basicDisplayMode && row.length === 4) return false;

            return basicDisplayMode || (row.length !== 4 && row.length !== 6);
          })
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

      {hypMenuOpen && (
        <div className="hyp-menu" onClick={(e) => e.stopPropagation()}>
          {HYP_MENU.map((item) => (
            <div
              key={item.key}
              className="hyp-menu-item"
              onClick={() => {
                insert(item.name);
                setHypMenuOpen(false);
              }}
            >
              <span className="hyp-menu-num">{item.key}</span>
              <span className="hyp-menu-name">{item.label}</span>
              <span className="hyp-menu-desc">{item.desc}</span>
            </div>
          ))}
        </div>
      )}

      {constMenuOpen && (
        <div className="sci-menu" onClick={(e) => e.stopPropagation()}>
          <div className="sci-menu-title">Scientific Constants</div>
          <div className="sci-menu-grid">
            {SCI_CONSTS.map((c) => (
              <div
                key={c.id}
                className="sci-menu-item"
                onClick={() => {
                  dispatch({ type: "sciConst", id: c.id });
                  setConstMenuOpen(false);
                }}
                title={String(c.value)}
              >
                <span className="sci-menu-id">
                  {String(c.id).padStart(2, "0")}
                </span>
                <span className="sci-menu-sym">{c.symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {convMenuOpen && (
        <div className="sci-menu" onClick={(e) => e.stopPropagation()}>
          <div className="sci-menu-title">Unit Conversions</div>
          <div className="sci-menu-grid">
            {UNIT_CONVS.map((c) => (
              <div
                key={c.id}
                className="sci-menu-item"
                onClick={() => {
                  if (c.factor === null) {
                    setConvMenuOpen(false);
                    return;
                  }
                  dispatch({
                    type: "unitFactor",
                    factor: c.factor,
                    label: `${c.from}→${c.to}`,
                  });
                  setConvMenuOpen(false);
                }}
                title={c.factor !== null ? `×${c.factor}` : "formula"}
              >
                <span className="sci-menu-id">
                  {String(c.id).padStart(2, "0")}
                </span>
                <span className="sci-menu-sym">
                  {c.from}→{c.to}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {(hypMenuOpen || constMenuOpen || convMenuOpen || showMenu) && (
        <div
          className="menu-backdrop"
          onClick={() => {
            setHypMenuOpen(false);
            setConstMenuOpen(false);
            setConvMenuOpen(false);
            setShowMenu(false);
          }}
        />
      )}
    </div>
  );
}
