/**
 * middleware/upload.js
 *
 * Configures Multer for secure multipart file uploads:
 *  - Stores files in /uploads with UUID-prefixed names
 *  - Enforces 50MB max file size
 *  - Validates file extensions against allowed types
 *  - Sanitizes filenames to prevent path traversal
 */

'use strict';

const multer   = require('multer');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-filename');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Allowed MIME types and extensions
const ALLOWED = {
  'image/jpeg':        ['.jpg', '.jpeg'],
  'image/png':         ['.png'],
  'image/webp':        ['.webp'],
  'application/pdf':   ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
};

// Multer disk storage – gives files a safe, unique name
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const sanitized = sanitize(file.originalname) || 'upload';
    const ext  = path.extname(sanitized).toLowerCase();
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

// File filter – reject disallowed types early
function fileFilter(req, file, cb) {
  const ext  = path.extname(file.originalname).toLowerCase();
  const allowed = Object.values(ALLOWED).flat();
  if (!allowed.includes(ext)) {
    return cb(new Error(`File type "${ext}" is not supported.`), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

module.exports = upload;
