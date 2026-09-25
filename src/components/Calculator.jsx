import React, { useEffect, useState } from "react";
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
import { parse as parseMath, simplify } from "mathjs";

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
  let prev;
  let out = expr;
  let guard = 0;
  do {
    prev = out;
    out = out.replace(opPattern, (m, a, op, b) => `${op}(${a},${b})`);
    guard++;
  } while (out !== prev && guard < 10);

  // Implicit multiplication: "5sqrt(9)" → "5*sqrt(9)", "(2)(3)" → "(2)*(3)"
  out = out.replace(/\)\s*(?=[A-Za-z\d(])/g, ")*");
  out = out.replace(
    /(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)\s*(?=[A-Za-z(])/g,
    "$1*",
  );

  return out;
}

function exactDisplayExpression(expr, fallback) {
  const source = expr.replace(/\s+/g, "");
  const radicalPair = source.match(
    /^sqrt\(([^()]+)\)\/(\d+(?:\.\d+)?)\+sqrt\(\1\)\/(\d+(?:\.\d+)?)$/,
  );
  if (radicalPair) {
    const firstDenominator = Number(radicalPair[2]);
    const secondDenominator = Number(radicalPair[3]);
    const numerator = firstDenominator + secondDenominator;
    const denominator = firstDenominator * secondDenominator;
    return `${numerator}*sqrt(${radicalPair[1]})/${denominator}`;
  }
  if (/sqrt\(|pi|\b(e)\b/.test(source)) return source;
  if (/^[0-9+\-*/^().\s]+$/.test(source)) return String(fallback);
  try {
    return simplify(source).toString();
  } catch {
    return String(fallback);
  }
}

function displayExpression(value) {
  const superscript = (text) =>
    String(text).replace(
      /[0-9-]/g,
      (character) =>
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
        })[character],
    );
  return String(value)
    .replace(/\basin\(/g, "sin⁻¹(")
    .replace(/\bacos\(/g, "cos⁻¹(")
    .replace(/\batan\(/g, "tan⁻¹(")
    .replace(/cbrt\(/g, "∛(")
    .replace(/sqrt\(/g, "√(")
    .replace(/log10\(/g, "log(")
    .replace(/exp\(/g, "eˣ(")
    .replace(/\*10\^(-?\d+)/g, (_, exponent) => `×10${superscript(exponent)}`)
    .replace(/\*10\^/g, "×10ˣ")
    .replace(/\*/g, "×")
    .replace(/\^(-?\d+)/g, (_, exponent) => superscript(exponent));
}

function scientificDisplay(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  const absoluteValue = Math.abs(numericValue);
  if (absoluteValue === 0 || (absoluteValue >= 1e-6 && absoluteValue < 1e9))
    return null;
  const [coefficient, exponent] = numericValue.toExponential(6).split("e");
  const trimmedCoefficient = String(Number(coefficient));
  const signedExponent = Number(exponent);
  const superscript = String(signedExponent).replace(
    /[0-9-]/g,
    (character) =>
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
      })[character],
  );
  return `${trimmedCoefficient} × 10${superscript}`;
}

function NaturalDisplay({ value, className = "", isResult = false }) {
  if (!value) return null;
  if (!isResult) {
    return (
      <span className={`natural-display ${className}`}>
        {displayExpression(value)}
      </span>
    );
  }
  const mixedFraction = String(value)
    .trim()
    .match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFraction) {
    const [, whole, numerator, denominator] = mixedFraction;
    return (
      <span className={`natural-display mixed-fraction ${className}`}>
        <span className="mixed-whole">{whole}</span>
        <span className="mixed-part">
          <span>{numerator}</span>
          <span className="mixed-rule" />
          <span>{denominator}</span>
        </span>
      </span>
    );
  }
  if (value === "/") {
    return (
      <span className={`natural-display fraction-placeholder ${className}`}>
        <span className="fraction-slot" />
        <span className="fraction-bar" />
        <span className="fraction-slot" />
      </span>
    );
  }
  const numericValue = String(value).trim();
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(numericValue)) {
    const scientificValue = scientificDisplay(numericValue);
    return (
      <span className={`natural-display ${className}`}>
        {scientificValue || displayExpression(numericValue)}
      </span>
    );
  }
  if (
    /[+\-*/^,(]$/.test(String(value).trim()) ||
    /\*(?!10\^)/.test(String(value)) ||
    /\*10\^/.test(String(value))
  ) {
    return (
      <span className={`natural-display ${className}`}>
        {displayExpression(value)}
      </span>
    );
  }
  if (/\b(?:asin|acos|atan)\(/.test(String(value))) {
    return (
      <span className={`natural-display ${className}`}>
        {displayExpression(value)}
      </span>
    );
  }
  try {
    const tex = parseMath(String(value)).toTex({ parenthesis: "keep" });
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
        {displayExpression(value)}
      </span>
    );
  }
}

// ---------------------------------------------------------------------------
// Natural (Casio-style) inline display — recursive precedence parser.
// ---------------------------------------------------------------------------

function isDigitChar(ch) {
  return typeof ch === "string" && ch >= "0" && ch <= "9";
}
function isIdentChar(ch) {
  return typeof ch === "string" && /[A-Za-z_]/.test(ch);
}

function matchParenForward(expr, start) {
  let depth = 0;
  for (let i = start; i < expr.length; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function isUnaryAt(expr, i) {
  if (i <= 0) return true;
  const prev = expr[i - 1];
  return "+-*/^(,".includes(prev);
}

function findOperandStart(expr, end) {
  let i = end;
  if (i <= 0) return -1;
  if (expr[i - 1] === ")") {
    let depth = 0;
    let j = i - 1;
    for (; j >= 0; j--) {
      if (expr[j] === ")") depth++;
      else if (expr[j] === "(") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j < 0) return -1;
    while (j > 0 && isIdentChar(expr[j - 1])) j--;
    return j;
  }
  let j = i;
  while (
    j > 0 &&
    (isDigitChar(expr[j - 1]) ||
      expr[j - 1] === "." ||
      isIdentChar(expr[j - 1]))
  ) {
    j--;
  }
  if (j === i) return -1;
  if (j > 0 && expr[j - 1] === "-" && isUnaryAt(expr, j - 1)) j--;
  return j;
}

function findDenominatorEnd(expr, start) {
  let depth = 0;
  for (let i = start; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth > 0) depth--;
    } else if (depth === 0) {
      if (ch === "*") return i;
      if ((ch === "+" || ch === "-") && i > start && !isUnaryAt(expr, i)) {
        return i;
      }
    }
  }
  return expr.length;
}

function findTopLevelAddSub(expr) {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth > 0) depth--;
    } else if (
      depth === 0 &&
      (ch === "+" || ch === "-") &&
      !isUnaryAt(expr, i)
    ) {
      return i;
    }
  }
  return -1;
}

function findTopLevelMulDiv(expr) {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth > 0) depth--;
    } else if (depth === 0 && (ch === "*" || ch === "/")) {
      return { index: i, op: ch };
    }
  }
  return null;
}

function tokenizeFactor(expr, offset) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const parenIdx = expr.indexOf("(", i);
    if (parenIdx === -1) {
      if (i < expr.length) {
        tokens.push({
          type: "text",
          start: offset + i,
          end: offset + expr.length,
          value: expr.slice(i),
        });
      }
      break;
    }
    if (parenIdx > i) {
      tokens.push({
        type: "text",
        start: offset + i,
        end: offset + parenIdx,
        value: expr.slice(i, parenIdx),
      });
    }
    const end = matchParenForward(expr, parenIdx);
    if (end === -1) {
      tokens.push({
        type: "text",
        start: offset + parenIdx,
        end: offset + parenIdx + 1,
        value: "(",
      });
      tokens.push(
        ...tokenizeExpression(expr.slice(parenIdx + 1), offset + parenIdx + 1),
      );
      break;
    }
    tokens.push({
      type: "text",
      start: offset + parenIdx,
      end: offset + parenIdx + 1,
      value: "(",
    });
    tokens.push(
      ...tokenizeExpression(
        expr.slice(parenIdx + 1, end - 1),
        offset + parenIdx + 1,
      ),
    );
    tokens.push({
      type: "text",
      start: offset + end - 1,
      end: offset + end,
      value: ")",
    });
    i = end;
  }
  return tokens;
}

function mergeAdjacentText(tokens) {
  const out = [];
  for (const tok of tokens) {
    const prev = out[out.length - 1];
    if (
      tok.type === "text" &&
      prev &&
      prev.type === "text" &&
      prev.end === tok.start
    ) {
      out[out.length - 1] = {
        type: "text",
        start: prev.start,
        end: tok.end,
        value: prev.value + tok.value,
      };
    } else {
      out.push(tok);
    }
  }
  return out;
}

function tokenizeExpression(expr, offset = 0) {
  if (!expr) return [];

  const addSubIdx = findTopLevelAddSub(expr);
  if (addSubIdx !== -1) {
    return mergeAdjacentText([
      ...tokenizeExpression(expr.slice(0, addSubIdx), offset),
      {
        type: "text",
        start: offset + addSubIdx,
        end: offset + addSubIdx + 1,
        value: expr[addSubIdx],
      },
      ...tokenizeExpression(expr.slice(addSubIdx + 1), offset + addSubIdx + 1),
    ]);
  }

  const mulDiv = findTopLevelMulDiv(expr);
  if (mulDiv && mulDiv.op === "/") {
    let numStart = findOperandStart(expr, mulDiv.index);
    if (numStart === -1) numStart = mulDiv.index;
    const denEnd = findDenominatorEnd(expr, mulDiv.index + 1);
    const numerator = tokenizeExpression(
      expr.slice(numStart, mulDiv.index),
      offset + numStart,
    );
    const denominator = tokenizeExpression(
      expr.slice(mulDiv.index + 1, denEnd),
      offset + mulDiv.index + 1,
    );
    return mergeAdjacentText([
      ...tokenizeExpression(expr.slice(0, numStart), offset),
      {
        type: "fraction",
        start: offset + numStart,
        end: offset + denEnd,
        numStart: offset + numStart,
        numEnd: offset + mulDiv.index,
        denStart: offset + mulDiv.index + 1,
        denEnd: offset + denEnd,
        numerator,
        denominator,
      },
      ...tokenizeExpression(expr.slice(denEnd), offset + denEnd),
    ]);
  } else if (mulDiv && mulDiv.op === "*") {
    return mergeAdjacentText([
      ...tokenizeExpression(expr.slice(0, mulDiv.index), offset),
      {
        type: "text",
        start: offset + mulDiv.index,
        end: offset + mulDiv.index + 1,
        value: "*",
      },
      ...tokenizeExpression(
        expr.slice(mulDiv.index + 1),
        offset + mulDiv.index + 1,
      ),
    ]);
  }

  return mergeAdjacentText(tokenizeFactor(expr, offset));
}

// Find the token the caret belongs to. Primary: strict half-open containment
// (`start <= cursor < end`). Fallback: an empty-denominator fraction whose
// blank denominator slot sits at exactly `cursor` — this is what lets DOWN
// drop the caret into a blank denominator instead of escaping past the
// fraction to a trailing position.
function findCaretIndex(items, cursor) {
  if (items.length === 0) return -1;
  const strict = items.findIndex((t) => cursor >= t.start && cursor < t.end);
  if (strict !== -1) return strict;
  for (let i = items.length - 1; i >= 0; i--) {
    const t = items[i];
    if (
      t.type === "fraction" &&
      t.denStart === t.denEnd &&
      cursor === t.denStart
    ) {
      return i;
    }
  }
  return -1;
}

function RenderItems({ items, cursor, caretClass = "caret" }) {
  const hasCursor = cursor !== null && cursor !== undefined;
  const caretIndex = hasCursor ? findCaretIndex(items, cursor) : -1;
  const renderTrailingCaret =
    hasCursor && caretIndex === -1 && items.length > 0;

  return (
    <>
      {items.length === 0 && hasCursor && <span className={caretClass} />}

      {items.map((tok, i) => {
        const showCaret = i === caretIndex;
        if (tok.type === "text") {
          if (!showCaret) return <NaturalDisplay key={i} value={tok.value} />;
          const local = cursor - tok.start;
          return (
            <React.Fragment key={i}>
              <NaturalDisplay value={tok.value.slice(0, local)} />
              <span className={caretClass} />
              <NaturalDisplay value={tok.value.slice(local)} />
            </React.Fragment>
          );
        }
        const numCursor = showCaret && cursor <= tok.numEnd ? cursor : null;
        const denCursor = showCaret && cursor > tok.numEnd ? cursor : null;
        return (
          <span className="fraction-editor" key={i}>
            <span className="fraction-part">
              <RenderItems
                items={tok.numerator}
                cursor={numCursor}
                caretClass="fraction-caret"
              />
            </span>
            <span className="fraction-rule" />
            <span className="fraction-part">
              <RenderItems
                items={tok.denominator}
                cursor={denCursor}
                caretClass="fraction-caret"
              />
            </span>
          </span>
        );
      })}

      {renderTrailingCaret && <span className={caretClass} />}
    </>
  );
}

function ExpressionDisplay({ expr, cursor }) {
  const tokens = tokenizeExpression(expr);
  return <RenderItems items={tokens} cursor={cursor} caretClass="caret" />;
}

function findDeepestFraction(items, cursor, containsFn) {
  for (const tok of items) {
    if (tok.type !== "fraction") continue;
    if (containsFn(tok)) {
      const deeper =
        findDeepestFraction(tok.numerator, cursor, containsFn) ||
        findDeepestFraction(tok.denominator, cursor, containsFn);
      return deeper || tok;
    }
  }
  return null;
}

function endsWithCompletedFraction(expr) {
  if (!expr) return false;
  const tokens = tokenizeExpression(expr);
  const last = tokens[tokens.length - 1];
  if (!last || last.type !== "fraction") return false;
  return last.end === expr.length && last.denEnd > last.denStart;
}

export default function Calculator({
  mode,
  setMode,
  angleUnit,
  setAngleUnit,
  onResult,
}) {
  const [expr, setExpr] = useState("");
  const [cursor, setCursor] = useState(0);
  const [display, setDisplay] = useState("0");
  const [Ans, setAns] = useState(0);
  const [M, setM] = useState(0);
  const [shiftActive, setShiftActive] = useState(false);
  const [alphaActive, setAlphaActive] = useState(false);
  const [hypActive, setHypActive] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [fractionView, setFractionView] = useState(false);
  const [localHistory, setLocalHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [error, setError] = useState(false);

  const complexMode = mode === "CMPLX";
  const basicDisplayMode = mode === "COMP" || mode === "CMPLX";

  function insert(text) {
    let implicit = "";
    // If the user types a letter (start of a function name like sqrt, sin, ln)
    // right after a completed fraction at the end of the expression, insert
    // an implicit "*" so the function becomes a SEPARATE operand instead of
    // extending the denominator:
    //   "77/88" + "sqrt("  →  "77/88*sqrt("   → displays 77/88 × √(
    //   "77/88" + "8"      →  "77/888"        → digits still extend denom
    if (cursor === expr.length && expr.length > 0 && /^[A-Za-z]/.test(text)) {
      const tokens = tokenizeExpression(expr);
      const last = tokens[tokens.length - 1];
      if (
        last &&
        last.type === "fraction" &&
        last.end === expr.length &&
        last.denEnd > last.denStart
      ) {
        implicit = "*";
      }
    }
    const newExpr =
      expr.slice(0, cursor) + implicit + text + expr.slice(cursor);
    setExpr(newExpr);
    setCursor(cursor + implicit.length + text.length);
  }

  function backspace() {
    if (cursor === 0) return;
    setExpr(expr.slice(0, cursor - 1) + expr.slice(cursor));
    setCursor(cursor - 1);
  }

  function clearAll() {
    setExpr("");
    setCursor(0);
    setDisplay("0");
    setError(false);
  }

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
    setHistIdx(-1);
    onResult && onResult(entry);
  }

  function classifyError(expr, error) {
    const msg = String(error?.message || error || "");
    const src = String(expr || "");

    // --- 1) Syntax errors ------------------------------------------------
    // Either the engine complained about structure, OR the raw expression
    // is obviously incomplete (unbalanced parens, dangling operator, ...).
    const engineSaysSyntax =
      /(Unexpected end|Unexpected operator|Unexpected part|Unexpected type|Parenthesis|Value expected|Character .* is not allowed|Syntax|Unexpected token|Value expected)/i.test(
        msg,
      );

    const parensUnbalanced = (() => {
      let depth = 0;
      for (const ch of src) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        if (depth < 0) return true; // stray ")"
      }
      return depth !== 0; // unclosed "("
    })();

    const endsWithOperator = /[+\-*/^(,]$/.test(src.trim());
    const endsWithFunctionName =
      /\b(?:sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|asinh|acosh|atanh|sqrt|cbrt|log10|ln|exp|abs|dms|pol|rec|round|sum|integral|randomInt|Ran)$/i.test(
        src.trim(),
      );

    if (
      engineSaysSyntax ||
      parensUnbalanced ||
      endsWithOperator ||
      endsWithFunctionName
    ) {
      return "Syntax ERROR";
    }

    // --- 2) Variable errors ---------------------------------------------
    const hasLetter = /[A-Za-z]/.test(src);
    const isVariableIssue =
      /(Undefined symbol|Unknown symbol|is not defined|not defined|Variable)/i.test(
        msg,
      ) || /\b(?:A|B|C|D|E|F|X|Y|Z|a|b|c|d|e|f|x|y|z)\b/.test(src);
    if (hasLetter && isVariableIssue) return "Variable Error";

    // --- 3) Everything else ---------------------------------------------
    // Divide by zero, domain errors (sqrt(-1), log(0), ...), overflow, etc.
    return "Math ERROR";
  }

  function doEvaluate() {
    let clean;
    try {
      clean = preprocess(expr || "0");
      const result = calcEvaluate(clean, {
        mode: angleUnit,
        complexMode,
        Ans,
        M,
      });
      let shown =
        typeof result === "object" && result.toString
          ? result.toString()
          : result;
      shown = exactDisplayExpression(clean, shown);
      setDisplay(String(shown));
      setAns(typeof result === "number" ? result : Ans);
      setError(false);
      pushHistory(expr, shown);
    } catch (e) {
      setDisplay(classifyError(clean ?? expr, e));
      setError(true);
    }
  }

  function doSolve() {
    let target;
    try {
      target = expr;
      if (target.includes("=")) {
        const [l, r] = target.split("=");
        target = `(${l})-(${r})`;
      }
      const root = solveNewton(preprocess(target), Ans || 1, {
        mode: angleUnit,
      });
      setDisplay(`X = ${Math.round(root * 1e9) / 1e9}`);
      setAns(root);
      pushHistory(`SOLVE: ${expr}`, root);
      setError(false);
    } catch (e) {
      setDisplay(classifyError(target ?? expr, e));
      setError(true);
    }
  }

  function toggleFractionView(showFraction = !fractionView) {
    const value = String(display).trim();
    const mixedMatch = value.match(/^(-?)(\d+)\s+(\d+)\/(\d+)$/);
    const fractionMatch = value.match(/^(-?)(\d+)\/(\d+)$/);
    let num;

    if (mixedMatch) {
      const sign = mixedMatch[1] === "-" ? -1 : 1;
      num =
        sign *
        (Number(mixedMatch[2]) + Number(mixedMatch[3]) / Number(mixedMatch[4]));
    } else if (fractionMatch) {
      num =
        Number(fractionMatch[1] + fractionMatch[2]) / Number(fractionMatch[3]);
    } else {
      try {
        const evaluated = calcEvaluate(value, {
          mode: angleUnit,
          complexMode,
          Ans,
          M,
        });
        num = typeof evaluated === "number" ? evaluated : Number(value);
      } catch {
        num = Number(value);
      }
    }

    if (!Number.isFinite(num)) return;
    if (showFraction) {
      setDisplay(fractionToString(decimalToFraction(num)));
    } else {
      setDisplay(String(num));
    }
    setFractionView(showFraction);
  }

  function insertFraction() {
    // Insert just "/" — no auto "()" around the denominator. The parser already
    // knows how to build a stacked fraction from "1/b" on its own; parens are
    // only added when you type them yourself.
    if (expr) {
      const nextExpr = `${expr.slice(0, cursor)}/${expr.slice(cursor)}`;
      setExpr(nextExpr);
      setCursor(cursor + 1);
      return;
    }
    const startingValue =
      display !== "Math ERROR" && display !== "0" ? display : "";
    const nextExpr = `${startingValue}/`;
    setExpr(nextExpr);
    setCursor(startingValue.length + 1);
    setError(false);
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
    if (btn.id === "HYP") {
      if (shiftActive && btn.shiftAction) {
        btn.shiftAction();
        setShiftActive(false);
        return;
      }
      setHypActive((v) => !v);
      return;
    }

    if (alphaActive && btn.alpha) {
      insert(btn.alpha);
      setAlphaActive(false);
      return;
    }

    if (shiftActive && btn.shiftAction) {
      btn.shiftAction();
      setShiftActive(false);
      return;
    }

    if (btn.id === "LEFT") {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (btn.id === "RIGHT") {
      setCursor((c) => Math.min(expr.length, c + 1));
      return;
    }
    if (btn.id === "UP") {
      const current = findDeepestFraction(
        tokenizeExpression(expr),
        cursor,
        (t) => cursor > t.numStart && cursor <= t.denEnd,
      );
      setCursor(current ? current.numStart : 0);
      return;
    }
    if (btn.id === "DOWN") {
      const current = findDeepestFraction(
        tokenizeExpression(expr),
        cursor,
        (t) => cursor >= t.numStart && cursor < t.denEnd,
      );
      setCursor(current ? current.denStart : expr.length);
      return;
    }
    if (btn.id === "MENU") {
      if (shiftActive) {
        setAngleUnit((u) =>
          u === "DEG" ? "RAD" : u === "RAD" ? "GRAD" : "DEG",
        );
        setShiftActive(false);
      } else {
        setShowMenu((v) => !v);
      }
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
      backspace();
      return;
    }
    if (btn.id === "CALC" || btn.id === "EQ") {
      shiftActive && btn.id === "CALC"
        ? (doSolve(), setShiftActive(false))
        : doEvaluate();
      return;
    }
    if (btn.id === "FRAC") {
      insertFraction();
      return;
    }
    if (btn.id === "SD") {
      toggleFractionView(shiftActive);
      setShiftActive(false);
      return;
    }

    if (btn.id === "STO") {
      try {
        const v = calcEvaluate(preprocess(expr || String(Ans)), {
          mode: angleUnit,
          complexMode,
          Ans,
          M,
        });
        setM(v);
        setDisplay(`M = ${v}`);
        clearAll();
      } catch {
        setDisplay("Math ERROR");
      }
      return;
    }
    if (btn.id === "MPLUS") {
      try {
        const v = calcEvaluate(preprocess(expr || String(Ans)), {
          mode: angleUnit,
          complexMode,
          Ans,
          M,
        });
        setM((m) => m + v);
        setDisplay(`M = ${M + v}`);
        clearAll();
      } catch {
        setDisplay("Math ERROR");
      }
      return;
    }
    if (btn.id === "MMINUS") {
      try {
        const v = calcEvaluate(preprocess(expr || String(Ans)), {
          mode: angleUnit,
          complexMode,
          Ans,
          M,
        });
        setM((m) => m - v);
        setDisplay(`M = ${M - v}`);
        clearAll();
      } catch {
        setDisplay("Math ERROR");
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
    function handleKeyboard(event) {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          "input, select, textarea, [contenteditable='true']",
        )
      ) {
        return;
      }
      const keyMap = {
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        Backspace: "DEL",
        Delete: "DEL",
      };
      const buttonId = keyMap[event.key];
      if (buttonId) {
        event.preventDefault();
        press({ id: buttonId });
        return;
      }
      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        press({ id: "EQ" });
        return;
      }
      if (/^[0-9.+\-*/()]$/.test(event.key)) {
        event.preventDefault();
        insert(event.key);
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  });

  function renderModePanel() {
    if (mode === "STAT") return <StatPanel />;
    if (mode === "EQN") return <EqnPanel />;
    if (mode === "MATRIX") return <MatrixPanel />;
    if (mode === "VECTOR") return <VectorPanel />;
    if (mode === "BASE-N") return <BaseNPanel />;
    if (mode === "TABLE") {
      return <TablePanel mode={mode} angleUnit={angleUnit} />;
    }
    return null;
  }

  const rows = [
    [
      {
        id: "CALC",
        main: "CALC",
        shift: "SOLVE",
        alpha: "=",
        alphaLabel: "= ",
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
        shiftLabel: "□/□",
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
        shiftAction: () => {
          try {
            const value = calcEvaluate(preprocess(expr || String(Ans)), {
              mode: angleUnit,
              complexMode,
              Ans,
              M,
            });
            setM(value);
            setDisplay(`M = ${value}`);
            clearAll();
          } catch {
            setDisplay("Math ERROR");
            setError(true);
          }
        },
        cls: "k-fn",
        label: "RCL",
      },
      {
        id: "ENG",
        main: "eng",
        shift: "i",
        topLabel: "←",
        shiftAction: () =>
          complexMode ? insert("i") : setCursor((c) => Math.max(0, c - 1)),
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
        shiftAction: () => {
          try {
            const value = calcEvaluate(preprocess(expr || String(Ans)), {
              mode: angleUnit,
              complexMode,
              Ans,
              M,
            });
            setM((memory) => memory - value);
            setDisplay(`M = ${M - value}`);
            clearAll();
          } catch {
            setDisplay("Math ERROR");
            setError(true);
          }
        },
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
        shiftAction: () => setCursor(expr.length),
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
      {
        id: "EQ",
        main: "",
        cls: "k-eq",
        label: "=",
        alpha: "=",
      },
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
              <ExpressionDisplay expr={expr} cursor={cursor} />
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
        <div className="replay-pad" aria-label="Replay navigation">
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
          .map((row, rowIndex) => (
            <div
              className={`keypad-row keypad-row-${row.length}`}
              key={`row-${rowIndex}`}
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
