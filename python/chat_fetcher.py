#!/usr/bin/env python3
"""
YouTube Live Chat Fetcher using pytchat
Retrieves real chat participants from YouTube live streams
"""

import pytchat
import json
import sys
import time
from typing import Set
import requests

def fetch_chat_participants(video_id: str, server_url: str = "http://localhost:3001"):
    """
    Fetch live chat participants from YouTube stream

    Args:
        video_id: YouTube video/stream ID
        server_url: Node.js server URL for sending updates
    """
    participants: Set[str] = set()

    try:
        # Create chat object
        chat = pytchat.create(video_id=video_id)

        print(f"Connected to YouTube live chat for video: {video_id}")

        while chat.is_alive():
            # Get chat messages
            new_participants_in_batch = []
            for c in chat.get().sync_items():
                author = c.author.name

                # Add new participant
                if author not in participants:
                    participants.add(author)
                    new_participants_in_batch.append(author)

            # Send update only if there are new participants
            if new_participants_in_batch:
                print(f"New participants: {', '.join(new_participants_in_batch)}")
                try:
                    payload = {
                        "videoId": video_id,
                        "participants": list(participants)
                    }
                    requests.post(
                        f"{server_url}/api/chat-participants",
                        json=payload,
                        timeout=5
                    )
                except requests.exceptions.RequestException as e:
                    print(f"Failed to send update to server: {e}")

                # Limit memory usage
                if len(participants) > 1000:
                    break

            # Small delay to prevent overload
            time.sleep(0.1)

    except Exception as e:
        print(f"Error fetching chat: {e}")
        return list(participants)

    return list(participants)

def main():
    """Main function to run the chat fetcher"""
    if len(sys.argv) < 2:
        print("Usage: python chat_fetcher.py <video_id> [server_url]")
        sys.exit(1)

    video_id = sys.argv[1]
    server_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3001"

    print(f"Starting chat fetcher for video: {video_id}")
    print(f"Server URL: {server_url}")

    participants = fetch_chat_participants(video_id, server_url)

    print(f"\nTotal participants: {len(participants)}")

    # Output as JSON
    result = {
        "videoId": video_id,
        "participants": participants,
        "count": len(participants)
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()