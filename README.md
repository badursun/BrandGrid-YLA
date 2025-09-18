# YouTube Live Awards System

Real-time YouTube live stream monitoring and reward system that tracks likes and automatically selects winners from chat participants.

## 🚀 Quick Start

### Windows
1. **Download** the project folder
2. **Double-click** `START.bat`
3. System will automatically install all dependencies on first run
4. Browser will open at `http://localhost:3001`

### macOS
1. **Download** the project folder
2. **Double-click** `START.command`
   - If it doesn't open, right-click → Open
   - Or make it executable: `chmod +x START.command`
3. System will automatically install all dependencies on first run
4. Browser will open at `http://localhost:3001`

### Linux
1. **Download** the project folder
2. Run: `chmod +x START.sh && ./START.sh`
3. System will automatically install all dependencies on first run
4. Browser will open at `http://localhost:3001`

## 📋 Requirements

### Automatic Installation
The start scripts will automatically check and guide you to install:
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **Python 3** - [Download](https://www.python.org/)

### Manual Installation (if automatic fails)
```bash
# Install Node dependencies
npm install
cd server && npm install

# Install Python dependencies
pip3 install pytchat requests
```

## 🎮 How to Use

1. **Start the Application**
   - Windows: Double-click `START.bat`
   - macOS: Double-click `START.command`
   - Linux: Run `./START.sh`

2. **Control Panel** (http://localhost:3001)
   - Enter YouTube Live Video ID
   - Start monitoring
   - Set reward intervals
   - View participants and winners

3. **Progress Display** (http://localhost:3001/progress)
   - Full-screen display for streaming
   - Shows live like count
   - Announces winners with effects

## 🎯 Features

- **Real-time Monitoring**: Tracks YouTube live stream likes
- **Automatic Winner Selection**: Picks random winners from chat participants
- **Channel ID Tracking**: Each participant tracked by unique YouTube channel ID
- **Multiple Reward Modes**:
  - Target-based rewards
  - Automatic interval rewards
- **Live Statistics**:
  - Stream duration
  - Participant count
  - Like progress
- **Visual Effects**:
  - Winner announcements
  - GIF backgrounds
  - Confetti animations

## 📁 Project Structure

```
YOUTUBE_PROGRESS_BAR/
├── START.bat           # Windows launcher
├── START.command       # macOS launcher
├── START.sh           # Linux launcher
├── setup.js           # Automatic setup script
├── server/
│   ├── server.js      # Main server
│   └── package.json   # Server dependencies
├── python/
│   ├── chat_fetcher.py    # YouTube chat monitor
│   └── requirements.txt   # Python dependencies
├── views/
│   ├── control.html   # Control panel
│   └── progress.html  # Display screen
└── assets/
    └── winner-gifs/   # Background GIFs for winners
```

## 🛠️ Troubleshooting

### Windows Issues
- **Node.js not found**: Download from [nodejs.org](https://nodejs.org/)
- **Python not found**: Download from [python.org](https://www.python.org/)
  - ⚠️ **IMPORTANT**: Check "Add Python to PATH" during installation
- **Permission denied**: Run as Administrator

### macOS Issues
- **"Cannot be opened"**: Right-click → Open, or run:
  ```bash
  chmod +x START.command
  xattr -d com.apple.quarantine START.command
  ```
- **Python not found**: Install with Homebrew:
  ```bash
  brew install python3
  ```

### Common Issues
- **Port 3001 in use**: Close other applications or change port in `config.json`
- **Chat not loading**: Ensure the YouTube stream is live and public
- **No participants showing**: Check if chat is enabled on the stream

## 🎨 Customization

### Change Port
Edit `config.json`:
```json
{
  "port": 3001
}
```

### Add Winner GIFs
Place GIF files in `assets/winner-gifs/` folder

### Modify Rewards
Use the Control Panel to set custom reward amounts and intervals

## 📜 License

MIT License - BrandGrid Apps

## 🤝 Support

Telegram: [t.me/brandgridapps](https://t.me/brandgridapps)

---

Made with ❤️ by BrandGrid Apps