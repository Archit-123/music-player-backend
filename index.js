const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 5000;
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");
const Song = require("./models/Song");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://music-player-frontend-ten.vercel.app",
      "https://architmusic.in",
    ],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post(
  "/upload",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!req.files || !req.files.audio || !req.files.cover) {
        return res.status(400).json({ error: "Files missing" });
      }
      const audioFile = req.files.audio[0];
      const coverFile = req.files.cover[0];

      // Upload audio
      const audioUpload = await cloudinary.uploader.upload(audioFile.path, {
        resource_type: "video",
      });

      // Upload cover
      const coverUpload = await cloudinary.uploader.upload(coverFile.path);

      // Save in MongoDB
      const newSong = new Song({
        title: req.body.title,
        artist: req.body.artist,
        audioUrl: audioUpload.secure_url,
        coverUrl: coverUpload.secure_url,
        audioPublicId: audioUpload.public_id,
        coverPublicId: coverUpload.public_id,
      });

      const savedSong = await newSong.save();
      console.log("✅ SAVED TO DB:", savedSong);
      if (audioFile?.path) fs.unlinkSync(audioFile.path);
      if (coverFile?.path) fs.unlinkSync(coverFile.path);

      res.json(newSong);
    } catch (err) {
      console.log("❌ UPLOAD ERROR FULL:", err); // full error
      console.log("❌ MESSAGE:", err.message); // short message

      res.status(500).json({
        error: err.message,
        full: err,
      });
    }
  },
);

// MOngoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Cloudinary
app.get("/test-cloudinary", async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      { resource_type: "video" },
    );

    res.json(result);
  } catch (err) {
    res.status(500).send(err);
  }
});

// SOngs CRUD

// 1. DELETE
app.delete("/songs/:id", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({ error: "Song not found" });
    }

    if (song.audioPublicId) {
      await cloudinary.uploader.destroy(song.audioPublicId, {
        resource_type: "video",
      });
    }

    if (song.coverPublicId) {
      await cloudinary.uploader.destroy(song.coverPublicId);
    }

    await Song.findByIdAndDelete(req.params.id);

    res.json({ message: "Song deleted from DB + Cloudinary ✅" });
  } catch (err) {
    console.log("DELETE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2.Update
app.put("/songs/:id", async (req, res) => {
  try {
    const updated = await Song.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        artist: req.body.artist,
      },
      { new: true },
    );

    res.json(updated);
  } catch (err) {
    console.log("Update ERROR:", err); // 👈 ADD THIS
    res.status(500).json({ error: err.message });
  }
});

// 3. Get
app.get("/songs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;

    const songs = await Song.find()
      .sort({ _id: -1 }) // newest first
      .skip(page * limit)
      .limit(limit);

    res.json(songs);
  } catch (err) {
    res.status(500).send(err);
  }
});

// for admin to fetch all songs length
app.get("/songscount", async (req, res) => {
  try {
    const songs = await Song.find().sort({ _id: -1 });
    res.json(songs);
  } catch (error) {
    res.status(500).send(error);
  }
});

// for python automation
app.post("/youtube-import", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log("Incoming URL:", url);

    const process = spawn("python", [
      require("path").join(__dirname, "songdata.py"),
      url,
    ]);

    process.stdout.on("data", (data) => {
      console.log("PYTHON:", data.toString());
    });

    process.stderr.on("data", (data) => {
      console.error("PYTHON ERROR:", data.toString());
    });

    process.on("close", (code) => {
      console.log("Python exited with code:", code);

      if (code === 0) {
        res.json({ message: "Import completed" });
      } else {
        res.status(500).json({ error: "Python process failed" });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test route
app.get("/", (req, res) => {
  res.send("Streaming server running 🎵");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
