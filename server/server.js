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

// Colorful console logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function log(type, message) {
  const timestamp = new Date().toLocaleTimeString('tr-TR');
  switch(type) {
    case 'success':
      console.log(`${colors.green}✓ [${timestamp}] ${message}${colors.reset}`);
      break;
    case 'info':
      console.log(`${colors.blue}ℹ [${timestamp}] ${message}${colors.reset}`);
      break;
    case 'warning':
      console.log(`${colors.yellow}⚠ [${timestamp}] ${message}${colors.reset}`);
      break;
    case 'error':
      console.log(`${colors.red}✗ [${timestamp}] ${message}${colors.reset}`);
      break;
    case 'system':
      console.log(`${colors.magenta}⚙ [${timestamp}] ${message}${colors.reset}`);
      break;
    default:
      console.log(`[${timestamp}] ${message}`);
  }
}

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

    log('info', `Found ${gifFiles.length} winner GIFs`);
    res.json({ gifs: gifFiles });
  } catch (error) {
    log('error', `Error reading GIFs directory: ${error.message}`);
    res.json({ gifs: [] }); // Return empty array if error
  }
});

// Chat heartbeat endpoint for monitoring
app.post('/api/chat-heartbeat', (req, res) => {
  const { videoId, status, stats, participants_count } = req.body;

  // Store last heartbeat time
  state.lastChatHeartbeat = Date.now();

  // Log important events
  if (status === 'terminated') {
    log('warning', `Chat fetcher terminated for video ${videoId}`);
    if (stats) {
      log('info', `Final stats - Messages: ${stats.messages_processed || 0}, Participants: ${stats.participants_found || 0}, Errors: ${stats.errors || 0}, Reconnects: ${stats.reconnects || 0}`);
    }
  } else if (status === 'alive') {
    // Silent heartbeat, only log every 10th one to reduce noise
    if (!state.heartbeatCount) state.heartbeatCount = 0;
    state.heartbeatCount++;
    if (state.heartbeatCount % 10 === 0) {
      log('system', `Heartbeat #${state.heartbeatCount} - Participants: ${participants_count || 0}`);
    }
  }

  res.json({ success: true });
});

// API endpoint for Python chat fetcher
app.post('/api/chat-participants', (req, res) => {
  const { videoId, participants } = req.body;

  if (videoId === state.videoId && participants) {
    // Update participants with ID support
    let newParticipants = 0;
    participants.forEach(participant => {
      const id = participant.id || `${participant.name}_${Date.now()}`;
      if (!state.chatParticipants.find(p => p.id === id)) {
        state.chatParticipants.push(participant);
        newParticipants++;
      }
    });

    if (newParticipants > 0) {
      log('success', `+${newParticipants} new participants (Total: ${state.chatParticipants.length})`);
    }

    io.emit('participants-update', state.chatParticipants);
    res.json({ success: true, count: state.chatParticipants.length });
  } else {
    res.json({ success: false, message: 'Invalid video ID or no participants' });
  }
});

// State management
let state = {
  monitoring: false,
  videoId: null,
  currentLikes: 0,
  startLikes: 0,
  chatParticipants: [],
  progressTitle: 'CANLI YAYIN BAŞLADI',
  winnersList: [],
  stats: {
    streamStartTime: null
  },
  lastChatHeartbeat: null,
  heartbeatCount: 0,
  // New reward system structure
  rewardSystem: {
    active: false,
    mode: 'auto', // 'auto' or 'custom'
    autoConfig: {
      interval: 100,
      prize: '100 TL'
    },
    rewards: [], // All rewards (past, current, future)
    currentTarget: null,
    queue: [], // Rewards waiting to be processed
    lastProcessedTarget: 0
  }
};

async function fetchVideoStats(videoId) {
  if (!videoId) return null;

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const scriptContent = $('script:contains("likeCount")').html();

    if (scriptContent) {
      const likeMatch = scriptContent.match(/"likeCount":"(\d+)"/);
      const likes = likeMatch ? parseInt(likeMatch[1]) : null;
      if (likes !== null) {
        log('info', `Fetched likes: ${likes.toLocaleString('tr-TR')}`);
      }
      return { likes };
    }
  } catch (error) {
    log('error', `Failed to fetch video stats: ${error.message}`);
  }

  return null;
}

// Python chat fetcher process
let chatProcess = null;

function startChatFetcher() {
  if (chatProcess) {
    log('warning', 'Chat fetcher already running');
    return;
  }

  // Windows uses 'python', macOS/Linux use 'python3'
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  log('system', `Starting Python chat fetcher with command: ${pythonCommand}`);

  // Use robust version for better reliability
  const scriptPath = './python/chat_fetcher_robust.py';

  // Check if robust version exists, fallback to original if not
  const fsSync = require('fs');
  const finalScriptPath = fsSync.existsSync(scriptPath) ? scriptPath : './python/chat_fetcher.py';

  log('system', `Using chat fetcher: ${finalScriptPath}`);

  chatProcess = spawn(pythonCommand, [
    finalScriptPath,
    state.videoId,
    'http://localhost:3001'
  ]);

  chatProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message.includes('Connected to chat')) {
      log('success', message);
    } else if (message.includes('New participant') || message.includes('New:')) {
      log('info', message);
    } else if (message.includes('Error') || message.includes('Failed')) {
      log('error', message);
    } else if (message.includes('Reconnect')) {
      log('warning', message);
    } else if (message.includes('✓')) {
      log('success', message);
    } else {
      console.log(`[Chat] ${message}`);
    }
  });

  chatProcess.stderr.on('data', (data) => {
    log('error', `Chat fetcher error: ${data}`);
  });

  chatProcess.on('close', (code) => {
    log(code === 0 ? 'info' : 'warning', `Chat fetcher process exited with code ${code}`);
    chatProcess = null;
  });
}

// Update likes periodically
let updateInterval = null;

function startLikesUpdater() {
  if (updateInterval) return;

  log('system', 'Starting likes updater (5 second interval)');
  updateInterval = setInterval(async () => {
    if (state.monitoring && state.videoId) {
      const stats = await fetchVideoStats(state.videoId);
      if (stats && stats.likes) {
        const previousLikes = state.currentLikes;
        state.currentLikes = stats.likes;

        if (previousLikes !== state.currentLikes) {
          log('info', `Likes updated: ${previousLikes.toLocaleString('tr-TR')} → ${state.currentLikes.toLocaleString('tr-TR')} (Δ +${(state.currentLikes - previousLikes).toLocaleString('tr-TR')})`);

          io.emit('likes-update', state.currentLikes);
          checkRewards();
        }
      }
    }
  }, 5000);
}

function stopLikesUpdater() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    log('system', 'Likes updater stopped');
  }
}

// Reward system functions
function getNextTarget() {
  // If reward system is not active, return null
  if (!state.rewardSystem.active) {
    return null;
  }

  if (state.rewardSystem.mode === 'auto' && state.rewardSystem.autoConfig.interval) {
    // Always calculate from 0 with intervals
    const interval = state.rewardSystem.autoConfig.interval;
    const currentLikes = state.currentLikes || 0;

    // Calculate how many intervals have passed
    const passedIntervals = Math.floor(currentLikes / interval);

    // Next target is the next interval
    const nextTarget = (passedIntervals + 1) * interval;
    state.rewardSystem.currentTarget = nextTarget;

    return nextTarget;
  } else if (state.rewardSystem.mode === 'custom') {
    // Find next pending reward
    const pendingReward = state.rewardSystem.rewards.find(r => !r.achieved && !r.skipped);
    const target = pendingReward ? pendingReward.targetLikes : null;
    state.rewardSystem.currentTarget = target;
    return target;
  }

  // Default case - no target
  state.rewardSystem.currentTarget = null;
  return null;
}

function getProgressPercentage() {
  // If reward system is not active, return 0
  if (!state.rewardSystem.active) {
    return 0;
  }

  const nextTarget = getNextTarget();
  if (!nextTarget) return 100;

  if (state.rewardSystem.mode === 'auto' && state.rewardSystem.autoConfig.interval) {
    // For auto mode, calculate progress within the current interval
    const interval = state.rewardSystem.autoConfig.interval;
    const currentLikes = state.currentLikes || 0;

    // Find the previous interval point
    const passedIntervals = Math.floor(currentLikes / interval);
    const previousTarget = passedIntervals * interval;

    // Calculate progress from previous to next target
    const progressInInterval = currentLikes - previousTarget;
    const percentage = (progressInInterval / interval) * 100;

    return Math.min(percentage, 100);
  } else {
    // For custom mode, calculate from start likes to target
    const progress = state.currentLikes - state.startLikes;
    const target = nextTarget - state.startLikes;
    return Math.min((progress / target) * 100, 100);
  }
}

function checkRewards() {
  if (!state.rewardSystem.active) {
    return;
  }

  const currentLikes = state.currentLikes || 0;
  const mode = state.rewardSystem.mode;

  if (mode === 'auto') {
    const interval = state.rewardSystem.autoConfig.interval;
    if (!interval) return;

    // IMPORTANT: Skip all past rewards when starting
    // Only process NEW targets that are reached AFTER monitoring started
    const startLikes = state.startLikes || 0;

    // Find the starting point - first target AFTER startLikes
    const startingTarget = Math.floor(startLikes / interval) * interval + interval;

    // Calculate current target range
    const currentInterval = Math.floor(currentLikes / interval) * interval;

    // Only check targets from starting point to current
    for (let target = startingTarget; target <= currentLikes; target += interval) {
      // Check if this target already exists
      const existingReward = state.rewardSystem.rewards.find(r => r.targetLikes === target);

      if (!existingReward) {
        // New target reached - create reward
        const order = target / interval;
        const newReward = {
          targetLikes: target,
          prize: state.rewardSystem.autoConfig.prize,
          achieved: false,
          skipped: false,
          winner: null,
          order: order
        };

        state.rewardSystem.rewards.push(newReward);

        // Add to queue for processing
        state.rewardSystem.queue.push(newReward);
        log('success', `🎯 NEW Target ${target} reached! (Started at ${startLikes}, Current: ${currentLikes})`);

      } else if (!existingReward.achieved && !existingReward.skipped) {
        // Existing unprocessed reward - add to queue once
        if (!state.rewardSystem.queue.find(r => r.targetLikes === target)) {
          state.rewardSystem.queue.push(existingReward);
          log('info', `Processing pending target: ${target}`);
        }
      }
    }

    // Don't update lastProcessedTarget here - it should be updated in processRewardQueue
    // when rewards are actually achieved or skipped

  } else if (mode === 'custom') {
    // Check custom rewards
    state.rewardSystem.rewards.forEach(reward => {
      if (!reward.achieved && !reward.skipped && currentLikes >= reward.targetLikes) {
        // Add to queue if not already there
        if (!state.rewardSystem.queue.find(r => r.targetLikes === reward.targetLikes)) {
          state.rewardSystem.queue.push(reward);
          log('success', `Custom target reached: ${reward.targetLikes.toLocaleString('tr-TR')} likes`);
        }
      }
    });
  }

  // Process queue
  processRewardQueue();
}

// Process reward queue - handles rewards one by one
function processRewardQueue() {
  if (state.rewardSystem.queue.length === 0) return;

  // Process all rewards in queue
  while (state.rewardSystem.queue.length > 0) {
    const reward = state.rewardSystem.queue.shift();

    // Mark as achieved immediately to prevent re-processing
    reward.achieved = true;

    if (state.chatParticipants.length > 0) {
      // Select random winner
      const winner = state.chatParticipants[Math.floor(Math.random() * state.chatParticipants.length)];
      reward.winner = winner.name;
      reward.winnerId = winner.id;

      state.winnersList.push({
        name: winner.name,
        prize: reward.prize,
        id: winner.id,
        targetLikes: reward.targetLikes,
        order: reward.order,
        timestamp: new Date().toISOString()
      });

      log('success', `🏆 WINNER: ${winner.name} won "${reward.prize}" at ${reward.targetLikes} likes!`);

      // Emit winner event
      io.emit('reward-achieved', reward);
      io.emit('winners-update', state.winnersList);

    } else {
      // No participants - mark as skipped
      reward.skipped = true;
      reward.skipReason = 'No participants';
      log('warning', `⚠️ Reward skipped at ${reward.targetLikes} likes - No participants`);
    }
  }

  // Check if all rewards completed (for custom mode)
  if (state.rewardSystem.mode === 'custom') {
    const hasMoreRewards = state.rewardSystem.rewards.some(r => !r.achieved && !r.skipped);
    if (!hasMoreRewards) {
      log('info', '🎉 All custom rewards completed!');
      io.emit('all-rewards-completed');
    }
  }

  // Update progress
  io.emit('progress-update', {
    percentage: getProgressPercentage(),
    nextTarget: getNextTarget(),
    currentLikes: state.currentLikes,
    startLikes: state.startLikes
  });
}

// Legacy function - kept for compatibility but simplified
function selectRandomWinner(reward) {
  // Add to queue and process
  if (!state.rewardSystem.queue.find(r => r.targetLikes === reward.targetLikes)) {
    state.rewardSystem.queue.push(reward);
  }
  processRewardQueue();
}

// Socket.io connections
io.on('connection', (socket) => {
  log('info', `New client connected: ${socket.id}`);

  // Send state with calculated values
  socket.emit('state-update', {
    ...state,
    rewardSystemActive: state.rewardSystem.active,
    rewardMode: state.rewardSystem.mode,
    rewards: state.rewardSystem.rewards,
    autoMode: state.rewardSystem.autoConfig,
    nextTarget: getNextTarget(),
    progress: getProgressPercentage()
  });

  socket.on('start-monitoring', async (data) => {
    // Check if data is provided
    if (!data) {
      log('error', 'No data provided to start-monitoring');
      socket.emit('error', 'Data parametresi eksik');
      return;
    }

    const { videoId } = data;

    if (!videoId) {
      log('error', 'Video ID missing in start-monitoring request');
      socket.emit('error', 'Video ID gerekli');
      return;
    }

    log('system', `Starting monitoring for video: ${videoId}`);

    const stats = await fetchVideoStats(videoId);

    if (stats && stats.likes !== null) {
      state.startLikes = stats.likes;
      state.currentLikes = stats.likes;
      state.monitoring = true;
      state.videoId = videoId;
      state.chatParticipants = [];
      state.stats = {
        ...state.stats,
        streamStartTime: Date.now()
      };

      log('success', `Monitoring started - Initial likes: ${stats.likes.toLocaleString('tr-TR')}`);

      startLikesUpdater();

      // Start Python chat fetcher
      log('system', 'Starting chat fetcher...');
      startChatFetcher();

      io.emit('monitoring-started', {
        videoId,
        startLikes: state.startLikes
      });

      // Send full state update to all clients
      io.emit('state-update', {
        ...state,
        rewardSystemActive: state.rewardSystem.active,
        rewardMode: state.rewardSystem.mode,
        rewards: state.rewardSystem.rewards,
        autoMode: state.rewardSystem.autoConfig,
        nextTarget: getNextTarget(),
        progress: getProgressPercentage()
      });

      socket.emit('monitoring-status', {
        success: true,
        likes: stats.likes
      });
    } else {
      log('error', `Failed to fetch stats for video: ${videoId}`);
      socket.emit('monitoring-status', {
        success: false,
        message: 'Video istatistikleri alınamadı'
      });
    }
  });

  socket.on('stop-monitoring', () => {
    log('warning', 'Stopping monitoring...');
    state.monitoring = false;
    stopLikesUpdater();

    // Stop chat fetcher
    if (chatProcess) {
      log('system', 'Stopping chat fetcher process...');
      chatProcess.kill();
      chatProcess = null;
    }

    io.emit('monitoring-stopped');
    log('info', 'Monitoring stopped');
  });

  socket.on('get-progress', () => {
    const nextTarget = getNextTarget();
    const percentage = getProgressPercentage();

    log('system', `get-progress: mode=${state.rewardSystem.mode}, active=${state.rewardSystem.active}, interval=${state.rewardSystem.autoConfig.interval}, nextTarget=${nextTarget}, percentage=${percentage}`);

    socket.emit('progress-update', {
      percentage: percentage,
      nextTarget: nextTarget,
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('set-reward-mode', (mode) => {
    state.rewardSystem.mode = mode;
    log('system', `Reward mode changed to: ${mode}`);

    // Clear rewards when switching modes
    if (state.rewardSystem.active) {
      state.rewardSystem.rewards = [];
      state.rewardSystem.queue = [];
      state.rewardSystem.lastProcessedTarget = 0;
    }

    io.emit('reward-mode-changed', mode);
    io.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('set-auto-config', (config) => {
    const configChanged = state.rewardSystem.autoConfig.interval !== config.interval ||
                         state.rewardSystem.autoConfig.prize !== config.prize;

    state.rewardSystem.autoConfig.interval = config.interval;
    state.rewardSystem.autoConfig.prize = config.prize;

    log('system', `Auto config updated - Interval: ${config.interval}, Prize: ${config.prize}`);

    if (configChanged && state.rewardSystem.active && state.rewardSystem.mode === 'auto') {
      // Reset rewards when config changes during active auto mode
      state.rewardSystem.rewards = [];
      state.rewardSystem.queue = [];
      state.rewardSystem.lastProcessedTarget = 0;
      checkRewards();
    }

    io.emit('auto-config-updated', config);
    io.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('add-reward', (reward) => {
    // Add reward to custom rewards
    state.rewardSystem.rewards.push({
      ...reward,
      achieved: false,
      skipped: false,
      winner: null,
      order: state.rewardSystem.rewards.length + 1
    });
    state.rewardSystem.rewards.sort((a, b) => (a.targetLikes || 0) - (b.targetLikes || 0));

    log('system', `Reward added - ${reward.targetLikes} likes for ${reward.prize}`);
    io.emit('rewards-update', state.rewardSystem.rewards);

    // Check if this reward should be triggered immediately
    if (state.rewardSystem.active && state.rewardSystem.mode === 'custom') {
      checkRewards();
    }

    // Send progress update
    io.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('remove-reward', (index) => {
    if (state.rewardSystem.rewards[index]) {
      const removed = state.rewardSystem.rewards.splice(index, 1)[0];
      log('system', `Reward removed - ${removed.targetLikes} likes`);
      io.emit('rewards-update', state.rewardSystem.rewards);

      // Send progress update
      io.emit('progress-update', {
        percentage: getProgressPercentage(),
        nextTarget: getNextTarget(),
        currentLikes: state.currentLikes,
        startLikes: state.startLikes
      });
    }
  });

  socket.on('set-rewards', (rewards) => {
    state.rewardSystem.rewards = rewards.map((r, i) => ({
      ...r,
      achieved: false,
      skipped: false,
      winner: null,
      order: i + 1
    }));
    log('system', `Rewards updated - ${rewards.length} rewards configured`);
    io.emit('rewards-update', state.rewardSystem.rewards);
  });

  socket.on('toggle-reward-system', (status) => {
    state.rewardSystem.active = status;
    log(status ? 'success' : 'warning', `Reward system ${status ? 'activated' : 'deactivated'}`);

    if (status) {
      // Activating reward system
      if (state.rewardSystem.mode === 'auto') {
        // Clear old rewards for fresh start in auto mode
        state.rewardSystem.rewards = [];
        state.rewardSystem.queue = [];
        state.rewardSystem.lastProcessedTarget = 0;
        log('system', 'Auto mode activated - starting fresh');
      }
      // Check for any immediate rewards
      checkRewards();
    } else {
      // Deactivating reward system
      state.rewardSystem.queue = [];
      log('system', 'Reward system deactivated - queue cleared');
    }

    io.emit('reward-system-status', status);

    // Send progress update
    io.emit('progress-update', {
      percentage: getProgressPercentage(),
      nextTarget: getNextTarget(),
      currentLikes: state.currentLikes,
      startLikes: state.startLikes
    });
  });

  socket.on('set-progress-title', (title) => {
    state.progressTitle = title;
    log('info', `Progress title changed to: ${title}`);
    io.emit('progress-title-changed', title);
  });

  socket.on('clear-winners', () => {
    state.winnersList = [];
    log('warning', 'Winners list cleared');
    io.emit('winners-update', state.winnersList);
  });

  socket.on('disconnect', () => {
    log('info', `Client disconnected: ${socket.id}`);
  });
});

// Serve static files
app.use(express.static('public'));
app.use('/views', express.static('views'));
app.use('/assets', express.static('assets'));

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('');
  console.log(`${colors.bright}${colors.green}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.green}║   YouTube Live Awards System Started!      ║${colors.reset}`);
  console.log(`${colors.bright}${colors.green}║   Server: http://localhost:${PORT}            ║${colors.reset}`);
  console.log(`${colors.bright}${colors.green}╚════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  log('success', 'All systems operational');
  log('info', 'Waiting for connections...');
  console.log('');
});