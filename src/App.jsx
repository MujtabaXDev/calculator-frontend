import React, { useState } from "react";
import Calculator from "./components/Calculator";
import History from "./components/History";
import {
  StatPanel,
  EqnPanel,
  MatrixPanel,
  VectorPanel,
  BaseNPanel,
  TablePanel,
} from "./components/ModePanels";
import { saveHistory } from "./api";
import "./components/Calculator.css";

export default function App() {
  const [mode, setMode] = useState("COMP");
  const [angleUnit, setAngleUnit] = useState("DEG");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showHistory, setShowHistory] = useState(true);

  async function handleResult(entry) {
    try {
      await saveHistory(entry);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      // backend/DB may not be running yet — calculator still works standalone
    }
  }

  return (
    <div className="app">
      <div className="app-header">
        <h1></h1>
        <div className="header-actions">
          <button onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Hide" : "Show"} History
          </button>
        </div>
      </div>
      <div className="app-main">
        <div className="calc-column">
          <div className="calc-shell">
            <Calculator
              mode={mode}
              setMode={setMode}
              angleUnit={angleUnit}
              setAngleUnit={setAngleUnit}
              onResult={handleResult}
            />
          </div>
          {mode === "STAT" && <StatPanel />}
          {mode === "EQN" && <EqnPanel />}
          {mode === "MATRIX" && <MatrixPanel />}
          {mode === "VECTOR" && <VectorPanel />}
          {mode === "BASE-N" && <BaseNPanel />}
          {mode === "TABLE" && <TablePanel mode={mode} angleUnit={angleUnit} />}
        </div>
        {showHistory && <History refreshKey={refreshKey} />}
      </div>
    </div>
  );
}
