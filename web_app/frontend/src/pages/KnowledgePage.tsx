import { useEffect, useState, useRef } from 'react';
import { FileText, Plus, Trash2, Edit, X, Save, Upload, FileUp } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface KnowledgeFile {
  filename: string;
  size: number;
  modified_at: string;
}

// Supported file formats
const SUPPORTED_FORMATS = ['.txt', '.md', '.docx', '.pdf', '.doc'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function KnowledgePage() {
  const { showSuccess, showError } = useToast();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileContent, setNewFileContent] = useState<string>('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch knowledge files
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/knowledge');
      const data = await response.json();
      if (data.status === 'success') {
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error fetching knowledge files:', error);
      showError('Failed to load knowledge files');
    } finally {
      setLoading(false);
    }
  };

  // Fetch file content
  const fetchFileContent = async (filename: string) => {
    try {
      const response = await fetch(`/api/knowledge/${encodeURIComponent(filename)}`);
      const data = await response.json();
      if (data.status === 'success') {
        setFileContent(data.content || '');
        setEditContent(data.content || '');
        setSelectedFile(filename);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
      showError('Failed to load file content');
    }
  };

  // Upload file
  const uploadFile = async (file: File) => {
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
      setUploadingFile(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/knowledge', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.status === 'success') {
        showSuccess(data.message || 'File uploaded successfully');
        setShowCreateModal(false);
        fetchFiles();
      } else {
        showError(data.message || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  // Create new text file
  const createFile = async () => {
    if (!newFileName.trim()) {
      showError('Please enter a file name');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('filename', newFileName);
      formData.append('content', newFileContent);

      const response = await fetch('/api/knowledge', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.status === 'success') {
        showSuccess(data.message || 'File created successfully');
        setShowCreateModal(false);
        setNewFileName('');
        setNewFileContent('');
        fetchFiles();
      } else {
        showError(data.message || 'Failed to create file');
      }
    } catch (error) {
      console.error('Error creating file:', error);
      showError('Failed to create file');
    }
  };

  // Update file
  const updateFile = async () => {
    if (!selectedFile) return;

    // Only allow editing .txt and .md files
    const ext = '.' + selectedFile.split('.').pop()?.toLowerCase();
    if (!['.txt', '.md'].includes(ext)) {
      showError('Only .txt and .md files can be edited');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('content', editContent);

      const response = await fetch(`/api/knowledge/${encodeURIComponent(selectedFile)}`, {
        method: 'PUT',
        body: formData,
      });

      const data = await response.json();
      if (data.status === 'success') {
        showSuccess(data.message || 'File updated successfully');
        setFileContent(editContent);
        setIsEditing(false);
      } else {
        showError(data.message || 'Failed to update file');
      }
    } catch (error) {
      console.error('Error updating file:', error);
      showError('Failed to update file');
    }
  };

  // Delete file
  const deleteFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/knowledge/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.status === 'success') {
        showSuccess(data.message || 'File deleted successfully');
        if (selectedFile === filename) {
          setSelectedFile(null);
          setFileContent('');
        }
        fetchFiles();
      } else {
        showError(data.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showError('Failed to delete file');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const canEditFile = (filename: string) => {
    const ext = '.' + filename.split('.').pop()?.toLowerCase();
    return ['.txt', '.md'].includes(ext);
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage knowledge documents for AI context. Supports: {SUPPORTED_FORMATS.join(', ')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Note: .docx, .pdf, and .doc files are automatically converted to .md format for AI compatibility
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Document
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* File List */}
        <div className="w-1/3 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Documents</h2>
            <p className="text-xs text-gray-500 mt-1">{files.length} file{files.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : files.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No documents yet. Upload or create one to get started.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {files.map((file) => (
                  <li
                    key={file.filename}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedFile === file.filename ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => fetchFileContent(file.filename)}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.filename}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatFileSize(file.size)} • {formatDate(file.modified_at)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* File Content / Empty State */}
        <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
          {selectedFile ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900">{selectedFile}</h2>
                  <p className="text-xs text-gray-500 mt-1">Knowledge document</p>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={updateFile}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditContent(fileContent);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {canEditFile(selectedFile) && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => deleteFile(selectedFile)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full min-h-[400px] p-4 font-mono text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter content..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {fileContent ? (
                      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">{fileContent}</pre>
                    ) : (
                      <p className="text-gray-500">No content</p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Document Selected</h3>
                <p className="text-sm text-gray-500 mb-4">Select a document from the list or upload/create a new one</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create or Upload Document
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Upload Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add New Document</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFileName('');
                  setNewFileContent('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-6">
                {/* File Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload File (Max 10MB)
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept={SUPPORTED_FORMATS.join(',')}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(file);
                      }}
                    />
                    <FileUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                      Drag & drop a file here, or click to select
                    </p>
                    <p className="text-xs text-gray-500 mb-1">
                      Supported: {SUPPORTED_FORMATS.join(', ')}
                    </p>
                    <p className="text-xs text-gray-400">
                      .docx, .pdf, and .doc files will be converted to .md format
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>

                {/* Create Text File Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Create Text File (.txt or .md)
                  </label>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="e.g., product-info.md"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">.md or .txt extension will be added automatically if not provided</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    value={newFileContent}
                    onChange={(e) => setNewFileContent(e.target.value)}
                    placeholder="Enter your knowledge content here..."
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFileName('');
                  setNewFileContent('');
                }}
                disabled={uploadingFile}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createFile}
                disabled={uploadingFile || !newFileName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {uploadingFile ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Create Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
