/**
 * utils/cleanup.js
 *
 * Automatically deletes files from the uploads directory
 * that are older than MAX_AGE_MS (default: 30 minutes).
 *
 * startCleanup(dir) – call once on server start.
 * It runs every INTERVAL_MS (default: 5 minutes).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const MAX_AGE_MS   = 30 * 60 * 1000; // 30 minutes
const INTERVAL_MS  =  5 * 60 * 1000; //  5 minutes

/**
 * Scans the uploads directory and removes files older than MAX_AGE_MS.
 * @param {string} dir – absolute path to the uploads directory
 */
async function cleanOldFiles(dir) {
  let files;
  try {
    files = await fs.promises.readdir(dir);
  } catch (err) {
    console.warn('[Cleanup] Could not read uploads dir:', err.message);
    return;
  }

  const now = Date.now();
  let removed = 0;

  for (const file of files) {
    if (file === '.gitkeep') continue; // keep placeholder

    const fp = path.join(dir, file);
    try {
      const stat = await fs.promises.stat(fp);
      const age  = now - stat.mtimeMs;
      if (age > MAX_AGE_MS) {
        await fs.promises.unlink(fp);
        removed++;
      }
    } catch (_) {
      // File may have already been deleted – ignore
    }
  }

  if (removed > 0) {
    console.log(`[Cleanup] Removed ${removed} expired file(s) from ${dir}`);
  }
}

/**
 * Starts the periodic cleanup job.
 * @param {string} dir – absolute path to the uploads directory
 */
function startCleanup(dir) {
  // Run once immediately, then every INTERVAL_MS
  cleanOldFiles(dir);
  setInterval(() => cleanOldFiles(dir), INTERVAL_MS);
  console.log(`[Cleanup] Scheduled: files older than ${MAX_AGE_MS / 60000} min will be deleted every ${INTERVAL_MS / 60000} min.`);
}

module.exports = { startCleanup, cleanOldFiles };
