#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robust YouTube Chat Fetcher with multiple fallback mechanisms
Designed for production use during live streams
"""

import pytchat
import sys
import requests
import time
import signal
import threading
import json
import os
from datetime import datetime
import traceback
import io

# Force UTF-8 encoding for Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

class RobustChatFetcher:
    def __init__(self, video_id, server_url="http://localhost:3001"):
        self.video_id = video_id
        self.server_url = server_url
        self.participants = {}
        self.running = True
        self.chat = None
        self.reconnect_count = 0
        self.max_reconnects = 100  # Very high limit for production
        self.last_message_time = time.time()
        self.heartbeat_interval = 10  # Send heartbeat every 10 seconds
        self.last_heartbeat = time.time()

        # Statistics for monitoring
        self.stats = {
            'start_time': datetime.now(),
            'messages_processed': 0,
            'participants_found': 0,
            'errors': 0,
            'reconnects': 0
        }

        # Setup signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, self.signal_handler)

    def signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        print(f"[{self.get_timestamp()}] Shutting down gracefully...", flush=True)
        self.running = False
        self.cleanup()
        sys.exit(0)

    def get_timestamp(self):
        """Get current timestamp for logging"""
        return datetime.now().strftime("%H:%M:%S")

    def send_heartbeat(self):
        """Send heartbeat to server to indicate we're still alive"""
        try:
            requests.post(
                f"{self.server_url}/api/chat-heartbeat",
                json={
                    "videoId": self.video_id,
                    "status": "alive",
                    "stats": self.stats,
                    "participants_count": len(self.participants)
                },
                timeout=2
            )
        except:
            pass  # Heartbeat is not critical

    def connect_to_chat(self):
        """Establish connection to YouTube chat with retry logic"""
        max_retries = 5
        retry_delay = 2

        for attempt in range(max_retries):
            try:
                print(f"[{self.get_timestamp()}] Connecting to chat (attempt {attempt + 1}/{max_retries})...", flush=True)

                # Try to create chat connection
                self.chat = pytchat.create(
                    video_id=self.video_id,
                    interruptable=False,  # More stable on Windows
                    seektime=0,  # Start from live position
                    force_replay=False  # We want live chat
                )

                if self.chat and self.chat.is_alive():
                    print(f"[{self.get_timestamp()}] [OK] Successfully connected to chat: {self.video_id}", flush=True)
                    self.last_message_time = time.time()
                    return True

            except Exception as e:
                print(f"[{self.get_timestamp()}] Connection attempt {attempt + 1} failed: {e}", flush=True)

                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff

        return False

    def process_message(self, message):
        """Process a single chat message"""
        try:
            # Extract participant info
            channel_id = getattr(message.author, 'channelId', None)
            author_name = message.author.name

            if not channel_id:
                channel_id = f"no_id_{author_name}"

            # Check if new participant
            if channel_id not in self.participants:
                self.participants[channel_id] = {
                    'name': author_name,
                    'id': channel_id,
                    'url': getattr(message.author, 'channelUrl', ''),
                    'first_seen': datetime.now().isoformat()
                }

                print(f"[{self.get_timestamp()}] New participant: {author_name} -> {channel_id}", flush=True)
                self.stats['participants_found'] += 1

                # Send update to server
                self.send_participants_update()

            self.stats['messages_processed'] += 1
            self.last_message_time = time.time()

        except Exception as e:
            print(f"[{self.get_timestamp()}] Error processing message: {e}", flush=True)
            self.stats['errors'] += 1

    def send_participants_update(self):
        """Send participants update to server with retry"""
        max_retries = 3

        for attempt in range(max_retries):
            try:
                response = requests.post(
                    f"{self.server_url}/api/chat-participants",
                    json={
                        "videoId": self.video_id,
                        "participants": list(self.participants.values())
                    },
                    timeout=5
                )

                if response.status_code == 200:
                    return True

            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    print(f"[{self.get_timestamp()}] Failed to send update after {max_retries} attempts", flush=True)

            time.sleep(0.5)

        return False

    def monitor_health(self):
        """Monitor chat health and reconnect if needed"""
        timeout_seconds = 45  # Reconnect if no messages for 45 seconds

        while self.running:
            try:
                current_time = time.time()

                # Check if we need to send heartbeat
                if current_time - self.last_heartbeat > self.heartbeat_interval:
                    self.send_heartbeat()
                    self.last_heartbeat = current_time

                # Check if chat is stale
                if current_time - self.last_message_time > timeout_seconds:
                    print(f"[{self.get_timestamp()}] ⚠ No messages for {timeout_seconds}s, reconnecting...", flush=True)

                    # Terminate old connection
                    if self.chat:
                        try:
                            self.chat.terminate()
                        except:
                            pass

                    # Reconnect
                    if self.connect_to_chat():
                        self.reconnect_count += 1
                        self.stats['reconnects'] += 1
                        print(f"[{self.get_timestamp()}] [OK] Reconnected successfully (#{self.reconnect_count})", flush=True)
                    else:
                        print(f"[{self.get_timestamp()}] [ERROR] Reconnection failed, will retry...", flush=True)
                        time.sleep(5)

                time.sleep(5)  # Check every 5 seconds

            except Exception as e:
                print(f"[{self.get_timestamp()}] Monitor error: {e}", flush=True)
                time.sleep(5)

    def run(self):
        """Main execution loop"""
        print(f"[{self.get_timestamp()}] Starting Robust Chat Fetcher for video: {self.video_id}", flush=True)

        # Initial connection
        if not self.connect_to_chat():
            print(f"[{self.get_timestamp()}] [ERROR] Failed to establish initial connection", flush=True)
            return

        # Start health monitor in background
        monitor_thread = threading.Thread(target=self.monitor_health, daemon=True)
        monitor_thread.start()

        # Main message processing loop
        error_count = 0
        max_consecutive_errors = 10

        while self.running:
            try:
                if not self.chat or not self.chat.is_alive():
                    print(f"[{self.get_timestamp()}] Chat connection lost, attempting to reconnect...", flush=True)
                    if not self.connect_to_chat():
                        time.sleep(5)
                        continue

                # Get messages
                messages = self.chat.get()

                if messages:
                    error_count = 0  # Reset error count on success

                    # Process each message
                    for message in messages.sync_items():
                        self.process_message(message)

                # Small delay to prevent CPU overuse
                time.sleep(0.2)

            except KeyboardInterrupt:
                print(f"[{self.get_timestamp()}] Interrupted by user", flush=True)
                break

            except Exception as e:
                error_count += 1
                self.stats['errors'] += 1

                print(f"[{self.get_timestamp()}] Error in main loop ({error_count}/{max_consecutive_errors}): {e}", flush=True)

                if error_count >= max_consecutive_errors:
                    print(f"[{self.get_timestamp()}] Too many consecutive errors, forcing reconnect...", flush=True)

                    # Force reconnection
                    if self.chat:
                        try:
                            self.chat.terminate()
                        except:
                            pass

                    time.sleep(5)

                    if self.connect_to_chat():
                        error_count = 0
                        self.reconnect_count += 1
                        self.stats['reconnects'] += 1
                    else:
                        print(f"[{self.get_timestamp()}] [CRITICAL] Unable to reconnect", flush=True)
                        time.sleep(10)

                time.sleep(1)

        self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        print(f"[{self.get_timestamp()}] Cleaning up...", flush=True)

        # Print final statistics
        print(f"[{self.get_timestamp()}] Final Statistics:", flush=True)
        print(f"  - Messages processed: {self.stats['messages_processed']}", flush=True)
        print(f"  - Participants found: {self.stats['participants_found']}", flush=True)
        print(f"  - Total errors: {self.stats['errors']}", flush=True)
        print(f"  - Reconnections: {self.stats['reconnects']}", flush=True)

        # Terminate chat connection
        if self.chat:
            try:
                self.chat.terminate()
            except:
                pass

        # Send final update to server
        try:
            requests.post(
                f"{self.server_url}/api/chat-heartbeat",
                json={
                    "videoId": self.video_id,
                    "status": "terminated",
                    "stats": self.stats
                },
                timeout=2
            )
        except:
            pass

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python chat_fetcher_robust.py <video_id> [server_url]")
        sys.exit(1)

    video_id = sys.argv[1]
    server_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3001"

    # Create and run fetcher
    fetcher = RobustChatFetcher(video_id, server_url)

    try:
        fetcher.run()
    except Exception as e:
        print(f"Fatal error: {e}", flush=True)
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()