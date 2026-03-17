import { useState, useEffect, useRef } from 'react';
import { uploadFiles as uploadFilesApi, enrichAsset as enrichAssetApi } from '../api/assets';

const NAVY = '#001B6B';
const GOLD = '#C8960C';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const STATUS = {
  PENDING: 'Pending',
  TOO_LARGE: 'Too large (max 20MB)',
  UNSUPPORTED: 'Unsupported type',
  UPLOADING: 'Uploading...',
  ENRICHING: 'Enriching...',
  DONE: 'Done ✓',
  ENRICH_UNAVAILABLE: 'Uploaded — enrichment unavailable',
  UPLOAD_FAILED: 'Upload failed',
};

const TERMINAL = new Set([STATUS.DONE, STATUS.ENRICH_UNAVAILABLE, STATUS.UPLOAD_FAILED]);

function getStatusStyle(status) {
  switch (status) {
    case STATUS.PENDING:
      return { backgroundColor: '#e5e7eb', color: '#6b7280' };
    case STATUS.TOO_LARGE:
    case STATUS.UNSUPPORTED:
    case STATUS.UPLOAD_FAILED:
      return { backgroundColor: '#fee2e2', color: '#dc2626' };
    case STATUS.UPLOADING:
      return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
    case STATUS.ENRICHING:
      return { backgroundColor: '#ede9fe', color: '#7c3aed' };
    case STATUS.DONE:
      return { backgroundColor: '#d1fae5', color: '#065f46' };
    case STATUS.ENRICH_UNAVAILABLE:
      return { backgroundColor: '#fef3c7', color: '#92400e' };
    default:
      return { backgroundColor: '#e5e7eb', color: '#6b7280' };
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateName(name, maxLen = 40) {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;
}

function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) return STATUS.TOO_LARGE;
  if (!ACCEPTED_MIME.includes(file.type)) return STATUS.UNSUPPORTED;
  return STATUS.PENDING;
}

export default function UploadModal({ isOpen, onClose, onUploadComplete }) {
  const [fileEntries, setFileEntries] = useState([]);
  const [folderMode, setFolderMode] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const fileInputRef = useRef(null);
  const idCounterRef = useRef(0);

  // ESC key closes modal
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFileEntries([]);
      setFolderMode(false);
      setIsDragOver(false);
      setAllDone(false);
      idCounterRef.current = 0;
    }
  }, [isOpen]);

  function addFiles(rawFiles) {
    const newEntries = Array.from(rawFiles).map((file) => ({
      localId: idCounterRef.current++,
      file,
      name: file.name,
      size: file.size,
      status: validateFile(file),
    }));
    setFileEntries((prev) => [...prev, ...newEntries]);
  }

  function updateStatus(localId, status) {
    setFileEntries((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, status } : e))
    );
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleZoneClick() {
    fileInputRef.current?.click();
  }

  function handleFileInputChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset so same files can be re-selected
      e.target.value = '';
    }
  }

  async function handleSubmit() {
    const pendingEntries = fileEntries.filter((e) => e.status === STATUS.PENDING);
    if (pendingEntries.length === 0) return;

    const pendingIds = new Set(pendingEntries.map((e) => e.localId));

    // Mark all pending as uploading
    setFileEntries((prev) =>
      prev.map((e) => (pendingIds.has(e.localId) ? { ...e, status: STATUS.UPLOADING } : e))
    );

    // Build FormData
    const formData = new FormData();
    pendingEntries.forEach((e) => formData.append('files', e.file));

    let uploadResult;
    try {
      uploadResult = await uploadFilesApi(formData);
    } catch {
      // Upload failed — mark all as failed
      setFileEntries((prev) =>
        prev.map((e) => (pendingIds.has(e.localId) ? { ...e, status: STATUS.UPLOAD_FAILED } : e))
      );
      setAllDone(true);
      return;
    }

    // Upload succeeded — enrich each file independently
    const assets = uploadResult.assets || [];
    const enrichPromises = pendingEntries.map((entry, i) => {
      const assetId = assets[i]?.id;
      if (!assetId) {
        updateStatus(entry.localId, STATUS.UPLOAD_FAILED);
        return Promise.resolve();
      }
      updateStatus(entry.localId, STATUS.ENRICHING);
      return enrichAssetApi(assetId)
        .then(() => updateStatus(entry.localId, STATUS.DONE))
        .catch((err) => {
          const httpStatus = err?.response?.status;
          if (httpStatus === 503) {
            updateStatus(entry.localId, STATUS.ENRICH_UNAVAILABLE);
          } else {
            updateStatus(entry.localId, STATUS.UPLOAD_FAILED);
          }
        });
    });

    await Promise.allSettled(enrichPromises);
    setAllDone(true);
  }

  if (!isOpen) return null;

  const pendingCount = fileEntries.filter((e) => e.status === STATUS.PENDING).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      data-testid="upload-modal-overlay"
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        data-testid="upload-modal"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1A1A2E' }}>
            Upload Assets
          </h2>
          <button
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: '#6b7280',
              lineHeight: 1,
            }}
            onClick={onClose}
            aria-label="Close"
            data-testid="upload-modal-close-btn"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Drop zone */}
          <div
            data-testid="drop-zone"
            style={{
              border: `2px ${isDragOver ? 'solid' : 'dashed'} ${GOLD}`,
              borderRadius: '8px',
              minHeight: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backgroundColor: isDragOver ? 'rgba(200, 150, 12, 0.06)' : 'transparent',
              transition: 'background-color 0.15s, border-style 0.15s',
            }}
            onClick={handleZoneClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <span
              style={{
                color: '#6b7280',
                fontSize: '14px',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              Drop images here or click to browse
            </span>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            {...(folderMode ? { webkitdirectory: '', directory: '' } : {})}
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
            data-testid="file-input"
          />

          {/* Folder mode toggle */}
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <button
              style={{
                background: 'none',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                cursor: 'pointer',
                color: '#374151',
              }}
              onClick={() => setFolderMode((m) => !m)}
              data-testid="folder-toggle-btn"
            >
              {folderMode ? 'Upload files' : 'Upload folder'}
            </button>
          </div>

          {/* File list */}
          {fileEntries.length > 0 && (
            <div style={{ marginTop: '16px' }} data-testid="file-list">
              {fileEntries.map((entry) => {
                const badgeStyle = getStatusStyle(entry.status);
                return (
                  <div
                    key={entry.localId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid #f3f4f6',
                      gap: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#374151',
                      }}
                      title={entry.name}
                    >
                      {truncateName(entry.name)}
                    </span>
                    <span
                      style={{ color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {formatFileSize(entry.size)}
                    </span>
                    <span
                      data-testid="file-status-badge"
                      style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        ...badgeStyle,
                      }}
                    >
                      {entry.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {allDone ? (
            <button
              style={{
                padding: '10px 20px',
                backgroundColor: NAVY,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
              onClick={onUploadComplete}
              data-testid="view-in-library-btn"
            >
              View in library
            </button>
          ) : (
            <button
              style={{
                padding: '10px 20px',
                backgroundColor: pendingCount > 0 ? GOLD : '#e5e7eb',
                color: pendingCount > 0 ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                cursor: pendingCount > 0 ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500',
              }}
              onClick={handleSubmit}
              disabled={pendingCount === 0}
              data-testid="submit-btn"
            >
              Upload {pendingCount} files
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
