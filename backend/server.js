const express = require("express");
const cors = require("cors");
const ytDlp = require("yt-dlp-exec").create({
  binaryPath: "yt-dlp" // use pip-installed yt-dlp
});
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Ensure downloads folder exists ─────────────────────
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// ── GET: Download file ─────────────────────────────────
app.get("/file/:filename", (req, res) => {
  const filePath = path.join(DOWNLOADS_DIR, req.params.filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// ── POST: Download video ───────────────────────────────
app.post("/download", async (req, res) => {
  const { url } = req.body;

  console.log("URL received:", url);

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const filename = `video_${Date.now()}.mp4`;
  const filePath = path.join(DOWNLOADS_DIR, filename);

  try {
    console.log("Downloading...");

    await ytDlp(url, {
      output: filePath
    });

    console.log("Download complete:", filename);

    const downloadUrl = `${req.protocol}://${req.get("host")}/file/${filename}`;

    // Auto delete after 5 mins
    setTimeout(() => {
      fs.unlink(filePath, () => {});
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

// ── Health check ───────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ── Start server ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});