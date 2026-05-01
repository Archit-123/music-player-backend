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
const Playlist = require("./models/Playlist");

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

// Upload songs to cloudinary and Mongo
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

// Add song to playlist
app.put("/playlists/:playlistId/add-song", async (req, res) => {
  try {
    const { songId } = req.body;

    const playlist = await Playlist.findById(req.params.playlistId);

    if (!playlist) return res.status(404).send("Playlist not found");

    if (!playlist.songs.some((id) => id.toString() === songId)) {
      playlist.songs.push(songId);
      await playlist.save();
    }

    const updated = await Playlist.findById(playlist._id).populate("songs");

    res.json(updated);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Remove song from playlist
app.put("/playlists/:playlistId/remove-song", async (req, res) => {
  try {
    const { songId } = req.body;

    const playlist = await Playlist.findById(req.params.playlistId);

    if (!playlist) return res.status(404).send("Playlist not found");

    playlist.songs = playlist.songs.filter((id) => id.toString() !== songId);

    await playlist.save();

    const updated = await Playlist.findById(playlist._id).populate("songs");

    res.json(updated);
  } catch (err) {
    res.status(500).send(err);
  }
});

// MOngoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// POST /playlists
app.post("/playlists", async (req, res) => {
  try {
    const { name, createdBy } = req.body;

    // manual validation
    if (!name || !createdBy) {
      return res.status(400).json({
        error: "Name and CreatedBy are required",
      });
    }

    const playlist = new Playlist({
      name,
      createdBy,
      songs: [],
    });

    await playlist.save();

    const updated = await Playlist.findById(playlist._id).populate("songs");
    res.json(updated);
  } catch (err) {
    res.status(500).send(err);
  }
});
// Get Playlist
app.get("/playlists", async (req, res) => {
  try {
    const playlists = await Playlist.find()
      .populate("songs")
      .sort({ createdAt: -1 });
    res.json(playlists);
  } catch (err) {
    res.status(500).send(err);
  }
});
// Put PLaylist
app.put("/playlists/:id", async (req, res) => {
  try {
    const { name } = req.body;

    const updated = await Playlist.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true },
    );

    res.json(updated);
  } catch (err) {
    res.status(500).send(err);
  }
});
// Delete Playlist
app.delete("/playlists/:id", async (req, res) => {
  try {
    await Playlist.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).send(err);
  }
});

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

// 1. DELETE songs
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

// 2.Update songs in admin
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

// 3. Get songs
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

//keep system awake/up
app.get("/health", (req, res) => {
  res.send("OK");
});
// Test route
app.get("/", (req, res) => {
  res.send("Streaming server running 🎵");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
