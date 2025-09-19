#!/usr/bin/env python3
import pytchat
import sys
import requests
import time
import signal
import threading

def fetch_chat_participants(video_id, server_url="http://localhost:3001"):
    participants = {}
    error_count = 0
    max_errors = 5

    # Handle signal interrupts better on Windows
    def signal_handler(signum, frame):
        print("Chat fetcher stopped by signal", flush=True)
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)

    try:
        # Create chat with better error handling
        chat = pytchat.create(video_id=video_id, interruptable=False)
        print(f"Connected to chat: {video_id}", flush=True)

        # Keep-alive mechanism
        last_activity = time.time()
        timeout_seconds = 30  # Reconnect if no activity for 30 seconds

        while chat.is_alive():
            try:
                # Get messages with timeout
                messages = chat.get()

                if messages:
                    last_activity = time.time()
                    error_count = 0  # Reset error count on successful message retrieval

                    for c in messages.sync_items():
                        # GET THE CHANNEL ID!
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

                            # Send to server with better error handling
                            try:
                                requests.post(
                                    f"{server_url}/api/chat-participants",
                                    json={
                                        "videoId": video_id,
                                        "participants": list(participants.values())
                                    },
                                    timeout=5  # Increased timeout
                                )
                            except requests.exceptions.RequestException as e:
                                print(f"Failed to send to server: {e}", flush=True)

                # Check for timeout
                if time.time() - last_activity > timeout_seconds:
                    print(f"No activity for {timeout_seconds} seconds, reconnecting...", flush=True)
                    chat.terminate()
                    time.sleep(2)
                    chat = pytchat.create(video_id=video_id, interruptable=False)
                    last_activity = time.time()
                    print(f"Reconnected to chat: {video_id}", flush=True)

            except Exception as e:
                error_count += 1
                print(f"Error in chat loop ({error_count}/{max_errors}): {e}", flush=True)

                if error_count >= max_errors:
                    print("Too many errors, attempting to reconnect...", flush=True)
                    try:
                        chat.terminate()
                    except:
                        pass

                    time.sleep(5)

                    try:
                        chat = pytchat.create(video_id=video_id, interruptable=False)
                        error_count = 0
                        print(f"Successfully reconnected to chat: {video_id}", flush=True)
                    except Exception as reconnect_error:
                        print(f"Failed to reconnect: {reconnect_error}", flush=True)
                        break

            # Small delay to prevent CPU overuse
            time.sleep(0.5)

    except Exception as e:
        print(f"Fatal error: {e}", flush=True)
    finally:
        try:
            if 'chat' in locals() and chat:
                chat.terminate()
        except:
            pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python chat_fetcher.py <video_id>")
        sys.exit(1)

    video_id = sys.argv[1]
    server_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3001"

    fetch_chat_participants(video_id, server_url)