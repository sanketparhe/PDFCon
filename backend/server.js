/**
 * server.js – PDFForge Backend Entry Point
 *
 * Starts an Express server with:
 *  - Security headers (Helmet)
 *  - CORS (configurable)
 *  - JSON + multipart body parsing
 *  - REST API routes for conversion and download
 *  - Static file serving from /uploads (for downloads)
 *  - Automatic cleanup of files older than 30 minutes
 */

'use strict';

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');
const fs       = require('fs');

const convertRoutes  = require('./routes/convert');
const downloadRoutes = require('./routes/download');
const { startCleanup } = require('./utils/cleanup');

// ─── App Setup ────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Security ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // allow PDF downloads
}));

// CORS – restrict to your frontend domains in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3001', '*'];

app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : function (origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static: serve converted files for download ───────────────────────
app.use('/uploads', express.static(uploadsDir));

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: '1.0.0' });
});

// ─── API Routes ───────────────────────────────────────────────────────
app.use('/api', convertRoutes);
app.use('/api', downloadRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ PDFForge API running on http://localhost:${PORT}`);
  console.log(`📂 Uploads directory: ${uploadsDir}`);
  // Start the 30-minute cleanup job
  startCleanup(uploadsDir);
});

module.exports = app;
