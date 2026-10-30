/**
 * FileDropZone — accessible drag-and-drop + click file upload area.
 *
 * - Keyboard accessible: Enter/Space activates the hidden file input.
 * - ARIA role="button" with descriptive label for screen readers.
 * - Inline format guidance: .docx / .txt / .pdf and 10 MB maximum.
 * - Non-colour-only drag-active indicator (border style + text change).
 *
 * Requirements: 4.3, 4.5, 4.6, 4.7, 11.1, 14.4
 */

import React, { useRef, useState, useCallback } from 'react';

export type AcceptedFormat = 'docx' | 'txt' | 'pdf';

interface FileDropZoneProps {
  /** Which document kind this zone accepts. Drives the label copy. */
  kind: 'cv' | 'jd';
  /** Called when the user selects/drops a valid file. */
  onFile: (file: File) => void;
  /** Whether the zone is disabled (e.g. while an upload is in progress). */
  disabled?: boolean;
  /** Current uploaded filename to show as confirmation, if any. */
  uploadedFilename?: string;
  /** Optional additional CSS class names. */
  className?: string;
}

const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/pdf',
];

const ACCEPTED_EXTENSIONS = ['.docx', '.txt', '.pdf'];

/** 10 MB in bytes */
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function getExtension(filename: string): string {
  return (filename.split('.').pop() ?? '').toLowerCase();
}

function isAccepted(file: File): { ok: boolean; reason?: string } {
  const ext = getExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(`.${ext}`)) {
    return {
      ok: false,
      reason: `Unsupported format ".${ext}". Please use .docx, .txt, or .pdf.`,
    };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, reason: 'File exceeds the 10 MB maximum size.' };
  }
  return { ok: true };
}

export function FileDropZone({
  kind,
  onFile,
  disabled = false,
  uploadedFilename,
  className = '',
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const labelId = `drop-zone-label-${kind}`;
  const descId = `drop-zone-desc-${kind}`;

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const handleFile = useCallback(
    (file: File) => {
      const check = isAccepted(file);
      if (!check.ok) {
        setInlineError(check.reason ?? 'File not accepted.');
        return;
      }
      setInlineError(null);
      onFile(file);
    },
    [onFile]
  );

  // -------------------------------------------------------------------------
  // Drag events
  // -------------------------------------------------------------------------

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragActive(true);
  };

  const handleDragLeave = () => setIsDragActive(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // -------------------------------------------------------------------------
  // Click / keyboard activation
  // -------------------------------------------------------------------------

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset the input so the same file can be re-selected if needed.
    e.target.value = '';
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const kindLabel = kind === 'cv' ? 'CV' : 'Job Description';

  const borderColor = isDragActive
    ? '#2563eb'
    : uploadedFilename
    ? '#16a34a'
    : '#d1d5db';

  const borderStyle = isDragActive ? 'solid' : 'dashed';

  return (
    <div className={`file-drop-zone ${className}`.trim()}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES.join(',')}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleInputChange}
        disabled={disabled}
      />

      {/* Drop target */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-describedby={descId}
        aria-disabled={disabled}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '1rem 1rem',
          border: `2px ${borderStyle} ${borderColor}`,
          borderRadius: '0.75rem',
          background: isDragActive
            ? '#eff6ff'
            : uploadedFilename
            ? '#f0fdf4'
            : '#fafafa',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          transition: 'border-color 0.15s, background 0.15s',
          opacity: disabled ? 0.6 : 1,
          outline: 'none',
        }}
        onFocus={(e) => {
          if (!disabled)
            (e.currentTarget as HTMLDivElement).style.boxShadow =
              '0 0 0 3px rgba(37,99,235,0.4)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
        }}
      >
        {/* Non-colour-only indicator: icon changes on drag/upload state */}
        <span
          aria-hidden="true"
          style={{ fontSize: '1.25rem', lineHeight: 1 }}
        >
          {uploadedFilename ? '✅' : isDragActive ? '📂' : '📄'}
        </span>

        <span
          id={labelId}
          style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}
        >
          {uploadedFilename
            ? `${kindLabel} uploaded`
            : isDragActive
            ? `Drop your ${kindLabel} here`
            : `Upload your ${kindLabel}`}
        </span>

        {uploadedFilename ? (
          <span style={{ fontSize: '0.875rem', color: '#374151' }}>
            <strong>{uploadedFilename}</strong>
            <br />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              style={{
                marginTop: '0.25rem',
                background: 'none',
                border: 'none',
                color: '#2563eb',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.8125rem',
                padding: 0,
              }}
              aria-label={`Replace ${kindLabel} file`}
            >
              Replace file
            </button>
          </span>
        ) : (
          <span
            id={descId}
            style={{ fontSize: '0.875rem', color: '#6b7280' }}
          >
            Drag and drop or click to browse
          </span>
        )}
      </div>

      {/* Format and size guidance (Requirement 4.3) */}
      <p
        style={{
          margin: '0.5rem 0 0',
          fontSize: '0.8125rem',
          color: '#6b7280',
        }}
      >
        Accepted formats:{' '}
        <strong>.docx and .txt give the best results</strong>; .pdf is also
        accepted. Maximum file size: <strong>10 MB</strong>.
      </p>

      {/* Inline validation error (non-colour-only: icon + text) */}
      {inlineError && (
        <p
          role="alert"
          aria-live="assertive"
          style={{
            margin: '0.375rem 0 0',
            fontSize: '0.875rem',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <span aria-hidden="true">⚠️</span>
          {inlineError}
        </p>
      )}
    </div>
  );
}
