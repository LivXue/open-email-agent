import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface TempFile {
  filename: string;
  original_filename: string;
  uploaded_at: string;
}

interface TempFileListProps {
  sessionId: string | null;
  onFileChange?: () => void;
}

interface TempFileUploadButtonProps {
  sessionId: string | null;
  onFileChange?: () => void;
}

// Supported file formats
const SUPPORTED_FORMATS = ['.txt', '.md', '.docx', '.pdf', '.doc'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Create a context for sharing temp files state
const TempFilesContext = createContext<{
  files: TempFile[];
  loading: boolean;
  uploading: boolean;
  refreshFiles: () => void;
  setUploading: (uploading: boolean) => void;
} | null>(null);

// Custom hook to use the temp files context
function useTempFilesContext() {
  const context = useContext(TempFilesContext);
  if (!context) {
    throw new Error('useTempFilesContext must be used within TempFilesProvider');
  }
  return context;
}

// Provider component that manages the state
export function TempFileProvider({ sessionId, children }: { sessionId: string | null; children: React.ReactNode }) {
  const [files, setFiles] = useState<TempFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = async () => {
    if (!sessionId) {
      setFiles([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/sessions/${sessionId}/temp-files`);
      const data = await response.json();
      if (data.status === 'success') {
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error fetching temp files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [sessionId]);

  return (
    <TempFilesContext.Provider value={{ files, loading, uploading, refreshFiles: fetchFiles, setUploading }}>
      {children}
    </TempFilesContext.Provider>
  );
}

// File List Component
export function TempFileList({ sessionId, onFileChange }: TempFileListProps) {
  const { showSuccess, showError } = useToast();
  const { files, loading, refreshFiles } = useTempFilesContext();

  const deleteFile = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!sessionId) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/temp-files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.status === 'success') {
        showSuccess('File deleted');
        refreshFiles();
        onFileChange?.();
      } else {
        showError(data.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showError('Failed to delete file');
    }
  };

  if (!sessionId || files.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-2">
      {loading ? (
        <span className="text-xs text-gray-400">Loading...</span>
      ) : (
        files.map((file) => (
          <div
            key={file.filename}
            className="flex items-center gap-1.5 px-2 py-1 bg-primary-50 border border-primary-200 rounded-md group hover:bg-primary-100 transition-colors"
            title={file.original_filename}
          >
            <FileText className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-700 max-w-[150px] truncate">
              {file.original_filename}
            </span>
            <button
              onClick={(e) => deleteFile(file.filename, e)}
              className="opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded p-0.5 transition-all"
              title="Remove file"
            >
              <X className="w-3 h-3 text-red-600" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// Upload Button Component
export function TempFileUploadButton({ sessionId, onFileChange }: TempFileUploadButtonProps) {
  const { showSuccess, showError } = useToast();
  const { uploading, setUploading, refreshFiles } = useTempFilesContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!sessionId) {
      showError('No active session');
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      showError('File size exceeds 10MB limit');
      return;
    }

    // Check file extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      showError(`Unsupported file format. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/sessions/${sessionId}/temp-files`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.status === 'success') {
        showSuccess(`Uploaded: ${file.name}`);
        refreshFiles();
        onFileChange?.();

        // Notify user that file is available in agent's filesystem
        setTimeout(() => {
          showSuccess('File is now available in the session filesystem at temp_uploads/');
        }, 1000);
      } else {
        showError(data.message || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  if (!sessionId) {
    return null;
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={SUPPORTED_FORMATS.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            uploadFile(file);
            e.target.value = '';
          }
        }}
        disabled={uploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-3.5 bg-white border border-gray-300 hover:border-primary-500 hover:bg-primary-50 rounded-xl transition-all duration-200 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex-shrink-0"
        title="Upload temporary file (max 10MB)"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Add File</span>
      </button>
    </>
  );
}
