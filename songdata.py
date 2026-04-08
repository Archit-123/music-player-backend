print("Hello")
import yt_dlp
import requests
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

UPLOAD_URL = "http://localhost:5000/upload"

def process_video(url):
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'downloads/%(title).50s.%(ext)s',
        'writethumbnail': True,
        'postprocessors': [
            {
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            },
            {
                'key': 'FFmpegMetadata'
            }
        ],
        'quiet': True
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

        # Metadata
        title = info.get("title")
        channel = info.get("uploader")  # artist fallback
        thumbnail = info.get("thumbnail")

        filename = ydl.prepare_filename(info)
        mp3_file = os.path.splitext(filename)[0] + ".mp3"

        # Download thumbnail manually (better control)
        thumb_path = mp3_file.replace(".mp3", ".jpg")
        thumb_data = requests.get(thumbnail).content
        with open(thumb_path, "wb") as f:
            f.write(thumb_data)

        # Upload both files
        upload_song(mp3_file, thumb_path, title, channel)


def upload_song(audio_path, cover_path, title, artist):
    with open(audio_path, 'rb') as audio, open(cover_path, 'rb') as cover:
        files = {
            'audio': audio,
            'cover': cover
        }

        data = {
            'title': title,
            'artist': artist or "Unknown"
        }

        res = requests.post(UPLOAD_URL, files=files, data=data)
        print(str(res.json()).encode('utf-8', errors='ignore').decode())


def process_playlist(url):
    ydl_opts = {
        'extract_flat': True,
        'quiet': True
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        playlist = ydl.extract_info(url, download=False)

        for entry in playlist['entries']:
            video_url = f"https://www.youtube.com/watch?v={entry['id']}"
            print("Processing:", video_url)
            process_video(video_url)


# OR playlist:
# process_playlist("YOUTUBE_PLAYLIST_LINK")

import sys

if __name__ == "__main__":
    url = sys.argv[1]  # get URL from Node

    if "playlist" in url:
        process_playlist(url)
    else:
        process_video(url)