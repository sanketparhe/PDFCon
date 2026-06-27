/**
 * controllers/convertController.js
 *
 * Handles all PDF conversion operations:
 *
 *  convert(req, res) — dispatches to the correct handler based on `req.body.tool`:
 *    • jpg-to-pdf / png-to-pdf  → imageToPdf()
 *    • images-to-pdf            → multiImagesToPdf()
 *    • word-to-pdf              → officeToPdf()
 *    • ppt-to-pdf               → officeToPdf()
 *    • merge-pdf                → mergePdfs()
 *    • compress-pdf             → compressPdf()
 */

'use strict';

const { PDFDocument } = require('pdf-lib');
const libreConvert    = require('libreoffice-convert');
const path            = require('path');
const fs              = require('fs');
const { promisify }   = require('util');

const libreConvertAsync = promisify(libreConvert.convert);
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// ─── Helpers ──────────────────────────────────────────────────────────

/** Read a file and return a Buffer */
function readFile(filePath) {
  return fs.promises.readFile(filePath);
}

/** Write a Buffer to a file */
function writeFile(filePath, buffer) {
  return fs.promises.writeFile(filePath, buffer);
}

/** Build an output filename in the uploads dir */
function outPath(name) {
  return path.join(UPLOADS_DIR, name);
}

/** Remove a file silently */
async function unlinkSafe(fp) {
  try { await fs.promises.unlink(fp); } catch (_) {}
}

/** Respond with the result JSON */
function respond(res, outputName, originalName) {
  return res.json({
    success:      true,
    filename:     outputName,
    originalName: originalName || outputName,
    downloadUrl:  `/api/download/${outputName}`,
  });
}

// ─── Handlers ─────────────────────────────────────────────────────────

/**
 * imageToPdf – converts a single JPG or PNG to a PDF.
 * Uses pdf-lib to create a page matching the image dimensions.
 */
async function imageToPdf(file) {
  const imgBuffer = await readFile(file.path);
  const pdfDoc    = await PDFDocument.create();

  const ext = path.extname(file.originalname).toLowerCase();
  let pdfImage;

  if (ext === '.jpg' || ext === '.jpeg') {
    pdfImage = await pdfDoc.embedJpg(imgBuffer);
  } else if (ext === '.png') {
    pdfImage = await pdfDoc.embedPng(imgBuffer);
  } else {
    throw new Error('Unsupported image format. Use JPG or PNG.');
  }

  // Create a page that exactly fits the image
  const page = pdfDoc.addPage([pdfImage.width, pdfImage.height]);
  page.drawImage(pdfImage, { x: 0, y: 0, width: pdfImage.width, height: pdfImage.height });

  const pdfBytes = await pdfDoc.save();
  const outName  = file.filename.replace(/\.[^.]+$/, '') + '.pdf';
  await writeFile(outPath(outName), pdfBytes);
  await unlinkSafe(file.path); // remove original upload
  return outName;
}

/**
 * multiImagesToPdf – combines multiple images into a single PDF.
 * Each image becomes one page.
 */
async function multiImagesToPdf(files) {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const imgBuffer = await readFile(file.path);
    const ext = path.extname(file.originalname).toLowerCase();

    let pdfImage;
    if (ext === '.jpg' || ext === '.jpeg') pdfImage = await pdfDoc.embedJpg(imgBuffer);
    else if (ext === '.png') pdfImage = await pdfDoc.embedPng(imgBuffer);
    else continue; // skip unsupported

    const page = pdfDoc.addPage([pdfImage.width, pdfImage.height]);
    page.drawImage(pdfImage, { x: 0, y: 0, width: pdfImage.width, height: pdfImage.height });
    await unlinkSafe(file.path);
  }

  if (pdfDoc.getPageCount() === 0) throw new Error('No valid images found.');

  const pdfBytes = await pdfDoc.save();
  const outName  = `merged-images-${Date.now()}.pdf`;
  await writeFile(outPath(outName), pdfBytes);
  return outName;
}

/**
 * officeToPdf – converts a Word or PowerPoint file to PDF using LibreOffice.
 * Requires LibreOffice to be installed on the server:
 *   Ubuntu/Debian: sudo apt install libreoffice
 *   macOS: brew install --cask libreoffice
 */
async function officeToPdf(file) {
  const inputBuffer = await readFile(file.path);
  let pdfBuffer;
  try {
    pdfBuffer = await libreConvertAsync(inputBuffer, '.pdf', undefined);
  } catch (err) {
    throw new Error(`Office conversion failed. Ensure LibreOffice is installed. (${err.message})`);
  }
  const outName = file.filename.replace(/\.[^.]+$/, '') + '.pdf';
  await writeFile(outPath(outName), pdfBuffer);
  await unlinkSafe(file.path);
  return outName;
}

/**
 * mergePdfs – merges multiple PDF files into one.
 * Preserves all pages from each input PDF in order.
 */
async function mergePdfs(files) {
  const mergedDoc = await PDFDocument.create();

  for (const file of files) {
    const buf = await readFile(file.path);
    let srcDoc;
    try {
      srcDoc = await PDFDocument.load(buf);
    } catch {
      throw new Error(`"${file.originalname}" is not a valid PDF.`);
    }
    const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    pages.forEach(p => mergedDoc.addPage(p));
    await unlinkSafe(file.path);
  }

  if (mergedDoc.getPageCount() === 0) throw new Error('No pages found in provided PDFs.');

  const pdfBytes = await mergedDoc.save();
  const outName  = `merged-${Date.now()}.pdf`;
  await writeFile(outPath(outName), pdfBytes);
  return outName;
}

/**
 * compressPdf – compresses a PDF by rewriting it with pdf-lib (removes unreferenced objects).
 * For heavy compression, integrate Ghostscript on the server.
 *
 * NOTE: pdf-lib's "compression" is lossless metadata cleanup only.
 * For lossy image compression install ghostscript and call:
 *   gs -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -dCompatibilityLevel=1.4
 *      -dPDFSETTINGS=/ebook -sOutputFile=out.pdf in.pdf
 */
async function compressPdf(file) {
  const buf    = await readFile(file.path);
  let srcDoc;
  try {
    srcDoc = await PDFDocument.load(buf, { updateMetadata: false });
  } catch {
    throw new Error(`"${file.originalname}" is not a valid PDF.`);
  }
  const pdfBytes = await srcDoc.save({ useObjectStreams: true }); // enables cross-ref streams = smaller
  const outName  = `compressed-${file.filename.replace(/\.[^.]+$/, '')}.pdf`;
  await writeFile(outPath(outName), pdfBytes);
  await unlinkSafe(file.path);

  const originalSize   = buf.length;
  const compressedSize = pdfBytes.length;
  const saving = Math.max(0, Math.round((1 - compressedSize / originalSize) * 100));

  return { outName, saving };
}

// ─── Main Dispatcher ──────────────────────────────────────────────────

/**
 * POST /api/convert
 *
 * Request (multipart/form-data):
 *   files  – one or more files
 *   tool   – one of the tool keys listed at the top of this file
 *
 * Response (JSON):
 *   { success, filename, originalName, downloadUrl }
 */
async function convert(req, res, next) {
  try {
    const files = req.files;
    const tool  = req.body.tool;

    // ── Validation ──────────────────────────────────────────────────
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const validTools = ['jpg-to-pdf','png-to-pdf','word-to-pdf','ppt-to-pdf','images-to-pdf','merge-pdf','compress-pdf'];
    if (!validTools.includes(tool)) {
      return res.status(400).json({ error: `Unknown tool "${tool}".` });
    }

    let outName, extra = {};

    switch (tool) {
      case 'jpg-to-pdf':
      case 'png-to-pdf':
        outName = await imageToPdf(files[0]);
        break;

      case 'images-to-pdf':
        outName = await multiImagesToPdf(files);
        break;

      case 'word-to-pdf':
      case 'ppt-to-pdf':
        outName = await officeToPdf(files[0]);
        break;

      case 'merge-pdf':
        outName = await mergePdfs(files);
        break;

      case 'compress-pdf': {
        const result = await compressPdf(files[0]);
        outName = result.outName;
        extra = { saving: result.saving };
        break;
      }
    }

    return res.json({
      success:      true,
      filename:     outName,
      originalName: files[0].originalname,
      downloadUrl:  `/api/download/${outName}`,
      ...extra,
    });

  } catch (err) {
    // Clean up any remaining upload files on error
    if (req.files) {
      for (const f of req.files) unlinkSafe(f.path).catch(() => {});
    }
    next(err);
  }
}

module.exports = { convert };
