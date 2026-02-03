# Knowledge Base - Document Format Support

## Overview

The Knowledge Base feature allows you to upload and manage various document formats that the AI can reference when processing requests.

**Important**: All uploaded documents are **automatically converted to plain text** (.txt or .md) for compatibility with the agent's filesystem. The AI can read these files directly using the `read_file` tool, and their content is also injected into the system prompt.

## Supported Document Formats

| Input Format | Extension | Stored As | Parser Library | Status |
|--------------|-----------|-----------|----------------|--------|
| Plain Text | `.txt` | `.txt` | Built-in | ✅ Always Available |
| Markdown | `.md` | `.md` | Built-in | ✅ Always Available |
| Word Document | `.docx` | `.md` | `python-docx` | ⚠️ Optional |
| PDF | `.pdf` | `.md` | `pdfplumber` / `PyPDF2` | ⚠️ Optional |
| Legacy Word | `.doc` | `.md` | `docx2txt` / `textract` | ⚠️ Optional |

### Storage Behavior

- `.txt` files → Stored as-is (readable by agent)
- `.md` files → Stored as-is (readable by agent)
- `.docx` files → **Converted to `.md`** (readable by agent)
- `.pdf` files → **Converted to `.md`** (readable by agent)
- `.doc` files → **Converted to `.md`** (readable by agent)

This ensures the agent's `read_file` tool can always access the content directly.

## Installation

### Basic Installation (TXT and MD only)

The basic installation supports `.txt` and `.md` files out of the box:

```bash
# Already installed - no additional setup needed
```

### Full Document Support

For full support of all document formats, install the optional dependencies:

```bash
# Install Python dependencies
uv pip install python-docx pdfplumber

# OR with pip
pip install python-docx pdfplumber

# Alternative PDF parser (if pdfplumber is not available)
pip install PyPDF2

# For .doc files (legacy Word format)
pip install docx2txt
# OR
pip install textract

# For .doc files on Linux (requires system package)
sudo apt-get install antiword
```

### Quick Install Commands

```bash
# Recommended: Install all document parsers
uv pip install python-docx pdfplumber docx2txt PyPDF2
```

## Usage

### 1. Via Web Interface

1. Navigate to the **Knowledge** tab in the web interface
2. Click **"New Document"**
3. Either:
   - **Upload a file**: Drag & drop or click to select (max 10MB)
   - **Create text file**: Enter filename and content manually
4. View, edit, or delete documents as needed

### 2. Via Filesystem

Documents are stored in `/data/xuedizhan/deepagents/knowledge/`:

```bash
# Copy documents to knowledge directory
cp /path/to/document.pdf /data/xuedizhan/deepagents/knowledge/

# Create a new markdown document
cat > /data/xuedizhan/deepagents/knowledge/product-info.md << 'EOF'
# Product Information

## Features
- Feature 1
- Feature 2

## Pricing
- Basic: $10/month
- Pro: $25/month
EOF
```

## Document Format Details

### .txt and .md Files
- **Purpose**: Plain text and markdown documentation
- **Editable**: Yes (via web interface)
- **Encoding**: UTF-8 (with fallback to Latin-1)
- **Max Size**: 10MB

### .docx Files (Microsoft Word 2007+)
- **Purpose**: Word documents with formatted text
- **Editable**: No (must re-upload after editing)
- **Extraction**: Text from paragraphs and tables
- **Requires**: `python-docx`

### .pdf Files
- **Purpose**: PDF documents
- **Editable**: No (must re-upload after editing)
- **Extraction**: Text from all pages
- **Requires**: `pdfplumber` (recommended) or `PyPDF2`
- **Note**: Scanned PDFs (images) require OCR and won't work

### .doc Files (Legacy Word)
- **Purpose**: Old Word format (.doc, not .docx)
- **Editable**: No (must re-upload after editing)
- **Extraction**: Text extraction
- **Requires**: `docx2txt`, `textract`, or `antiword`
- **Note**: Conversion to .docx is recommended

## Limitations

1. **File Size**: Maximum 10MB per file
2. **Scanned PDFs**: Image-based PDFs cannot be extracted (require OCR)
3. **Password Protected Files**: Encrypted files cannot be parsed
4. **Complex Formatting**: Only text content is extracted (images, charts, etc. are ignored)
5. **Editing**: Only `.txt` and `.md` files can be edited via the web interface

## Troubleshooting

### PDF extraction not working
```bash
# Try installing pdfplumber
pip install pdfplumber

# OR try PyPDF2 as fallback
pip install PyPDF2
```

### .docx files not uploading
```bash
pip install python-docx
```

### .doc files not supported
```bash
# Try docx2txt first
pip install docx2txt

# Or convert .doc to .docx using LibreOffice:
libreoffice --headless --convert-to docx document.doc
```

### File format not supported error
Make sure the file extension matches one of the supported formats:
- `.txt`, `.md` - Always available
- `.docx`, `.pdf`, `.doc` - Require optional dependencies

## Architecture

### Document Parser (`lib/document_parser.py`)
- `DocumentParser.extract_text(filepath)` - Main entry point
- Automatically detects file format and routes to appropriate parser
- Graceful fallback between different libraries

### Prompt Generation (`lib/prompt.py`)
- `load_knowledge_content()` - Loads all documents at prompt generation time
- Automatically parses all supported formats in the knowledge directory
- Injects extracted text into `<user_knowledge>` section of system prompt

### Backend API (`web_app/backend/api_server.py`)
- `POST /api/knowledge` - Upload or create documents
- `GET /api/knowledge` - List all documents
- `GET /api/knowledge/{filename}` - Get document content
- `PUT /api/knowledge/{filename}` - Update document (text files only)
- `DELETE /api/knowledge/{filename}` - Delete document

### Frontend (`web_app/frontend/src/pages/KnowledgePage.tsx`)
- File upload with drag & drop support
- File size validation (10MB limit)
- Format validation
- Text file editing (.txt and .md only)

## Best Practices

1. **Prefer Markdown**: Use `.md` files for documentation (editable, version control friendly)
2. **Keep Files Focused**: One topic per file for better context injection
3. **Use Descriptive Names**: Clear filenames help the AI understand content
4. **Regular Updates**: Knowledge is loaded fresh on each agent session
5. **File Size**: Keep files under 1MB for optimal performance
6. **Text Extraction**: For .docx/.pdf, verify text extraction quality before uploading

## Example Knowledge Documents

### Company Information (`company-info.md`)
```markdown
# Company Information

## Contact Details
- Email: contact@example.com
- Phone: +1-555-1234
- Address: 123 Business St, City, Country

## Products
Our main products include:
1. Product A - Enterprise solution
2. Product B - Small business solution
```

### Email Templates (`email-templates.md`)
```markdown
# Email Templates

## Welcome Email
Subject: Welcome to Our Service!

Dear [Name],

Thank you for signing up...

## Support Response
Subject: Re: [Ticket #]

Hi [Name],

Thanks for reaching out...
```
