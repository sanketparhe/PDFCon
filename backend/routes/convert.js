/**
 * routes/convert.js
 *
 * POST /api/convert
 *   – Accepts multipart form data with file(s) and a tool name.
 *   – Runs through Multer (upload middleware) then the conversion controller.
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const upload     = require('../middleware/upload');
const { convert } = require('../controllers/convertController');

/**
 * POST /api/convert
 *
 * Body (multipart/form-data):
 *   files[]  – 1–10 files (Multer field name: "files")
 *   tool     – string (e.g. "jpg-to-pdf", "merge-pdf")
 *
 * Response:
 *   200 { success, filename, originalName, downloadUrl }
 *   400 { error } – validation failure
 *   500 { error } – conversion failure
 */
router.post('/convert', upload.array('files', 10), convert);

module.exports = router;
