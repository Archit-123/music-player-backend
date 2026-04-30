const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Playlist name is required"],
    trim: true,
  },
  createdBy: {
    type: String,
    required: [true, "Creator name is required"],
    trim: true,
  },
  songs: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Playlist", playlistSchema);
