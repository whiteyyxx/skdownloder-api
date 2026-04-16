const express = require("express");
const cors = require("cors");
const ytDlp = require("yt-dlp-exec").create({
  // force auto-download of binary
  download: true,
});
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Ensure downloads folder exists ───────────────────────────────────────────
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// ── GET: Download File ───────────────────────────────────────────────────────
app.get("/file/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(DOWNLOADS_DIR, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        console.error("Download error:", err);
      } else {
        console.log(`File sent: ${filename}`);
      }
    });
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// ── POST: Download Video ─────────────────────────────────────────────────────
app.post("/download", async (req, res) => {
  console.log("Request body:", req.body);

  const { url, format } = req.body;
  console.log("URL:", url);
  console.log("Format:", format);

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const filename = `video_${Date.now()}.mp4`;
  const filePath = path.join(DOWNLOADS_DIR, filename);

  try {
    console.log("Starting download...");

    // Optional format handling
    let formatOption = "best";

    if (format === "360p") {
      formatOption = "bestvideo[height<=360]+bestaudio";
    } else if (format === "720p") {
      formatOption = "bestvideo[height<=720]+bestaudio";
    } else if (format === "1080p") {
      formatOption = "bestvideo[height<=1080]+bestaudio";
    }

    await ytDlp(url, {
      output: filePath,
    });

    console.log(`Download complete: ${filename}`);

    // ✅ FIXED: dynamic URL (works on Render)
    const downloadUrl = `${req.protocol}://${req.get("host")}/file/${filename}`;

    // Auto delete file after 5 minutes
    setTimeout(() => {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Delete error:", err);
        else console.log(`Deleted: ${filename}`);
      });
    }, 5 * 60 * 1000);

    res.json({ downloadUrl });

  } catch (error) {
    console.error("yt-dlp error:", error.message);

    res.status(500).json({
      error: "Download failed",
      details: error.message
    });
  }
});

// ── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running`);
  console.log(`POST /download`);
  console.log(`GET  /file/:filename\n`);
});