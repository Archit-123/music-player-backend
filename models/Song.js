const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
  title: String,
  artist: String,
  audioUrl: String,
  coverUrl: String,
});

module.exports = mongoose.model("Song", songSchema);
