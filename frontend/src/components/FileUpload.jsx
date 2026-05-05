import { useState } from 'react';
import { uploadFiles } from '../services/api.js';

export default function FileUpload({ onUploaded, onError }) {
  const [files, setFiles] = useState({ bank: null, gateway: null, ledger: null });
  const [busy, setBusy] = useState(false);

  const pick = (source) => (e) => {
    setFiles((prev) => ({ ...prev, [source]: e.target.files?.[0] || null }));
  };

  const submit = async () => {
    if (!files.bank && !files.gateway && !files.ledger) {
      onError?.('Pick at least one CSV file.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await uploadFiles(files);
      onUploaded?.(data.summary);
      setFiles({ bank: null, gateway: null, ledger: null });
      // Clear file input UI by re-keying could be cleaner; quick reset works for now.
      document.querySelectorAll('input[type=file]').forEach((el) => (el.value = ''));
    } catch (err) {
      onError?.(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>1 · Upload CSVs</h2>
      <div className="row">
        {['bank', 'gateway', 'ledger'].map((src) => (
          <div className="file-input" key={src}>
            <label>{src}.csv</label>
            <input type="file" accept=".csv" onChange={pick(src)} />
            {files[src] && <span className="file-name">{files[src].name}</span>}
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={submit} disabled={busy}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  );
}
