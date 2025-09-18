#!/usr/bin/env python3
import pytchat
import sys
import requests
import time

def fetch_chat_participants(video_id, server_url="http://localhost:3001"):
    participants = {}

    try:
        chat = pytchat.create(video_id=video_id)
        print(f"Connected to chat: {video_id}", flush=True)

        while chat.is_alive():
            for c in chat.get().sync_items():
                # GET THE FUCKING CHANNEL ID!
                channel_id = c.author.channelId if hasattr(c.author, 'channelId') else None
                author_name = c.author.name

                if not channel_id:
                    # Fallback if no channel ID
                    channel_id = f"no_id_{author_name}"

                if channel_id not in participants:
                    participants[channel_id] = {
                        'name': author_name,
                        'id': channel_id,
                        'url': c.author.channelUrl if hasattr(c.author, 'channelUrl') else ''
                    }

                    print(f"New: {author_name} -> {channel_id}", flush=True)

                    # Send to server
                    try:
                        requests.post(
                            f"{server_url}/api/chat-participants",
                            json={
                                "videoId": video_id,
                                "participants": list(participants.values())
                            },
                            timeout=2
                        )
                    except:
                        pass

            time.sleep(1)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python chat_fetcher.py <video_id>")
        sys.exit(1)

    video_id = sys.argv[1]
    server_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3001"

    fetch_chat_participants(video_id, server_url)