/**
 * routes/download.js
 *
 * GET /api/download/:filename
 *   – Serves a converted PDF file for download.
 *   – Validates that the filename is safe (no path traversal).
 *   – Returns 404 if the file doesn't exist (already cleaned up).
 */

'use strict';

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const sanitize = require('sanitize-filename');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * GET /api/download/:filename
 *
 * Response:
 *   200 – PDF file download
 *   400 – invalid filename
 *   404 – file not found (expired or invalid)
 */
router.get('/download/:filename', (req, res) => {
  const rawName = req.params.filename;

  // Sanitize to prevent path traversal attacks
  const safeName = sanitize(rawName);
  if (!safeName || safeName !== rawName) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  // Only allow .pdf extension
  if (path.extname(safeName).toLowerCase() !== '.pdf') {
    return res.status(400).json({ error: 'Only PDF downloads are allowed.' });
  }

  const filePath = path.join(UPLOADS_DIR, safeName);

  // Confirm file is within uploads directory (belt-and-suspenders)
  if (!filePath.startsWith(UPLOADS_DIR + path.sep)) {
    return res.status(400).json({ error: 'Invalid path.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or has been deleted.' });
  }

  // Force download with Content-Disposition header
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.sendFile(filePath);
});

module.exports = router;
