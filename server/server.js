const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Get winner GIFs from directory
app.get('/api/winner-gifs', async (req, res) => {
  try {
    const gifsDir = path.join(__dirname, '../assets/winner-gifs');
    const files = await fs.readdir(gifsDir);

    // Filter only GIF files
    const gifFiles = files.filter(file =>
      file.toLowerCase().endsWith('.gif') &&
      !file.startsWith('.') // Ignore hidden files
    );

    res.json({ gifs: gifFiles });
  } catch (error) {
    console.error('Error reading GIFs directory:', error);
    res.json({ gifs: [] }); // Return empty array if error
  }
});

// API endpoint for Python chat fetcher
app.post('/api/chat-participants', (req, res) => {
  const { videoId, participants } = req.body;

  if (videoId === state.videoId && participants) {
    // Update participants with ID support
    participants.forEach(participant => {
      if (typeof participant === 'string') {
        // Eski format - sadece isim (geriye uyumluluk için)
        console.log(`WARNING: Old format participant (string only): ${participant}`);
        state.chatParticipants.set(participant, { name: participant, id: participant });
      } else if (participant.id) {
        // Yeni format - ID ile birlikte
        console.log(`Adding participant: ${participant.name} with ID: ${participant.id}`);

        // ID ve isim aynı mı kontrol et
        if (participant.id === participant.name) {
          console.error(`ERROR: Participant ID is same as name for ${participant.name}!`);
        }

        state.chatParticipants.set(participant.id, {
          name: participant.name,
          id: participant.id,
          url: participant.url || ''
        });
      } else {
        console.error(`ERROR: Participant has no ID:`, participant);
      }
    });

    // Send participants as array with ID info
    const participantsList = Array.from(state.chatParticipants.values());
    io.emit('participants-update', participantsList);

    res.json({ success: true, count: state.chatParticipants.size });
  } else {
    res.status(400).json({ success: false, error: 'Invalid data' });
  }
});

// State
let state = {
  videoId: null,
  monitoring: false,
  startLikes: 0,
  currentLikes: 0,
  rewards: [],
  chatParticipants: new Map(), // Map: channel_id -> {name, id, url}
  winners: new Map(), // Map: channel_id -> winner info
  rewardSystemActive: false, // Ödül sistemi aktif mi?
  rewardMode: 'auto', // 'targets' or 'auto' - default auto
  autoMode: {
    active: true,
    interval: 100,
    prize: '100 TL',
    rewards: []
  },
  stats: {
    totalViews: 0,
    liveViewers: 0,
    chatSpeed: 0,
    streamDuration: 0,
    streamStartTime: null
  },
  progressTitle: 'CANLI YAYIN BAŞLADI',
  winnersList: [] // Kazananlar listesi
};

// YouTube API functions
async function fetchLikes(videoId) {
  try {
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const scriptData = $('script').text();

    // Beğeni sayısını bul
    const likesMatch = scriptData.match(/"likeCount":"(\d+)"/);
    if (likesMatch) {
      return parseInt(likesMatch[1]);
    }

    // Alternatif pattern
    const altMatch = scriptData.match(/\"label\":\"([\d,]+) likes?\"/);
    if (altMatch) {
      return parseInt(altMatch[1].replace(/,/g, ''));
    }

    return null;
  } catch (error) {
    console.error('Beğeni çekme hatası:', error.message);
    return null;
  }
}

async function fetchChatParticipants(videoId) {
  // YouTube Live Chat API entegrasyonu gerekli
  // Gerçek chat verisi için API key ve implementation gerekiyor
  return Array.from(state.chatParticipants);
}

// Monitoring loop
let monitoringInterval;
let chatProcess = null;

function startMonitoring() {
  if (monitoringInterval) return;

  // Start Python chat fetcher for live streams
  if (state.videoId && !chatProcess) {
    // Windows uses 'python', macOS/Linux use 'python3'
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    console.log(`Starting Python chat fetcher with command: ${pythonCommand}`);

    chatProcess = spawn(pythonCommand, [
      './python/chat_fetcher.py',
      state.videoId,
      'http://localhost:3001'
    ]);

    chatProcess.stdout.on('data', (data) => {
      console.log(`Chat fetcher: ${data}`);
    });

    chatProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      console.error(`Chat fetcher error: ${errorMsg}`);

      // Check for common Windows Python errors
      if (errorMsg.includes('ModuleNotFoundError') || errorMsg.includes('No module named')) {
        console.error('\n⚠️  PYTHON PACKAGE MISSING!');
        console.error('Please run WINDOWS-SETUP.bat to install Python dependencies');
        console.error('Or manually run: pip install pytchat requests\n');
      }
      if (errorMsg.includes('python') && errorMsg.includes('not found')) {
        console.error('\n⚠️  PYTHON NOT FOUND!');
        console.error('Please install Python from: https://www.python.org/downloads/');
        console.error('IMPORTANT: Check "Add Python to PATH" during installation\n');
      }
    });

    chatProcess.on('error', (error) => {
      console.error('Failed to start Python chat fetcher:', error.message);
      if (error.code === 'ENOENT') {
        console.error('\n⚠️  Python command not found!');
        if (process.platform === 'win32') {
          console.error('On Windows, make sure Python is installed and added to PATH');
          console.error('Run WINDOWS-SETUP.bat to check Python installation');
        }
      }
    });

    chatProcess.on('close', (code) => {
      console.log(`Chat fetcher exited with code ${code}`);
      if (code !== 0) {
        console.error('Chat fetcher failed. Check Python installation and dependencies.');
      }
      chatProcess = null;
    });
  }

  monitoringInterval = setInterval(async () => {
    if (!state.monitoring || !state.videoId) return;

    // Beğeni sayısını güncelle
    const likes = await fetchLikes(state.videoId);
    if (likes !== null && likes !== state.currentLikes) {
      state.currentLikes = likes;
      io.emit('likes-update', likes);
      checkRewards();
    }

  }, 5000); // 5 saniyede bir kontrol
}

function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  // Stop Python chat fetcher
  if (chatProcess) {
    chatProcess.kill();
    chatProcess = null;
  }
}

function checkRewards() {
  // Ödül sistemi aktif değilse kontrol etme
  if (!state.rewardSystemActive) return;

  // Hedefler modu - direkt target değerini kontrol et
  if (state.rewardMode === 'targets') {
    let allAchieved = true;
    state.rewards.forEach(reward => {
      if (!reward.achieved && state.currentLikes >= reward.target) {
        achieveReward(reward);
      }
      if (!reward.achieved) {
        allAchieved = false;
      }
    });

    // Tüm ödüller dağıtıldıysa bildiri gönder
    if (allAchieved && state.rewards.length > 0) {
      io.emit('all-rewards-completed');
    }
  }

  // Otomatik mod - her interval'de ödül
  if (state.rewardMode === 'auto' && state.autoMode.active) {
    const interval = state.autoMode.interval;

    // Başlangıç noktası
    const startPoint = Math.floor(state.startLikes / interval) * interval;

    // Şu anki noktadan geriye doğru kontrol et
    const currentPoint = Math.floor(state.currentLikes / interval) * interval;

    // Her interval noktası için kontrol yap
    for (let target = startPoint + interval; target <= currentPoint; target += interval) {
      // Bu hedef için ödül var mı kontrol et
      let targetReward = state.autoMode.rewards.find(r => r.target === target);

      if (!targetReward) {
        // Yoksa oluştur
        targetReward = {
          target: target,
          prize: state.autoMode.prize,
          achieved: false,
          winner: null,
          isAuto: true
        };
        state.autoMode.rewards.push(targetReward);
      }

      // Henüz verilmediyse ve hedefe ulaştıysak ver
      if (!targetReward.achieved && state.currentLikes >= target) {
        achieveReward(targetReward);
        console.log(`Auto reward achieved at ${target} likes`);
      }
    }

    io.emit('auto-rewards-update', state.autoMode.rewards);
  }
}

function achieveReward(reward) {
  reward.achieved = true;
  reward.achievedAt = new Date();

  // Kazanan seç - ID tabanlı
  const eligibleParticipants = Array.from(state.chatParticipants.values())
    .filter(p => !state.winners.has(p.id));

  if (eligibleParticipants.length > 0) {
    const winnerData = eligibleParticipants[Math.floor(Math.random() * eligibleParticipants.length)];
    console.log('Selected winner:', JSON.stringify(winnerData, null, 2));
    console.log('Winner ID:', winnerData.id);
    console.log('Winner Name:', winnerData.name);
    reward.winner = winnerData.name;
    reward.winnerId = winnerData.id;
    state.winners.set(winnerData.id, winnerData);

    // Kazananlar listesine ekle
    state.winnersList.push({
      name: winnerData.name,
      id: winnerData.id,
      prize: reward.prize,
      time: new Date()
    });

    io.emit('reward-achieved', reward);
    io.emit('winners-update', state.winnersList);
  }
}

function getNextTarget() {
  // Ödül sistemi kapalıysa hesaplama yapma
  if (!state.rewardSystemActive) return null;

  // Auto mode - bir sonraki yüzlük hedefe yuvarla
  if (state.rewardMode === 'auto' && state.autoMode.active) {
    const interval = state.autoMode.interval;

    // En son verilen ödülün hedefini bul
    let lastAchievedTarget = 0;
    if (state.autoMode.rewards) {
      state.autoMode.rewards.forEach(reward => {
        if (reward.achieved && reward.target > lastAchievedTarget) {
          lastAchievedTarget = reward.target;
        }
      });
    }

    // Sonraki hedef, ya son ödülden sonraki interval ya da mevcut pozisyondan sonraki interval
    const nextFromLast = lastAchievedTarget + interval;
    const nextFromCurrent = Math.ceil(state.currentLikes / interval) * interval;

    // İkisinden büyük olanı al (ödül verilmemiş en yakın hedef)
    return Math.max(nextFromLast, nextFromCurrent);
  }

  // Targets mode - direkt hedef değerini döndür
  const pending = state.rewards.find(r => !r.achieved);
  return pending ? pending.target : null;
}

function getProgressPercentage() {
  const nextTarget = getNextTarget();
  if (!nextTarget) return 100;

  // Eğer hedefe ulaştıysak 100 döndür
  if (state.currentLikes >= nextTarget) return 100;

  // Auto mode - mevcut interval içindeki ilerleme
  if (state.rewardMode === 'auto' && state.autoMode.active) {
    const interval = state.autoMode.interval;

    // Önceki hedefi bul (son verilen ödül veya interval'in katı)
    let prevTarget = 0;
    if (state.autoMode.rewards) {
      state.autoMode.rewards.forEach(reward => {
        if (reward.achieved && reward.target > prevTarget && reward.target < nextTarget) {
          prevTarget = reward.target;
        }
      });
    }

    // Eğer ödül yoksa, mevcut pozisyondan önceki interval'i al
    if (prevTarget === 0) {
      prevTarget = Math.floor(state.currentLikes / interval) * interval;
    }

    // İlerleme hesapla
    const totalDistance = nextTarget - prevTarget;
    const currentDistance = state.currentLikes - prevTarget;
    const progress = (currentDistance / totalDistance) * 100;

    return Math.min(Math.max(progress, 0), 99.99); // 100'e ulaşmadan önce maksimum 99.99
  }

  // Targets mode - en son achieved'dan bu hedefe kadar olan ilerleme
  let prevTarget = 0;
  for (const reward of state.rewards) {
    if (reward.achieved) {
      prevTarget = reward.target;
    } else {
      break;
    }
  }

  const totalDistance = nextTarget - prevTarget;
  const currentDistance = state.currentLikes - prevTarget;

  if (totalDistance <= 0) return 100;
  const progress = (currentDistance / totalDistance) * 100;
  // Hedefe ulaşmadan önce maksimum 99.99 göster
  return state.currentLikes >= nextTarget ? 100 : Math.min(Math.max(progress, 0), 99.99);
}

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send initial state - TÜM state bilgilerini gönder
  socket.emit('state-update', {
    ...state,
    chatParticipants: Array.from(state.chatParticipants.values()),
    winners: Array.from(state.winners.values()),
    progress: getProgressPercentage(),
    nextTarget: getNextTarget(),
    startLikes: state.startLikes,
    currentLikes: state.currentLikes,
    progressTitle: state.progressTitle,
    rewardSystemActive: state.rewardSystemActive,
    winnersList: state.winnersList,
    monitoring: state.monitoring,
    videoId: state.videoId,
    rewardMode: state.rewardMode,
    autoMode: state.autoMode
  });

  // get-progress event'i - control panel refresh için
  socket.on('get-progress', () => {
    console.log('get-progress received, sending state with rewardSystemActive:', state.rewardSystemActive);

    // Tüm state'i geri gönder
    const stateToSend = {
      ...state,
      chatParticipants: Array.from(state.chatParticipants.values()),
      winners: Array.from(state.winners.values()),
      progress: getProgressPercentage(),
      nextTarget: getNextTarget(),
      startLikes: state.startLikes,
      currentLikes: state.currentLikes,
      progressTitle: state.progressTitle,
      rewardSystemActive: state.rewardSystemActive,
      winnersList: state.winnersList,
      monitoring: state.monitoring,
      videoId: state.videoId,
      rewardMode: state.rewardMode,
      autoMode: state.autoMode,
      stats: state.stats,
      autoRewards: state.autoMode.rewards
    };

    console.log('Sending full state:', stateToSend);
    socket.emit('state-update', stateToSend);

    // Eğer auto mode aktifse, auto rewards'ı da gönder
    if (state.rewardMode === 'auto' && state.autoMode.rewards) {
      socket.emit('auto-rewards-update', state.autoMode.rewards);
    }

    // Participants update
    socket.emit('participants-update', Array.from(state.chatParticipants.values()));

    // Likes update
    socket.emit('likes-update', state.currentLikes);

    // Monitoring status
    if (state.monitoring) {
      socket.emit('monitoring-started', {
        videoId: state.videoId,
        startLikes: state.startLikes
      });
    } else {
      socket.emit('monitoring-stopped');
    }

    console.log('State sent to client after get-progress request');
  });

  socket.on('set-video', (videoId) => {
    state.videoId = videoId;
    io.emit('video-changed', videoId);
  });

  socket.on('set-progress-title', (title) => {
    state.progressTitle = title;
    io.emit('progress-title-changed', title);
  });

  socket.on('add-reward', (reward) => {
    state.rewards.push({
      ...reward,
      achieved: false,
      winner: null
    });
    state.rewards.sort((a, b) => a.target - b.target);
    io.emit('rewards-update', state.rewards);
    // Send progress update
    io.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('remove-reward', (index) => {
    state.rewards.splice(index, 1);
    io.emit('rewards-update', state.rewards);
  });

  socket.on('clear-rewards', () => {
    state.rewards = [];
    state.winners.clear();
    io.emit('rewards-update', state.rewards);
  });

  socket.on('start-monitoring', async () => {
    if (!state.videoId) {
      socket.emit('error', 'Lütfen önce video ID girin');
      return;
    }

    // Get initial likes count
    const initialLikes = await fetchLikes(state.videoId);
    if (initialLikes !== null) {
      state.startLikes = initialLikes;
      state.currentLikes = initialLikes;
    }

    state.monitoring = true;
    state.stats.streamStartTime = Date.now();
    startMonitoring();
    io.emit('monitoring-status', true);
    io.emit('start-likes', state.startLikes);

    // Emit monitoring-started event for button state update
    io.emit('monitoring-started', {
      videoId: state.videoId,
      startLikes: state.startLikes
    });
  });

  socket.on('stop-monitoring', () => {
    state.monitoring = false;
    state.stats.streamStartTime = null;
    stopMonitoring();
    io.emit('monitoring-status', false);

    // Emit monitoring-stopped event for button state update
    io.emit('monitoring-stopped');
  });

  socket.on('get-progress', () => {
    socket.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('set-reward-mode', (mode) => {
    state.rewardMode = mode;
    io.emit('reward-mode-changed', mode);
    // Recalculate and send progress update
    io.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('set-auto-config', (config) => {
    // Sadece config değiştiyse güncelle
    const configChanged = state.autoMode.interval !== config.interval ||
                         state.autoMode.prize !== config.prize;

    state.autoMode.interval = config.interval;
    state.autoMode.prize = config.prize;

    // Eğer interval değiştiyse, sadece yeni ödülleri hesapla (eskileri silme!)
    if (configChanged && state.autoMode.interval) {
      // Mevcut ödülleri koru, sadece yenileri ekle
      checkRewards();
    }

    io.emit('auto-config-updated', config);
    // Send progress update
    io.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('activate-auto-mode', () => {
    state.rewardMode = 'auto';
    state.autoMode.active = true;
    state.autoMode.rewards = [];

    checkRewards();
    io.emit('auto-mode-activated');
    // Send progress update
    io.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('deactivate-auto-mode', () => {
    state.autoMode.active = false;
    io.emit('auto-mode-deactivated');
  });

  socket.on('clear-auto-rewards', () => {
    state.autoMode.rewards = [];
    io.emit('auto-rewards-cleared');
  });

  socket.on('toggle-reward-system', () => {
    state.rewardSystemActive = !state.rewardSystemActive;

    if (state.rewardSystemActive) {
      // Ödül sistemi açıldığında
      if (state.rewardMode === 'auto') {
        state.autoMode.rewards = []; // Auto rewards'ı sıfırla
      }
      checkRewards(); // Hemen kontrol et
    }

    io.emit('reward-system-status', state.rewardSystemActive);
  });

  socket.on('reset-winners', () => {
    state.winners.clear();
    state.winnersList = [];
    io.emit('winners-update', state.winnersList);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});