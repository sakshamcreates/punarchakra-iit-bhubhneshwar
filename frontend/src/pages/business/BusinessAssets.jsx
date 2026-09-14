import { useState } from "react";
import BusinessShell from "../../components/business/BusinessShell";
import { uploadAssetBatch, getAssetClassification } from "../../services/businessService";

export default function BusinessAssets() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [classifications, setClassifications] = useState(null);

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    setFile(f);
  }

  function startUpload() {
    if (!file) return;
    setStatus({ uploading: true });
    uploadAssetBatch(file).then((res) => {
      setStatus({ uploading: false, success: true, uploaded: res.uploaded });
      getAssetClassification().then(setClassifications);
    }).catch(() => setStatus({ uploading: false, error: true }));
  }

  return (
    <BusinessShell>
      <div className="business-page">
        <h2>Asset Upload</h2>
        <div className="upload-actions">
          <label className="upload-box">
            <input type="file" accept=".csv" onChange={onFile} />
            <strong>Upload CSV</strong>
            <div className="muted">Select a CSV file</div>
          </label>

          <label className="upload-box">
            <input type="file" accept=".xlsx,.xls" onChange={onFile} />
            <strong>Upload Excel</strong>
            <div className="muted">Select an Excel file</div>
          </label>

          <label className="upload-box">
            <input type="file" accept="image/*" onChange={onFile} />
            <strong>Upload Images</strong>
            <div className="muted">Select image files</div>
          </label>

          <button className="btn btn-secondary" onClick={() => alert('ERP connector demo')}>Connect ERP</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div>Selected: {file ? file.name : 'No file selected'}</div>
          <button className="btn btn-primary" onClick={startUpload} disabled={!file || (status && status.uploading)}>
            {status && status.uploading ? 'Uploading…' : 'Start Upload'}
          </button>
        </div>

        {status && status.success && (
          <div className="card" style={{ marginTop: 12 }}>
            <div>Assets Uploaded: {status.uploaded}</div>
            <div className="classification-list">
              {classifications ? classifications.map(c => (
                <div key={c.id} className="classification-row">
                  <div>{c.category}</div>
                  <div>{c.count}</div>
                  <div className="muted">{c.percentage}%</div>
                </div>
              )) : <div>Analyzing…</div>}
            </div>
          </div>
        )}
      </div>
    </BusinessShell>
  );
}
