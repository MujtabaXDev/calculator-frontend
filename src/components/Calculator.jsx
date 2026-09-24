import React, { useEffect, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  calcEvaluate,
  decimalToFraction,
  fractionToString,
  solveNewton,
} from "../engine/engine";
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
  // Turn Casio-style infix "5 nCr 2" / "5 nPr 2" into function-call form nCr(5,2)/nPr(5,2)
  const opPattern = /([\w.]+|\([^()]*\))\s*(nCr|nPr)\s*([\w.]+|\([^()]*\))/g;
  let prev;
  let out = expr;
  let guard = 0;
  do {
    prev = out;
    out = out.replace(opPattern, (m, a, op, b) => `${op}(${a},${b})`);
    guard++;
  } while (out !== prev && guard < 10);
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
    .replace(/\^\(-1\)/g, "⁻¹")
    .replace(/\^3/g, "³")
    .replace(/\^2/g, "²");
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

function FractionExpression({ value, cursor }) {
  const slashIndex = value.indexOf("/");
  if (slashIndex < 0) return null;
  const numerator = value.slice(0, slashIndex) || "";
  const denominator = value.slice(slashIndex + 1) || "";
  const cursorInNumerator = cursor <= slashIndex;
  const numeratorCursor = cursorInNumerator ? cursor : numerator.length;
  const denominatorCursor = cursorInNumerator
    ? -1
    : Math.max(0, cursor - slashIndex - 1);

  return (
    <span className="fraction-editor">
      <span className="fraction-part">
        {displayExpression(numerator.slice(0, numeratorCursor))}
        {cursorInNumerator && <span className="fraction-caret" />}
        {displayExpression(numerator.slice(numeratorCursor))}
      </span>
      <span className="fraction-rule" />
      <span className="fraction-part">
        {displayExpression(
          denominator.slice(0, denominatorCursor < 0 ? 0 : denominatorCursor),
        )}
        {denominatorCursor >= 0 && <span className="fraction-caret" />}
        {displayExpression(
          denominator.slice(denominatorCursor < 0 ? 0 : denominatorCursor),
        )}
      </span>
    </span>
  );
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

  function insert(text) {
    const newExpr = expr.slice(0, cursor) + text + expr.slice(cursor);
    setExpr(newExpr);
    setCursor(cursor + text.length);
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

  function doEvaluate() {
    try {
      const clean = preprocess(expr || "0");
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
      setDisplay("Math ERROR");
      setError(true);
    }
  }

  function doSolve() {
    try {
      let target = expr;
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
      setDisplay("Can't Solve");
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
    if (expr) {
      const nextExpr = `${expr.slice(0, cursor)}/()${expr.slice(cursor)}`;
      setExpr(nextExpr);
      setCursor(cursor + 2);
      return;
    }
    const startingValue =
      display !== "Math ERROR" && display !== "0" ? display : "";
    const nextExpr = `${startingValue}/()`;
    setExpr(nextExpr);
    setCursor(startingValue.length + 2);
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
      const fractionSlash = expr.indexOf("/");
      setCursor(fractionSlash >= 0 ? fractionSlash : 0);
      return;
    }
    if (btn.id === "DOWN") {
      const fractionSlash = expr.indexOf("/");
      setCursor(fractionSlash >= 0 ? fractionSlash + 1 : expr.length);
      return;
    }
    if (btn.id === "MENU") {
      if (shiftActive) {
        // SHIFT+MENU = SETUP -> cycle angle unit
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

  const rows = [
    [
      {
        id: "CALC",
        main: "CALC",
        shift: "SOLVE",
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
        shiftAction: () => setCursor((c) => Math.max(0, c - 1)),
        cls: "k-fn",
        label: "ENG",
      },
      {
        id: "LP",
        main: "( ",
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
        cls: "k-fn",
      },
      { id: "SD", main: "", topLabel: "a b/c", cls: "k-fn", label: "S⇔D" },
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
      { id: "EQ", main: "", cls: "k-eq", label: "=" },
    ],
  ];

  return (
    <div className="calc-body">
      <div className="calculator-brand">
        <div className="brand-name">fx-991ES PLUS</div>
      </div>
      <div className="calc-display">
        <div className="status-row">
          <span className={shiftActive ? "active" : ""}>S</span>
          <span className={alphaActive ? "active" : ""}>A</span>
          <span className={hypActive ? "active" : ""}>HYP</span>
          <span>{mode}</span>
          <span>{angleUnit}</span>
          {M !== 0 && <span className="active">M</span>}
        </div>
        <div className="expr-line">
          {expr.includes("/") ? (
            <FractionExpression value={expr} cursor={cursor} />
          ) : (
            <>
              <NaturalDisplay value={expr.slice(0, cursor)} />
              <span className="caret" />
              <NaturalDisplay value={expr.slice(cursor)} />
            </>
          )}
        </div>
        <div
          className={`result-line ${error ? "err" : ""} ${String(display).length > 12 ? "compact-result" : ""}`}
        >
          <NaturalDisplay value={display} isResult />
        </div>
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
        {rows.map((row, rowIndex) => (
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
