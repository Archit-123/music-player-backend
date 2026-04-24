print("PYTHON SCRIPT STARTED")
import yt_dlp
import requests
import os
import sys
from dotenv import load_dotenv

# Fix encoding
sys.stdout.reconfigure(encoding='utf-8')

# Load .env
load_dotenv()

# Create downloads folder if not exists
if not os.path.exists("downloads"):
    os.makedirs("downloads")

# Use ENV or fallback
# UPLOAD_URL = os.getenv("UPLOAD_URL", "http://127.0.0.1:5000/upload")
UPLOAD_URL = "http://localhost:5000/upload"


# def process_video(url):
#     try:
#         ydl_opts = {
#     'format': 'bestaudio/best',
#     'cookiefile': 'cookies.txt',
#     'outtmpl': 'downloads/%(title).50s.%(ext)s',
#     'writethumbnail': True,
#     'quiet': True,
#     'http_headers': {
#         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
#     },
#     'sleep_interval': 2,
#     'max_sleep_interval': 5,
#     'postprocessors': [
#         {
#             'key': 'FFmpegExtractAudio',
#             'preferredcodec': 'mp3',
#             'preferredquality': '192',
#         },
#         {
#             'key': 'FFmpegMetadata'
#         }
#     ]
# }

#         with yt_dlp.YoutubeDL(ydl_opts) as ydl:
#             info = ydl.extract_info(url, download=True)

#             title = info.get("title")
#             artist = info.get("uploader") or "Unknown"
#             thumbnail = info.get("thumbnail")

#             filename = ydl.prepare_filename(info)
#             mp3_file = os.path.splitext(filename)[0] + ".mp3"

#             thumb_path = mp3_file.replace(".mp3", ".jpg")

#             print(f" Downloaded: {title}")
#             print(f" Audio file: {mp3_file}")
#             print(f" Thumbnail path: {thumb_path}")
#             print(f" Uploading to: {UPLOAD_URL}")

#             # Download thumbnail manually
#             thumb_data = requests.get(thumbnail).content
#             with open(thumb_path, "wb") as f:
#                 f.write(thumb_data)

#             # Upload
#             upload_song(mp3_file, thumb_path, title, artist)

#             # Cleanup
#             if os.path.exists(mp3_file):
#                 os.remove(mp3_file)
#             if os.path.exists(thumb_path):
#                 os.remove(thumb_path)

#     except Exception as e:
#         print(" PROCESS VIDEO ERROR:", str(e))
    
def process_video(url):
    mp3_file = None
    thumb_path = None

    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'cookiefile': 'cookies.txt',
            'outtmpl': 'downloads/%(title).50s.%(ext)s',
            'writethumbnail': True,
            'quiet': True,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0'
            },
            'sleep_interval': 2,
            'max_sleep_interval': 5,
            'postprocessors': [
                {
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                },
                {
                    'key': 'FFmpegMetadata'
                }
            ]
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

            title = info.get("title")
            artist = info.get("uploader") or "Unknown"
            thumbnail = info.get("thumbnail")

            filename = ydl.prepare_filename(info)
            mp3_file = os.path.splitext(filename)[0] + ".mp3"
            thumb_path = mp3_file.replace(".mp3", ".jpg")

            print(f"Downloaded: {title}")
            print(f"Audio file: {mp3_file}")
            print(f"Thumbnail path: {thumb_path}")

            # Download thumbnail
            thumb_data = requests.get(thumbnail).content
            with open(thumb_path, "wb") as f:
                f.write(thumb_data)

            # Upload
            upload_song(mp3_file, thumb_path, title, artist)

    except Exception as e:
        print("PROCESS VIDEO ERROR:", str(e))

    finally:
        try:
            if mp3_file:
                base_name = os.path.splitext(mp3_file)[0]

                for ext in [".mp3", ".jpg", ".webm", ".m4a", ".webp", ".info.json"]:
                    file_path = base_name + ext
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"Deleted: {file_path}")

        except Exception as cleanup_error:
            print("Cleanup error:", cleanup_error)

def upload_song(audio_path, cover_path, title, artist):
    try:
        with open(audio_path, 'rb') as audio, open(cover_path, 'rb') as cover:
            files = {
                'audio': audio,
                'cover': cover
            }

            data = {
                'title': title,
                'artist': artist
            }

            res = requests.post(UPLOAD_URL, files=files, data=data)

            if res.status_code != 200:
                print(" Upload failed:", res.text)
            else:
                print("Upload success:", res.json())

    except Exception as e:
        print(" UPLOAD ERROR:", str(e))


def process_playlist(url):
    try:
        ydl_opts = {
            'extract_flat': True,
            'quiet': True
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            playlist = ydl.extract_info(url, download=False)

            for entry in playlist['entries']:
                video_url = f"https://www.youtube.com/watch?v={entry['id']}"
                print("▶ Processing:", video_url)
                process_video(video_url)

    except Exception as e:
        print(" PLAYLIST ERROR:", str(e))


if __name__ == "__main__":
    try:
        url = sys.argv[1]

        if "playlist" in url:
            process_playlist(url)
        else:
            process_video(url)

    except Exception as e:
        print(" MAIN ERROR:", str(e))

