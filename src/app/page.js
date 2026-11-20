'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

// Vercel rejects request bodies over 4.5 MB, and phone camera photos are often
// larger. Downscale images in the browser so they always fit.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

async function compressImage(file, maxDim = 1600, quality = 0.8) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    URL.revokeObjectURL(url);

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file; // Format the browser can't decode — send as-is
  }
}

// Android Chrome silently ignores `capture` and opens the gallery when Chrome lacks the
// Android camera permission (and some phones' browsers ignore it entirely). So on
// non-iOS devices we open our own in-page camera via getUserMedia, which shows a real
// permission prompt and lets us explain what to do if the camera is blocked.
// iOS Safari handles `capture` reliably, so it keeps the native camera.
function shouldUseInPageCamera() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return !isIOS && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

const MAX_VIDEO_SECONDS = 25; // ~1 Mbps → about 3.3 MB, under the upload limit

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function CameraModal({ mode, onCapture, onClose, onFallback }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | ready | recording | blocked | error
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: mode === 'video',
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus(err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'blocked' : 'error');
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const startRecording = () => {
    const mimeType = pickRecorderMime();
    if (!mimeType) { setStatus('error'); return; }
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: 1_000_000,
      audioBitsPerSecond: 64_000,
    });
    recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const type = mimeType.split(';')[0];
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size) onCapture(new File([blob], `video-${Date.now()}.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type }));
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setSeconds(0);
    setStatus('recording');
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_VIDEO_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
  };

  return createPortal(
    <div className="camera-modal" role="dialog" aria-modal="true" aria-label={mode === 'video' ? 'Record video' : 'Take photo'}>
      <video ref={videoRef} className="camera-video" playsInline muted autoPlay />

      {(status === 'blocked' || status === 'error') && (
        <div className="camera-message">
          {status === 'blocked' ? (
            <>
              <p className="camera-message-title">Camera access is blocked</p>
              <p>To allow it in Chrome: tap the icon to the left of the web address → <b>Permissions</b> → turn on <b>Camera</b>{mode === 'video' ? ' and Microphone' : ''}, then try again.</p>
              <p>If it is still blocked: open phone <b>Settings → Apps → Chrome → Permissions → Camera → Allow</b>.</p>
            </>
          ) : (
            <>
              <p className="camera-message-title">Couldn&apos;t start the camera here</p>
              <p>You can use your phone&apos;s camera app instead.</p>
            </>
          )}
          <button type="button" className="upload-action-btn" onClick={onFallback}>
            📷 Use phone camera app
          </button>
        </div>
      )}

      {status === 'recording' && (
        <div className="camera-timer">● {seconds}s / {MAX_VIDEO_SECONDS}s</div>
      )}

      <div className="camera-controls">
        <button type="button" className="camera-cancel" onClick={onClose}>Cancel</button>
        {mode === 'photo' && (
          <button type="button" className="camera-shutter" aria-label="Take photo"
            disabled={status !== 'ready'} onClick={takePhoto} />
        )}
        {mode === 'video' && (
          <button type="button"
            className={`camera-shutter video ${status === 'recording' ? 'recording' : ''}`}
            aria-label={status === 'recording' ? 'Stop recording' : 'Start recording'}
            disabled={status !== 'ready' && status !== 'recording'}
            onClick={status === 'recording' ? stopRecording : startRecording} />
        )}
        <span className="camera-spacer" />
      </div>
    </div>,
    document.body
  );
}

function FileUploadField({ id, label, hint, accept, icon, onChange, file, captureLabel }) {
  const [dragOver, setDragOver] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef(null);
  const captureRef = useRef(null);
  const cameraMode = accept.startsWith('video') ? 'video' : 'photo';

  const openCamera = () => {
    if (shouldUseInPageCamera()) setCameraOpen(true);
    else captureRef.current?.click();
  };

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
        onClick={(e) => {
          // Clicks on the buttons or hidden inputs bubble up here. Without this check,
          // "Take Photo" also opened the gallery input, and Android showed the gallery.
          if (e.target.closest('button, input')) return;
          inputRef.current?.click();
        }}
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
              onClick={(e) => { e.stopPropagation(); openCamera(); }}
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
      {cameraOpen && (
        <CameraModal
          mode={cameraMode}
          onCapture={(f) => { setCameraOpen(false); onChange(f); }}
          onClose={() => setCameraOpen(false)}
          onFallback={() => { setCameraOpen(false); captureRef.current?.click(); }}
        />
      )}
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

    const totalSize = (photoFile?.size || 0) + (videoFile?.size || 0);
    if (totalSize > MAX_UPLOAD_BYTES) {
      addToast('error', 'Attachments are too large (max 4 MB in total). Please record a shorter video or choose a smaller file.');
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
      if (res.status === 413) {
        addToast('error', 'Attachments are too large to upload. Please choose a smaller file.');
        return;
      }
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
                    hint="JPG, PNG or WEBP — large photos are resized automatically"
                    accept="image/*"
                    icon="🖼️"
                    captureLabel="Take Photo"
                    file={photoFile}
                    onChange={async (f) => setPhotoFile(await compressImage(f))}
                  />
                  <FileUploadField
                    id="video-upload"
                    label="Upload Video"
                    hint="MP4, MOV or WEBM — max 4 MB (a few seconds)"
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
