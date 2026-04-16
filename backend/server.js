const express = require("express");
const cors = require("cors");
const ytDlp = require("yt-dlp-exec");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Ensure Express can parse JSON and handle CORS (Added before routes)
app.use(cors());
app.use(express.json());

// ── Ensure downloads/ folder exists ──────────────────────────────────────────
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// ── GET /file/:filename ──────────────────────────────────────────────────────
// 7. Add GET /file/:filename route to send requested files
app.get("/file/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(DOWNLOADS_DIR, filename);

  // Check if file exists before downloading
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// ── POST /download ────────────────────────────────────────────────────────────
app.post("/download", async (req, res) => {
  // 4. Add debugging logs
  console.log("Request body:", req.body);
  
  const { url } = req.body;
  console.log("URL received:", url);

  // 2. Validate: If URL is missing → return error
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // 5. Generate filename: video_<timestamp>.mp4
  const filename = `video_${Date.now()}.mp4`;
  const filePath = path.join(DOWNLOADS_DIR, filename);

  try {
    // 3. Fix yt-dlp-exec usage
    console.log(`Starting download for: ${url}`);
    
    // Ensure URL is passed properly as the first argument
    await ytDlp(url, {
      output: filePath,
    });

    console.log(`Download complete: ${filename}`);

    // 6. Return response with download link
    // Note: When deploying to Render, 'localhost:3000' should be replaced with your Render URL
    const downloadUrl = `http://localhost:${PORT}/file/${filename}`;
    res.json({ downloadUrl });

  } catch (error) {
    // 8. Add error handling: Catch yt-dlp errors and send proper JSON response
    console.error("yt-dlp error:", error.message);
    res.status(500).json({ 
      error: "Download failed", 
      details: error.message 
    });
  }
});

// Simple Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   POST /download -> { "url": "..." }`);
  console.log(`   GET  /file/:filename\n`);
});
