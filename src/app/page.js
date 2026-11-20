'use client';

import { useState, useRef, useCallback } from 'react';
import '@/app/globals.css';

const ISSUE_TYPES = [
  'CIVIL',
  'PLUMBING',
  'CARPENTER',
  'ELECTRICAL',
  'SEWERLINE',
  'HOUSEKEEPING',
  'PEST CONTROL',
  'HORTICULTURE'
];

function FileUploadField({ id, label, hint, accept, icon, onChange, file, captureLabel }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const captureRef = useRef(null);

  const handleFileInput = (e) => {
    if (e.target.files[0]) onChange(e.target.files[0]);
    // Reset so picking the same file / retaking a photo fires onChange again
    e.target.value = '';
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onChange(dropped);
  }, [onChange]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div
        className={`file-upload-area ${file ? 'has-file' : ''} ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        {/* Separate input with `capture` — Android's Photo Picker (opened for a plain
            accept="image/*" input) has no camera option, so we open the camera directly. */}
        <input
          ref={captureRef}
          id={`${id}-capture`}
          type="file"
          accept={accept}
          capture="environment"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        {file ? (
          <div className="file-preview">
            <span className="file-preview-icon">{icon}</span>
            <div className="file-preview-info">
              <div className="file-preview-name">{file.name}</div>
              <div className="file-preview-size">{formatSize(file.size)} — Click to change</div>
            </div>
          </div>
        ) : (
          <>
            <span className="upload-icon">{icon}</span>
            <span className="upload-label">Drag & drop or click to upload</span>
            <span className="upload-hint">{hint}</span>
          </>
        )}
        {captureLabel && (
          <div className="upload-actions">
            <button
              type="button"
              className="upload-action-btn"
              onClick={(e) => { e.stopPropagation(); captureRef.current?.click(); }}
            >
              📷 {captureLabel}
            </button>
            <button
              type="button"
              className="upload-action-btn"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            >
              📁 Gallery
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Toast({ toast, onRemove }) {
  return (
    <div className={`toast ${toast.type} ${toast.removing ? 'removing' : ''}`}>
      <span className="toast-icon">{toast.type === 'success' ? '✅' : '❌'}</span>
      <div className="toast-body">
        <div className="toast-title">{toast.type === 'success' ? 'Success!' : 'Error'}</div>
        <div className="toast-msg">{toast.message}</div>
      </div>
    </div>
  );
}

export default function ComplaintPage() {
  const [form, setForm] = useState({
    name: '',
    quarterNo: '',
    mobileNo: '',
    issueType: '',
    description: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNo, setRefNo] = useState('');
  const [toasts, setToasts] = useState([]);

  const addToast = (type, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message, removing: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, removing: true } : t));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
    }, 5000);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.quarterNo || !form.mobileNo || !form.issueType || !form.description) {
      addToast('error', 'Please fill in all required fields.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(form.mobileNo)) {
      addToast('error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append('name', form.name);
      data.append('quarterNo', form.quarterNo);
      data.append('mobileNo', form.mobileNo);
      data.append('issueType', form.issueType);
      data.append('description', form.description);
      if (photoFile) data.append('photo', photoFile);
      if (videoFile) data.append('video', videoFile);

      const res = await fetch('/api/submit', { method: 'POST', body: data });
      const json = await res.json();

      if (json.success) {
        const ref = `TCMP-${Date.now().toString().slice(-6)}`;
        setRefNo(ref);
        setSubmitted(true);
      } else {
        addToast('error', json.error || 'Submission failed. Please try again.');
      }
    } catch {
      addToast('error', 'Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', quarterNo: '', mobileNo: '', issueType: '', description: '' });
    setPhotoFile(null);
    setVideoFile(null);
    setSubmitted(false);
    setRefNo('');
  };

  return (
    <>
      <div className="bg-gradient" aria-hidden="true" />
      <div className="bg-orb bg-orb-1" aria-hidden="true" />
      <div className="bg-orb bg-orb-2" aria-hidden="true" />
      <div className="bg-orb bg-orb-3" aria-hidden="true" />

      {/* Toast container */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => <Toast key={t.id} toast={t} />)}
      </div>

      <main className="page-wrapper">
        {/* Header */}
        <header className="page-header">
          <div className="header-badge">
            <span className="dot" />
            Town Office Portal
          </div>
          <h1 className="page-title">SCP Township Help Desk</h1>
          <p className="page-subtitle">
            Submit your complaint and we'll make sure it reaches the right authority.
            You'll receive a confirmation and timely resolution.
          </p>
        </header>

        {/* Form Card */}
        <div className="form-card">
          {submitted ? (
            /* ─── Success Screen ─── */
            <div className="success-screen">
              <div className="success-icon-wrap">🎉</div>
              <h2 className="success-title">Complaint Submitted!</h2>
              <p className="success-desc">
                Your complaint has been recorded and the incharge officer has been notified.
              </p>
              <div className="success-ref">Reference: {refNo}</div>
              <br />
              <button className="new-complaint-btn" onClick={resetForm} id="new-complaint-btn">
                + Submit Another Complaint
              </button>
            </div>
          ) : (
            /* ─── Complaint Form ─── */
            <form onSubmit={handleSubmit} noValidate>
              {/* Section 1: Personal Details */}
              <div className="form-section">
                <div className="section-title">Personal Details</div>
                <div className="field-row">
                  <div className="field-group">
                    <label className="field-label" htmlFor="name">
                      Full Name <span className="required">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      className="field-input"
                      placeholder="e.g. Ramesh Kumar"
                      value={form.name}
                      onChange={handleChange}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="quarterNo">
                      Quarter No. <span className="required">*</span>
                    </label>
                    <input
                      id="quarterNo"
                      name="quarterNo"
                      type="text"
                      className="field-input"
                      placeholder="e.g. A-104"
                      value={form.quarterNo}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="field-row">
                  <div className="field-group">
                    <label className="field-label" htmlFor="mobileNo">
                      Mobile No. <span className="required">*</span>
                    </label>
                    <input
                      id="mobileNo"
                      name="mobileNo"
                      type="tel"
                      className="field-input"
                      placeholder="10-digit mobile number"
                      value={form.mobileNo}
                      onChange={handleChange}
                      required
                      maxLength={10}
                      pattern="[6-9][0-9]{9}"
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="issueType">
                      Issue Type <span className="required">*</span>
                    </label>
                    <div className="select-wrapper">
                      <select
                        id="issueType"
                        name="issueType"
                        className="field-select"
                        value={form.issueType}
                        onChange={handleChange}
                        required
                      >
                        <option value="" disabled>Select an issue...</option>
                        {ISSUE_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <span className="chevron">▾</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Complaint Details */}
              <div className="form-divider" />
              <div className="form-section">
                <div className="section-title">Complaint Details</div>
                <div className="field-group">
                  <label className="field-label" htmlFor="description">
                    Describe Your Complaint <span className="required">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    className="field-textarea"
                    placeholder="Please describe your issue in detail — location, duration, severity, etc."
                    value={form.description}
                    onChange={handleChange}
                    required
                    rows={5}
                  />
                </div>
              </div>

              {/* Section 3: Attachments */}
              <div className="form-divider" />
              <div className="form-section">
                <div className="section-title">Attachments (Optional)</div>
                <div className="field-row">
                  <FileUploadField
                    id="photo-upload"
                    label="Upload Photo"
                    hint="JPG, PNG or WEBP — max 10 MB"
                    accept="image/*"
                    icon="🖼️"
                    captureLabel="Take Photo"
                    file={photoFile}
                    onChange={setPhotoFile}
                  />
                  <FileUploadField
                    id="video-upload"
                    label="Upload Video"
                    hint="MP4, MOV or WEBM — max 50 MB"
                    accept="video/*"
                    icon="🎬"
                    captureLabel="Record Video"
                    file={videoFile}
                    onChange={setVideoFile}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                id="submit-complaint-btn"
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                <span className="btn-content">
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Submitting your complaint…
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      Submit Complaint
                    </>
                  )}
                </span>
              </button>
            </form>
          )}
        </div>

        <footer className="page-footer">
          © {new Date().getFullYear()} Town Office Portal — All complaints are addressed with priority
        </footer>
      </main>
    </>
  );
}
