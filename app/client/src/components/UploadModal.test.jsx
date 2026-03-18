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

import UploadModal, { traverseEntry, isImageFile } from './UploadModal';

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  onUploadComplete: vi.fn(),
};

function makeJpeg(name = 'photo.jpg', sizeMB = 1) {
  const file = new File(['x'.repeat(sizeMB * 1024)], name, { type: 'image/jpeg' });
  return file;
}

async function dropFile(dropZone, file) {
  const dropEvent = createEvent.drop(dropZone);
  Object.defineProperty(dropEvent, 'dataTransfer', {
    value: {
      items: [{ webkitGetAsEntry: () => makeFileEntry(file) }],
    },
  });
  await act(async () => {
    fireEvent(dropZone, dropEvent);
  });
}

beforeEach(() => {
  mockUploadFiles.mockResolvedValue({ assets: [{ id: 'asset-1' }] });
  mockEnrichAsset.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.style.overflow = '';
});

// ---------------------------------------------------------------------------
// Helper: build a mock FileSystemFileEntry from a File object
// ---------------------------------------------------------------------------
function makeFileEntry(file) {
  return {
    isFile: true,
    isDirectory: false,
    file: (cb) => cb(file),
  };
}

// Helper: build a mock FileSystemDirectoryEntry from an array of child entries
function makeDirEntry(children) {
  let called = false;
  const reader = {
    readEntries: (cb) => {
      if (!called) {
        called = true;
        cb(children);
      } else {
        cb([]); // second call signals end of entries
      }
    },
  };
  return {
    isFile: false,
    isDirectory: true,
    createReader: () => reader,
  };
}

describe('traverseEntry', () => {
  it('returns the file when the entry is an image file entry', async () => {
    const jpeg = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const result = await traverseEntry(makeFileEntry(jpeg));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('photo.jpg');
  });

  it('returns empty array for a non-image file entry', async () => {
    const pdf = new File([''], 'document.pdf', { type: 'application/pdf' });
    const result = await traverseEntry(makeFileEntry(pdf));
    expect(result).toHaveLength(0);
  });

  it('correctly filters out non-image files from a flat list of entries', async () => {
    const jpeg = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const pdf = new File([''], 'doc.pdf', { type: 'application/pdf' });
    const png = new File([''], 'image.png', { type: 'image/png' });
    const txt = new File([''], 'readme.txt', { type: 'text/plain' });

    const entries = [
      makeFileEntry(jpeg),
      makeFileEntry(pdf),
      makeFileEntry(png),
      makeFileEntry(txt),
    ];

    const allFiles = [];
    for (const entry of entries) {
      allFiles.push(...(await traverseEntry(entry)));
    }

    expect(allFiles).toHaveLength(2);
    expect(allFiles[0].name).toBe('photo.jpg');
    expect(allFiles[1].name).toBe('image.png');
  });

  it('accepts images identified only by extension (no MIME type)', async () => {
    const webp = new File([''], 'shot.webp', { type: '' });
    const gif = new File([''], 'anim.gif', { type: '' });
    const result = [
      ...(await traverseEntry(makeFileEntry(webp))),
      ...(await traverseEntry(makeFileEntry(gif))),
    ];
    expect(result).toHaveLength(2);
  });

  it('recursively collects image files from a directory entry', async () => {
    const jpeg = new File([''], 'nested.jpg', { type: 'image/jpeg' });
    const pdf = new File([''], 'skip.pdf', { type: 'application/pdf' });
    const dir = makeDirEntry([makeFileEntry(jpeg), makeFileEntry(pdf)]);

    const result = await traverseEntry(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('nested.jpg');
  });
});

describe('UploadModal — folder/mixed drop', () => {
  it('drop with a mix of file and folder entries queues only image files', async () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');

    // Direct image file entry
    const directJpeg = new File([''], 'direct.jpg', { type: 'image/jpeg' });
    // A folder containing one image and one non-image
    const folderJpeg = new File([''], 'folder-image.png', { type: 'image/png' });
    const folderPdf = new File([''], 'folder-doc.pdf', { type: 'application/pdf' });
    const dir = makeDirEntry([makeFileEntry(folderJpeg), makeFileEntry(folderPdf)]);

    const dropEvent = createEvent.drop(dropZone);
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        items: [
          { webkitGetAsEntry: () => makeFileEntry(directJpeg) },
          { webkitGetAsEntry: () => dir },
        ],
      },
    });

    await act(async () => {
      fireEvent(dropZone, dropEvent);
    });

    // Expect 2 files queued: directJpeg + folderJpeg (pdf skipped)
    const badges = await screen.findAllByTestId('file-status-badge');
    expect(badges).toHaveLength(2);
  });

  it('non-image files dropped directly are silently skipped', async () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');

    const pdf = new File([''], 'doc.pdf', { type: 'application/pdf' });
    const dropEvent = createEvent.drop(dropZone);
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        items: [{ webkitGetAsEntry: () => makeFileEntry(pdf) }],
      },
    });

    await act(async () => {
      fireEvent(dropZone, dropEvent);
    });

    expect(screen.queryByTestId('file-list')).not.toBeInTheDocument();
  });
});

describe('UploadModal', () => {
  it('dropping a valid JPEG sets its status to Pending in the file list', async () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');
    await dropFile(dropZone, makeJpeg());

    const badges = screen.getAllByTestId('file-status-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('Pending');
  });

  it('file > 20MB shows "Too large" status and is not in the pending list', async () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const bigFile = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 21 * 1024 * 1024 });

    const dropZone = screen.getByTestId('drop-zone');
    await dropFile(dropZone, bigFile);

    const badge = screen.getByTestId('file-status-badge');
    expect(badge).toHaveTextContent('Too large (max 20MB)');

    // Submit button disabled — no pending files
    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('Submit button is disabled when file list is empty', () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('Submit button label shows correct file count "Upload 3 files"', async () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');

    for (let i = 0; i < 3; i++) {
      await dropFile(dropZone, makeJpeg(`file${i}.jpg`));
    }

    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Upload 3 files');
  });

  it('after mocked uploadFiles + enrichAsset resolve, file status shows Done', async () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    const dropZone = screen.getByTestId('drop-zone');
    await dropFile(dropZone, makeJpeg());

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
    await dropFile(dropZone, makeJpeg());

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
    await dropFile(dropZone, makeJpeg());

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
    await dropFile(dropZone, makeJpeg());

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

  it('drop zone label reads "Drop images or folders here"', () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('drop-zone')).toHaveTextContent('Drop images or folders here');
  });

  it('"Browse files" and "Browse folder" buttons are present', () => {
    render(<UploadModal {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('browse-files-btn')).toBeInTheDocument();
    expect(screen.getByTestId('browse-folder-btn')).toBeInTheDocument();
  });
});
