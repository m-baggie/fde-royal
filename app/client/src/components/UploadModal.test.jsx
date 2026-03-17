import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, createEvent } from '@testing-library/react';

// Hoist mock functions so they are available inside the vi.mock factory
const { mockUploadFiles, mockEnrichAsset } = vi.hoisted(() => ({
  mockUploadFiles: vi.fn(),
  mockEnrichAsset: vi.fn(),
}));

vi.mock('../api/assets', () => ({
  uploadFiles: mockUploadFiles,
  enrichAsset: mockEnrichAsset,
}));

import UploadModal from './UploadModal';

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  onUploadComplete: vi.fn(),
};

function makeJpeg(name = 'photo.jpg', sizeMB = 1) {
  const file = new File(['x'.repeat(sizeMB * 1024)], name, { type: 'image/jpeg' });
  return file;
}

function dropFile(dropZone, file) {
  const dropEvent = createEvent.drop(dropZone);
  Object.defineProperty(dropEvent, 'dataTransfer', {
    value: { files: [file] },
  });
  fireEvent(dropZone, dropEvent);
}

beforeEach(() => {
  mockUploadFiles.mockResolvedValue({ assets: [{ id: 'asset-1' }] });
  mockEnrichAsset.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.style.overflow = '';
});

describe('UploadModal', () => {
  it('dropping a valid JPEG sets its status to Pending in the file list', () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');
    dropFile(dropZone, makeJpeg());

    const badges = screen.getAllByTestId('file-status-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('Pending');
  });

  it('file > 20MB shows "Too large" status and is not in the pending list', () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const bigFile = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 21 * 1024 * 1024 });

    const dropZone = screen.getByTestId('drop-zone');
    dropFile(dropZone, bigFile);

    const badge = screen.getByTestId('file-status-badge');
    expect(badge).toHaveTextContent('Too large (max 20MB)');

    // Submit button disabled — no pending files
    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('Submit button is disabled when file list is empty', () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('Submit button label shows correct file count "Upload 3 files"', () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');

    for (let i = 0; i < 3; i++) {
      dropFile(dropZone, makeJpeg(`file${i}.jpg`));
    }

    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Upload 3 files');
  });

  it('after mocked uploadFiles + enrichAsset resolve, file status shows Done', async () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');
    dropFile(dropZone, makeJpeg());

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('file-status-badge')).toHaveTextContent('Done ✓')
    );
  });

  it('"View in library" button appears after all files are done', async () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');
    dropFile(dropZone, makeJpeg());

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('view-in-library-btn')).toBeInTheDocument()
    );
  });

  it('uploadFiles rejects → file shows "Upload failed" red', async () => {
    mockUploadFiles.mockRejectedValue(new Error('network error'));

    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');
    dropFile(dropZone, makeJpeg());

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('file-status-badge')).toHaveTextContent('Upload failed')
    );
    // View in library still appears so user can dismiss
    await waitFor(() =>
      expect(screen.getByTestId('view-in-library-btn')).toBeInTheDocument()
    );
  });

  it('enrichAsset returns 503 → file shows amber "Uploaded — enrichment unavailable", View in library appears', async () => {
    mockUploadFiles.mockResolvedValue({ assets: [{ id: 'asset-1' }] });
    mockEnrichAsset.mockRejectedValue({ response: { status: 503 } });

    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');
    dropFile(dropZone, makeJpeg());

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('file-status-badge')).toHaveTextContent(
        'Uploaded — enrichment unavailable'
      )
    );
    expect(screen.getByTestId('view-in-library-btn')).toBeInTheDocument();
  });
});
