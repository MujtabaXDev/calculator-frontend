import React, { useEffect, useState } from 'react';
import { fetchHistory, deleteHistoryEntry, clearHistory } from '../api';

export default function History({ refreshKey }) {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await fetchHistory();
      setEntries(data);
      setError('');
    } catch (e) {
      setError('Backend not reachable — is the server running with MongoDB?');
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  return (
    <div className="history-panel">
      <div className="history-header">
        <h3>History</h3>
        <button onClick={async () => { await clearHistory(); load(); }}>Clear</button>
      </div>
      {error && <div className="error small">{error}</div>}
      <ul>
        {entries.map((e) => (
          <li key={e._id}>
            <div className="hist-expr">{e.expression}</div>
            <div className="hist-result">= {e.result}</div>
            <button className="hist-del" onClick={async () => { await deleteHistoryEntry(e._id); load(); }}>×</button>
          </li>
        ))}
        {entries.length === 0 && !error && <li className="empty">No history yet</li>}
      </ul>
    </div>
  );
}
