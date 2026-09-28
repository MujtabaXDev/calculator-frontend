import React, { useState } from "react";
import Calculator from "./components/Calculator";

import { saveHistory } from "./api";
import "./components/Calculator.css";

export default function App() {
  const [mode, setMode] = useState("COMP");
  const [angleUnit, setAngleUnit] = useState("DEG");
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleResult(entry) {
    try {
      await saveHistory(entry);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      // backend/DB may not be running yet — calculator still works standalone
    }
  }

  return (
    <div className="calc-shell">
      <Calculator
        mode={mode}
        setMode={setMode}
        angleUnit={angleUnit}
        setAngleUnit={setAngleUnit}
        onResult={handleResult}
      />
    </div>
  );
}
