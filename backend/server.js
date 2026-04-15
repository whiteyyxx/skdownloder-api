/**
 * server.js
 * YT Downloader Backend
 * ---------------------
 * Express.js server that:
 *   - Receives download requests from the Chrome extension
 *   - Uses yt-dlp to download YouTube videos
 *   - Saves files to a local "downloads/" folder
 *   - Returns status/filename to the extension
 *
 * Usage:
 *   node server.js
 *
 * Requirements:
 *   - Node.js v16+
 *   - yt-dlp installed and available in PATH
 *   - npm install (runs express, cors, uuid)
 */

const express  = require("express");
const cors     = require("cors");
const ytDlp = require("yt-dlp-exec");
const path     = require("path");
const fs       = require("fs");
const { v4: uuidv4 } = require("uuid");

const app  = express();
const PORT = 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

// Allow requests from Chrome extensions (any origin)
app.use(cors());

// Parse incoming JSON bodies
app.use(express.json());

// ── Ensure downloads/ folder exists ──────────────────────────────────────────
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR);
  console.log(`📁 Created downloads folder: ${DOWNLOADS_DIR}`);
}

// ── Health Check Endpoint ─────────────────────────────────────────────────────
// The extension pings this to show green/red status dot
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "YT Downloader backend is running." });
});

// ── POST /download ────────────────────────────────────────────────────────────
/**
 * Request body: { url: string, format: string }
 *   - url: YouTube watch URL
 *   - format: "best" | "1080p" | "720p" | "480p" | "360p" | "audio"
 *
 * Response: { success: true, filename: string }
 *        or { success: false, error: string }
 */
app.post("/download", async (req, res) => {
  const { url } = req.body;

  const fileName = `video_${Date.now()}.mp4`;
  const filePath = `downloads/${fileName}`;

  try {
    await ytDlp(url, {
      output: filePath,
      format: "best"
    });

    res.json({
      downloadUrl: `https://your-app.onrender.com/file/${fileName}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
});

// ── Helper: Validate YouTube URL ──────────────────────────────────────────────
function isValidYouTubeUrl(url) {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname === "/watch" &&
      u.searchParams.has("v")
    );
  } catch {
    return false;
  }
}

// ── Helper: Build yt-dlp CLI Command ─────────────────────────────────────────
/**
 * Converts a friendly format string ("720p", "audio", etc.)
 * into a yt-dlp format selector.
 *
 * yt-dlp format strings reference:
 *   https://github.com/yt-dlp/yt-dlp#format-selection
 */
function buildYtdlpCommand(url, format, outputTemplate) {
  let formatFlag = "";

  switch (format) {
    case "audio":
      // Extract audio only, convert to mp3
      formatFlag = `-x --audio-format mp3`;
      break;

    case "1080p":
      // Best video up to 1080p + best audio, merged into mp4
      formatFlag = `-f "bestvideo[height<=1080]+bestaudio/best[height<=1080]" --merge-output-format mp4`;
      break;

    case "720p":
      formatFlag = `-f "bestvideo[height<=720]+bestaudio/best[height<=720]" --merge-output-format mp4`;
      break;

    case "480p":
      formatFlag = `-f "bestvideo[height<=480]+bestaudio/best[height<=480]" --merge-output-format mp4`;
      break;

    case "360p":
      formatFlag = `-f "bestvideo[height<=360]+bestaudio/best[height<=360]" --merge-output-format mp4`;
      break;

    case "best":
    default:
      // Let yt-dlp pick the best available quality
      formatFlag = `-f "bestvideo+bestaudio/best" --merge-output-format mp4`;
      break;
  }

  // --no-playlist  → only download the single video, not a whole playlist
  // --restrict-filenames → replace special chars in filename for safety
  return `yt-dlp ${formatFlag} --no-playlist --restrict-filenames -o "${outputTemplate}" "${url}"`;
}

// ── Helper: Extract Filename from yt-dlp Output ───────────────────────────────
/**
 * yt-dlp prints lines like:
 *   [download] Destination: /path/to/downloads/My_Video.mp4
 * This function extracts just the filename portion.
 */
function extractFilename(stdout) {
  const lines = stdout.split("\n");
  for (const line of lines) {
    const match = line.match(/\[download\] Destination: (.+)/);
    if (match) {
      return path.basename(match[1].trim());
    }
    // Also check merge output line
    const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/);
    if (mergeMatch) {
      return path.basename(mergeMatch[1].trim());
    }
  }
  return null;
}

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 YT Downloader backend running at http://localhost:${PORT}`);
  console.log(`   Health check : GET  http://localhost:${PORT}/health`);
  console.log(`   Download     : POST http://localhost:${PORT}/download`);
  console.log(`   Downloads dir: ${DOWNLOADS_DIR}\n`);
});
