import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GameState, Player, Card, CardRank, CardSuit, GameConfig, MatchHistory, UserProfile, CallBreakGame, CallBreakPlayer, UnoGame, UnoPlayer, UnoCard, UnoColor, UnoValue, RoundScore } from "./src/types";

// Helper: Update user profiles at end of game
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, Firestore as ClientFirestore, doc as clientDoc, setDoc as clientSetDoc, getDoc as clientGetDoc, deleteDoc as clientDeleteDoc, collection as clientCollection, getDocs as clientGetDocs, writeBatch as clientWriteBatch } from "firebase/firestore";
import { getAuth as getClientAuth, signInAnonymously } from "firebase/auth";
import admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import fs from "fs";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const logs: string[] = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function captureLog(level: string, ...args: any[]) {
  const msg = `[${new Date().toISOString()}] [${level}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
  logs.push(msg);
  if (logs.length > 500) logs.shift();
}

console.log = (...args) => {
  captureLog('INFO', ...args);
  originalConsoleLog(...args);
};

console.error = (...args) => {
  captureLog('ERROR', ...args);
  originalConsoleError(...args);
};

console.warn = (...args) => {
  captureLog('WARN', ...args);
  originalConsoleWarn(...args);
};

const configPath = path.join(__dirname, 'firebase-applet-config.json');
let db: admin.firestore.Firestore | null = null;

if (fs.existsSync(configPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Initialize Admin SDK for server-side operations (bypasses rules)
    let adminApp;
    try {
      if (!admin.apps.length) {
        // Try initializing with default credentials first (more reliable in this environment)
        try {
          adminApp = admin.initializeApp();
          console.log(`[FIREBASE] Admin SDK initialized (Default). Project: ${adminApp.options.projectId}`);
        } catch (e) {
          console.warn("[FIREBASE] Default Admin SDK initialization failed, trying config...");
          adminApp = admin.initializeApp({
            projectId: firebaseConfig.projectId
          });
          console.log(`[FIREBASE] Admin SDK initialized (Config). Project: ${adminApp.options.projectId}`);
        }
      } else {
        adminApp = admin.app();
      }
      
      // Use the database ID from config if provided, otherwise use default
      const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
      console.log(`[FIREBASE] Using Firestore database: ${databaseId}`);
      
      if (databaseId !== '(default)') {
        db = getAdminFirestore(adminApp, databaseId);
      } else {
        db = getAdminFirestore(adminApp);
      }
      console.log("[FIREBASE] Admin Firestore instance created.");
    } catch (adminInitErr) {
      console.error("[FIREBASE] Admin SDK initialization failed:", adminInitErr);
    }

    // Ping test
    if (db) {
      db.collection('_system').doc('ping').set({ lastPing: Date.now(), env: process.env.NODE_ENV || 'development' })
        .then(() => console.log("[FIREBASE] Admin Ping test successful."))
        .catch(err => {
          console.error("[FIREBASE] Admin Ping test failed (disabling Admin SDK):", err);
          db = null; // Disable Admin SDK if it's not working correctly
        });
    }

    // Initialize Client SDK for Firestore operations (uses API key)
    const clientApp = initializeClientApp(firebaseConfig);
    const clientAuth = getClientAuth(clientApp);
    const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
    
    // We'll use the client DB for our operations
    (global as any).clientDb = clientDb;

    signInAnonymously(clientAuth).then((user) => {
      console.log(`[FIREBASE] Client SDK initialized (UID: ${user.user.uid})`);
      
      // Ping test using Client SDK
      clientSetDoc(clientDoc(clientDb, 'test', 'connection'), { lastPing: Date.now(), env: process.env.NODE_ENV || 'development' })
        .then(() => {
          console.log("[FIREBASE] Client connection test successful.");
          // If Admin SDK failed or is not initialized, use Client SDK as primary
          if (!db) {
            console.log("[FIREBASE] Using Client SDK as primary database instance.");
          }
        })
        .catch(err => console.error("[FIREBASE] Client connection test failed:", err));
    }).catch(error => {
      console.error("[FIREBASE] Client auth failed:", error);
    });
  } catch (error) {
    console.error("[FIREBASE] Initialization error:", error);
  }
}

// Helper: Update user profiles at end of game (Server handles actual DB update for reliability)
async function finalizeUserProfiles(game: any, gameType: 'leastcount' | 'callbreak' | 'uno') {
  console.log(`[PROFILE] Finalizing ${gameType} game ${game.roomId} for ${game.players.length} players. Winner: ${game.winnerId}`);
  
  const matchId = `match-${Date.now()}-${game.roomId}`;
  
  // Normalize round scores based on game type
  let roundScores: RoundScore[] = [];
  if (gameType === 'leastcount') {
    roundScores = game.roundScores || [];
  } else if (gameType === 'callbreak') {
    const maxRounds = Math.max(...game.players.map((p: any) => p.roundScores?.length || 0));
    for (let r = 0; r < maxRounds; r++) {
      const scores: Record<string, number> = {};
      game.players.forEach((p: any) => {
        scores[p.uid] = p.roundScores?.[r] || 0;
      });
      roundScores.push({ round: r + 1, scores });
    }
  } else if (gameType === 'uno') {
    const scores: Record<string, number> = {};
    game.players.forEach((p: any) => {
      scores[p.uid] = p.hand?.length || 0;
    });
    roundScores.push({ round: 1, scores });
  }

  const matchHistory: MatchHistory = {
    id: matchId,
    roomId: game.roomId,
    gameType,
    participants: game.players.map((p: any) => ({
      uid: p.uid,
      displayName: p.displayName || 'Guest',
      photoURL: p.photoURL || '',
      score: p.totalScore || p.score || 0
    })),
    winnerId: game.winnerId || 'unknown',
    endedAt: Date.now(),
    roundScores
  };

  // 1. Save match to global collection
  let matchSaved = false;
  try {
    if (db) {
      try {
        await db.collection('matches').doc(matchId).set(matchHistory);
        console.log(`[MATCH] Saved match ${matchId} (Admin SDK)`);
        matchSaved = true;
      } catch (adminErr) {
        console.error(`[MATCH] Admin SDK save failed for ${matchId}:`, adminErr);
      }
    }
    
    if (!matchSaved) {
      const clientDb = (global as any).clientDb;
      if (clientDb) {
        try {
          await clientSetDoc(clientDoc(clientDb, 'matches', matchId), matchHistory);
          console.log(`[MATCH] Saved match ${matchId} (Client SDK)`);
          matchSaved = true;
        } catch (clientErr) {
          console.error(`[MATCH] Client SDK save failed for ${matchId}:`, clientErr);
        }
      }
    }
  } catch (err) {
    console.error(`[MATCH] Fatal error saving match ${matchId}:`, err);
  }

  // 2. Update each player's profile
  for (const player of game.players) {
    if (player.isBot) continue;

    const isWinner = player.uid === game.winnerId;
    const xpGained = isWinner ? 50 : 10;
    player.xpGained = xpGained;

    try {
      let profile: UserProfile | null = null;

      // Try Admin SDK first (bypasses rules)
      if (db) {
        try {
          const userRef = db.collection('users').doc(player.uid);
          const userSnap = await userRef.get();
          if (userSnap.exists) {
            profile = userSnap.data() as UserProfile;
          }
        } catch (adminErr) {
          console.warn(`[PROFILE] Admin SDK fetch failed for ${player.uid}:`, adminErr);
        }
      } 
      
      // Fallback to Client SDK if Admin SDK failed or is null
      if (!profile) {
        const clientDb = (global as any).clientDb;
        if (clientDb) {
          try {
            const userSnap = await clientGetDoc(clientDoc(clientDb, 'users', player.uid));
            if (userSnap.exists()) {
              profile = userSnap.data() as UserProfile;
            }
          } catch (e) {
            console.warn(`[PROFILE] Client SDK fetch failed for ${player.uid} (likely permissions)`);
          }
        }
      }

      // Create new profile if still null
      if (!profile) {
        profile = {
          uid: player.uid,
          displayName: player.displayName || 'Guest',
          photoURL: player.photoURL || '',
          wins: 0,
          losses: 0,
          leastCountWins: 0,
          leastCountLosses: 0,
          callBreakWins: 0,
          callBreakLosses: 0,
          unoWins: 0,
          unoLosses: 0,
          xp: 0,
          level: 1,
          matchHistory: [],
          following: [],
          createdAt: Date.now()
        };
      }

      // Update stats
      if (isWinner) {
        profile.wins = (profile.wins || 0) + 1;
        if (gameType === 'leastcount') profile.leastCountWins = (profile.leastCountWins || 0) + 1;
        else if (gameType === 'callbreak') profile.callBreakWins = (profile.callBreakWins || 0) + 1;
        else if (gameType === 'uno') profile.unoWins = (profile.unoWins || 0) + 1;
      } else {
        profile.losses = (profile.losses || 0) + 1;
        if (gameType === 'leastcount') profile.leastCountLosses = (profile.leastCountLosses || 0) + 1;
        else if (gameType === 'callbreak') profile.callBreakLosses = (profile.callBreakLosses || 0) + 1;
        else if (gameType === 'uno') profile.unoLosses = (profile.unoLosses || 0) + 1;
      }
      profile.xp = (profile.xp || 0) + xpGained;
      profile.level = Math.floor(profile.xp / 100) + 1;

      // Update match history
      if (!profile.matchHistory) profile.matchHistory = [];
      profile.matchHistory.unshift(matchHistory);
      if (profile.matchHistory.length > 20) {
        profile.matchHistory = profile.matchHistory.slice(0, 20);
      }

      // Save updated profile
      let saved = false;
      if (db) {
        try {
          await db.collection('users').doc(player.uid).set(profile);
          console.log(`[PROFILE] Updated ${player.displayName} (Admin SDK)`);
          saved = true;
        } catch (adminErr) {
          console.warn(`[PROFILE] Admin SDK save failed for ${player.uid}:`, adminErr);
        }
      } 
      
      if (!saved) {
        const clientDb = (global as any).clientDb;
        if (clientDb) {
          try {
            await clientSetDoc(clientDoc(clientDb, 'users', player.uid), profile);
            console.log(`[PROFILE] Updated ${player.displayName} (Client SDK)`);
          } catch (e) {
            console.error(`[PROFILE] Client SDK update failed for ${player.uid}:`, e);
          }
        }
      }
    } catch (err) {
      console.error(`[PROFILE] Failed to update profile for ${player.uid}:`, err);
    }
  }
}

const app = express();
const httpServer = createServer(app);

// Multer configuration for sound uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const soundsDir = path.join(__dirname, 'public', 'sounds');
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }
    cb(null, soundsDir);
  },
  filename: (req, file, cb) => {
    // The filename should match the expected sound ID + .mp3
    // We'll pass the sound ID in the body or as a field
    const soundId = req.body.soundId;
    if (!soundId) {
      return cb(new Error("No soundId provided"), "");
    }
    // We replace the existing file by using the same name (lowercase)
    cb(null, `${soundId.toLowerCase()}.mp3`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
      cb(null, true);
    } else {
      cb(new Error("Only MP3 files are allowed"));
    }
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

// API routes go here
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(), 
    env: process.env.NODE_ENV,
    dbInitialized: !!db
  });
});

// Admin: Reset Database (One-time use as requested)
app.get("/api/logs", (req, res) => {
  res.json({ logs });
});

app.get("/api/admin/logs", (req, res) => {
  const adminEmail = req.headers['x-admin-email'] || req.query.email;
  if (adminEmail !== 'anisettibharadwaja@gmail.com') {
    return res.status(403).json({ error: "Unauthorized" });
  }
  res.json({ logs });
});

app.all("/api/admin/reset-database", async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientDb = (global as any).clientDb;
  if (!db && !clientDb) return res.status(500).json({ error: "DB not initialized" });
  
  // Security: Check for admin email in headers (passed from client)
  // For GET requests, we can also check query params if headers are hard to set (e.g., direct link)
  const rawEmail = req.headers['x-admin-email'] || req.query.email;
  const adminEmail = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const expectedAdmin = 'anisettibharadwaja@gmail.com';
  
  if (!adminEmail || typeof adminEmail !== 'string' || adminEmail.toLowerCase() !== expectedAdmin.toLowerCase()) {
    console.warn(`[ADMIN_UNAUTHORIZED] Unauthorized reset attempt from: "${adminEmail}"`);
    return res.status(403).json({ 
      error: "Unauthorized: Admin access restricted", 
      received: adminEmail,
      expected: expectedAdmin 
    });
  }

  try {
    console.log(`[ADMIN] Resetting database requested by ${adminEmail}...`);
    
    const collections = ['users', 'matches', 'rooms', '_system', 'test', 'sounds'];
    let totalDeleted = 0;

    if (db) {
      // Admin SDK Deletion
      for (const colName of collections) {
        console.log(`[ADMIN] Clearing collection (Admin): ${colName}`);
        const snapshot = await db.collection(colName).get();
        if (snapshot.empty) continue;

        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = db.batch();
          const chunk = docs.slice(i, i + 400);
          chunk.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          totalDeleted += chunk.length;
        }
      }
    } else if (clientDb) {
      // Client SDK Deletion (Fallback)
      for (const colName of collections) {
        try {
          console.log(`[ADMIN] Clearing collection (Client): ${colName}`);
          const snapshot = await clientGetDocs(clientCollection(clientDb, colName));
          console.log(`[ADMIN] Found ${snapshot.size} documents in ${colName}`);
          
          if (snapshot.empty) continue;

          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += 400) {
            try {
              const batch = clientWriteBatch(clientDb);
              const chunk = docs.slice(i, i + 400);
              chunk.forEach(doc => batch.delete(doc.ref));
              await batch.commit();
              totalDeleted += chunk.length;
              console.log(`[ADMIN] Deleted chunk of ${chunk.length} from ${colName}`);
            } catch (batchErr) {
              console.error(`[ADMIN] Batch delete failed for ${colName}:`, batchErr);
              throw batchErr;
            }
          }
        } catch (colErr) {
          console.error(`[ADMIN] Failed to clear collection ${colName}:`, colErr);
          throw colErr;
        }
      }
    }
    
    console.log(`[ADMIN] Reset successful. Deleted ${totalDeleted} documents.`);
    res.json({ 
      success: true, 
      message: `Database reset successful. Deleted ${totalDeleted} documents.`,
      sdkUsed: db ? 'Admin' : 'Client'
    });
  } catch (error) {
    console.error("[ADMIN] Database reset failed:", error);
    res.status(500).json({ 
      error: "Reset failed", 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

app.get("/api/admin/test-firestore", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB not initialized" });
  try {
    const testRef = db.collection('_system').doc('test');
    await testRef.set({ lastTest: Date.now(), status: 'ok' });
    const snap = await testRef.get();
    res.json({ message: "Firestore test successful", data: snap.data() });
  } catch (error) {
    res.status(500).json({ error: "Firestore test failed", details: error instanceof Error ? error.message : String(error) });
  }
});

// Admin: Upload/Replace Sound
app.post("/api/admin/upload-sound", (req, res) => {
  // Security check
  const rawEmail = req.headers['x-admin-email'];
  const adminEmail = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const expectedAdmin = 'anisettibharadwaja@gmail.com';

  if (!adminEmail || typeof adminEmail !== 'string' || adminEmail.toLowerCase() !== expectedAdmin.toLowerCase()) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  upload.single('sound')(req, res, (err) => {
    if (err) {
      console.error("[ADMIN] Upload error:", err);
      return res.status(400).json({ error: err.message });
    }
    
    if (!(req as any).file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`[ADMIN] Sound ${req.body.soundId} replaced by ${adminEmail}`);
    res.json({ message: `Sound ${req.body.soundId} replaced successfully` });
  });
});

// In-memory game state for real-time performance
const games: Map<string, GameState> = new Map();
const callBreakGames: Map<string, CallBreakGame> = new Map();
const unoGames: Map<string, UnoGame> = new Map();
const turnTimers: Map<string, NodeJS.Timeout> = new Map();
const cbTurnTimers: Map<string, NodeJS.Timeout> = new Map();
const showdownTimers: Map<string, NodeJS.Timeout> = new Map();
const onlineUsers: Map<string, { uid: string; displayName: string; photoURL?: string }> = new Map();

// Helper: Persist game to Firestore
async function persistGame(game: GameState) {
  const clientDb = (global as any).clientDb;
  if (!clientDb) return;
  try {
    await clientSetDoc(clientDoc(clientDb, 'rooms', game.roomId), game);
  } catch (error) {
    console.error(`[PERSIST] Failed to persist game ${game.roomId}:`, error);
  }
}

// Helper: Load game from Firestore
async function loadGame(roomId: string): Promise<GameState | null> {
  const clientDb = (global as any).clientDb;
  if (!clientDb) return null;
  try {
    const docSnap = await clientGetDoc(clientDoc(clientDb, 'rooms', roomId));
    if (docSnap.exists()) {
      return docSnap.data() as GameState;
    }
  } catch (error) {
    console.error(`[PERSIST] Failed to load game ${roomId}:`, error);
  }
  return null;
}

// Helper: Delete game from Firestore
async function deleteGame(roomId: string) {
  const clientDb = (global as any).clientDb;
  if (!clientDb) return;
  try {
    await clientDeleteDoc(clientDoc(clientDb, 'rooms', roomId));
    console.log(`[PERSIST] Room ${roomId} deleted from Firestore`);
  } catch (error) {
    console.error(`[ERROR] Failed to delete room ${roomId} from Firestore:`, error);
  }
}

// Helper: Update game state (emit + persist)
function updateGame(game: GameState) {
  io.to(game.roomId).emit('gameUpdate', game);
  persistGame(game);
}

// Helper: Create a standard deck (Mega-Game Edition: 4 decks)
function createDeck(): Card[] {
  const suits: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];

  // 4 standard decks
  for (let i = 0; i < 4; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        let value = 0;
        if (rank === 'A') value = 1;
        else if (['J', 'Q', 'K'].includes(rank)) value = 10;
        else value = parseInt(rank);

        deck.push({
          id: `${suit}-${rank}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          suit,
          rank,
          value
        });
      }
    }
    
    // 2 Jokers per deck (8 total)
    deck.push({ id: `joker-${i}-1`, rank: 'Joker', value: 0 });
    deck.push({ id: `joker-${i}-2`, rank: 'Joker', value: 0 });
  }

  return deck.sort(() => Math.random() - 0.5);
}

function createUnoDeck(): UnoCard[] {
  const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
  const values: UnoValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
  const deck: UnoCard[] = [];

  colors.forEach(color => {
    // One '0' per color
    deck.push({ id: `${color}-0-0`, color, value: '0' });
    // Two of everything else (1-9, skip, reverse, draw2)
    values.slice(1).forEach(value => {
      for (let i = 0; i < 2; i++) {
        deck.push({ id: `${color}-${value}-${i}`, color, value });
      }
    });
  });

  // 4 Wild and 4 Wild Draw Four
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-wild-${i}`, color: 'wild', value: 'wild' });
    deck.push({ id: `wild-draw4-${i}`, color: 'wild', value: 'draw4' });
  }

  return deck.sort(() => Math.random() - 0.5);
}

// Helper: Start a new round
function startRound(game: GameState) {
  // Clear showdown timer if it exists
  if (showdownTimers.has(game.roomId)) {
    clearTimeout(showdownTimers.get(game.roomId)!);
    showdownTimers.delete(game.roomId);
  }

  game.roundNumber++;
  game.deck = createDeck();
  game.discardPile = [];
  game.tempDiscardPile = [];
  game.status = 'playing';
  game.winnerId = null;
  
  // Remove wild rank logic for Mega-Game Edition
  game.wildRank = null;

  // Reset players for new round
  for (const player of game.players) {
    if (player.totalScore < game.config.eliminationLimit) {
      player.hand = game.deck.splice(0, 7);
      player.score = 0;
      player.isReady = false;
      player.hasDiscarded = false;
      player.isInRound = true;
      // Reset away status for bots
      if (player.isBot) player.isAway = false;
    } else {
      player.hand = [];
      player.score = 0;
      player.isInRound = false;
    }
  }

  // Pick a random card from the deck as the Joker for this round
  // (Excluding existing Jokers to make it more interesting)
  const nonJokerCards = game.deck.filter(c => c.rank !== 'Joker');
  if (nonJokerCards.length > 0) {
    const randomIndex = Math.floor(Math.random() * nonJokerCards.length);
    game.jokerCard = nonJokerCards[randomIndex];
    game.wildRank = game.jokerCard.rank;
  } else {
    game.jokerCard = null;
    game.wildRank = null;
  }

  // Set turn index based on round number (seating order)
  let startIndex = (game.roundNumber - 1) % game.players.length;
  let attempts = 0;
  while (!game.players[startIndex].isInRound && attempts < game.players.length) {
    startIndex = (startIndex + 1) % game.players.length;
    attempts++;
  }
  game.turnIndex = startIndex;

  // Initial discard
  game.discardPile.push(game.deck.pop()!);
  game.logs.push(`Round ${game.roundNumber} started! Joker for this round: ${game.wildRank || 'None'}`);
  game.turnStartedAt = Date.now();
  
  startTurnTimer(game);
}

// Helper: Calculate hand value (Mega-Game Edition: Joker=0, Ace=1, J/Q/K=10)
function getHandValue(hand: Card[], wildRank: CardRank | null = null) {
  return hand.reduce((total, card) => {
    if (card.rank === 'Joker' || card.rank === wildRank) return total;
    return total + card.value;
  }, 0);
}

// AI Bot Logic
async function handleBotTurn(game: GameState, bot: Player) {
  if (game.status !== 'playing') return;
  
  const botValue = getHandValue(bot.hand, game.wildRank);
  const otherPlayers = game.players.filter(p => p.uid !== bot.uid && p.isInRound);
  const avgOtherCards = otherPlayers.reduce((sum, p) => sum + p.hand.length, 0) / otherPlayers.length;
  const deckRemaining = game.deck.length;
  
  // 1. STRATEGIC CALLING (SHOW)
  if (botValue <= game.config.callLimit) {
    let callProbability = 0;
    
    // Calculate risk based on other players' hand sizes
    const minOtherCards = Math.min(...otherPlayers.map(p => p.hand.length));
    const isLateGame = deckRemaining < 20 || game.roundNumber > 5;
    const isEarlyRound = deckRemaining > 40;

    if (botValue === 0) {
      // Always call on 0, but maybe wait a bit if it's early and we want to "trap" others?
      // Actually, in Least Count, 0 is the best, so just call.
      callProbability = 1.0;
    } else if (botValue <= 2) {
      // Very low score: call if late game or if others are low on cards
      if (isEarlyRound) {
        callProbability = 0.3; // Wait to try and get 0
      } else {
        callProbability = minOtherCards > 2 ? 0.9 : 0.6;
      }
    } else if (botValue <= 5) {
      // Low score: call if others have many cards and it's late game
      callProbability = (avgOtherCards > 5 && isLateGame) ? 0.7 : 0.2;
    } else {
      // Near limit: only call if others are likely to have much higher scores
      // and we are very late in the game
      callProbability = (avgOtherCards > 6 && deckRemaining < 10) ? 0.4 : 0.05;
    }
    
    if (Math.random() < callProbability) {
      await handleCall(game, bot.uid);
      return;
    }
  }

  // 2. STRATEGIC DISCARDING
  // Identify sets (rank groups)
  const rankGroups: Record<string, Card[]> = {};
  bot.hand.forEach(c => {
    if (c.rank === 'Joker' || c.rank === game.wildRank) return; // Keep Jokers/Wilds
    if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
    rankGroups[c.rank].push(c);
  });

  // Calculate "burden" of each card/group
  let bestCardsToDiscard: Card[] = [];
  let maxBurden = -1;

  for (const rank in rankGroups) {
    const group = rankGroups[rank];
    const groupValue = group[0].value; 
    // Burden for a single card = value / 1
    // Burden for a pair = value / 4
    // Burden for a triplet = value / 9
    const burden = groupValue / (group.length * group.length); 
    
    if (burden > maxBurden) {
      maxBurden = burden;
      bestCardsToDiscard = group;
    }
  }

  // If we only have Jokers/Wilds, we MUST discard one (unlikely but possible)
  if (bestCardsToDiscard.length === 0 && bot.hand.length > 0) {
    // Discard the highest value card if forced, but try to keep Jokers/Wilds
    // Actually, if all are Jokers/Wilds, they all have value 0 in getHandValue
    // but we should pick one to discard.
    bestCardsToDiscard = [bot.hand[0]];
  }

  if (bestCardsToDiscard.length > 0) {
    handleDiscard(game, bot.uid, bestCardsToDiscard.map(c => c.id));
  }

  // 3. STRATEGIC DRAWING
  const topDiscard = game.discardPile[game.discardPile.length - 1];
  let shouldTakeDiscard = false;

  if (topDiscard) {
    const isWild = topDiscard.rank === 'Joker' || topDiscard.rank === game.wildRank;
    const completesSet = bot.hand.some(c => c.rank === topDiscard.rank);
    const isVeryLow = !isWild && topDiscard.value <= 2;

    if (isWild) {
      shouldTakeDiscard = true; // Always take a wild card from discard
    } else if (completesSet && topDiscard.value <= 8) {
      shouldTakeDiscard = true; // Take if it completes a set and isn't too expensive
    } else if (isVeryLow && botValue > 10) {
      shouldTakeDiscard = true; // Take very low cards if our hand is heavy
    }
  }

  if (shouldTakeDiscard) {
    handleDraw(game, bot.uid, 'discard');
  } else {
    handleDraw(game, bot.uid, 'deck');
  }
}

function startTurnTimer(game: GameState) {
  // Clear existing timer
  if (turnTimers.has(game.roomId)) {
    clearTimeout(turnTimers.get(game.roomId)!);
  }

  const timer = setTimeout(async () => {
    const currentPlayer = game.players[game.turnIndex];
    if (!currentPlayer) return;

    game.logs.push(`${currentPlayer.displayName}'s turn timed out.`);
    currentPlayer.isAway = true; // Mark as away on timeout
    
    // Use Intelligent AI to play the turn
    await handleBotTurn(game, currentPlayer);
    updateGame(game);
  }, game.config.turnTimer * 1000);

  turnTimers.set(game.roomId, timer);
}

function handleDiscard(game: GameState, playerUid: string, cardIds: string[]) {
  const player = game.players.find(p => p.uid === playerUid);
  if (!player || player.hasDiscarded) return;

  // Validate cards are of same rank OR it's a single card
  const discardedCards = player.hand.filter(c => cardIds.includes(c.id));
  if (discardedCards.length === 0) return;

  const firstRank = discardedCards[0].rank;
  const allSameRank = discardedCards.every(c => c.rank === firstRank);
  
  if (!allSameRank && discardedCards.length > 1) {
    game.logs.push(`${player.displayName} tried to discard invalid combination.`);
    return;
  }

  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  
  // Check if rank matches top of discard pile (skip draw rule)
  const topDiscard = game.discardPile[game.discardPile.length - 1];
  const isMatch = topDiscard && firstRank === topDiscard.rank;

  if (isMatch) {
    game.logs.push(`${player.displayName} matched ${firstRank} and skipped draw!`);
    game.discardPile.push(...discardedCards);
    player.hasDiscarded = false;
    endTurn(game);
  } else {
    game.tempDiscardPile = discardedCards;
    player.hasDiscarded = true;
    const cardNames = discardedCards.map(c => `${c.rank}${c.suit ? (c.suit === 'hearts' ? '♥' : c.suit === 'diamonds' ? '♦' : c.suit === 'clubs' ? '♣' : '♠') : ''}`).join(', ');
    game.logs.push(`${player.displayName} discarded ${cardNames}.`);
  }
}

function endTurn(game: GameState) {
  // Clear existing timer
  if (turnTimers.has(game.roomId)) {
    clearTimeout(turnTimers.get(game.roomId)!);
    turnTimers.delete(game.roomId);
  }

  // Next turn
  let nextIndex = (game.turnIndex + 1) % game.players.length;
  
  // Skip players who are NOT in the round
  let attempts = 0;
  while (!game.players[nextIndex].isInRound && attempts < game.players.length) {
    nextIndex = (nextIndex + 1) % game.players.length;
    attempts++;
  }
  
  game.turnIndex = nextIndex;
  game.turnStartedAt = Date.now();
  
  const nextPlayer = game.players[game.turnIndex];
  
  startTurnTimer(game);
  
  // Check if next player is a bot or away
  if (nextPlayer.isBot || nextPlayer.isAway) {
    setTimeout(async () => {
      const g = games.get(game.roomId);
      if (g && g.turnIndex === nextIndex && g.status === 'playing') {
        await handleBotTurn(g, nextPlayer);
      }
    }, 1500);
  }
}

function handleDraw(game: GameState, playerUid: string, source: 'deck' | 'discard') {
  const player = game.players.find(p => p.uid === playerUid);
  if (!player || !player.hasDiscarded) return;

  let drawnCard: Card | undefined;
  if (source === 'deck') {
    drawnCard = game.deck.pop();
    if (game.deck.length === 0) {
      // Reshuffle discard pile
      const top = game.discardPile.pop()!;
      game.deck = game.discardPile.sort(() => Math.random() - 0.5);
      game.discardPile = [top];
      game.logs.push("SYSTEM: Deck empty. Reshuffling discard pile.");
    }
  } else {
    drawnCard = game.discardPile.pop();
  }

  if (drawnCard) {
    player.hand.push(drawnCard);
    game.logs.push(`${player.displayName} picked from ${source}.`);
  }

  // Move temp discard pile to main discard pile
  if (game.tempDiscardPile.length > 0) {
    game.discardPile.push(...game.tempDiscardPile);
    game.tempDiscardPile = [];
  }

  // Reset discard flag for next turn
  player.hasDiscarded = false;

  endTurn(game);
}

async function handleCall(game: GameState, playerUid: string) {
  const caller = game.players.find(p => p.uid === playerUid);
  if (!caller || !caller.isInRound || caller.hasDiscarded) return;
  if (game.players[game.turnIndex]?.uid !== playerUid) return;

  const callerValue = getHandValue(caller.hand, game.wildRank);
  // Mega-Game Edition: Minimum Show Limit from config
  if (callerValue > game.config.callLimit) {
    game.logs.push(`${caller.displayName} tried to call but hand value (${callerValue}) is above limit (${game.config.callLimit}).`);
    updateGame(game);
    return;
  }

  // Clear timer on call
  if (turnTimers.has(game.roomId)) {
    clearTimeout(turnTimers.get(game.roomId)!);
    turnTimers.delete(game.roomId);
  }

  game.status = 'showdown';
  game.logs.push(`${caller.displayName} called SHOW!`);
  game.lastRoundCallerId = caller.uid;

  let actualLowestValue = Infinity;
  let caughtBy: Player | null = null;
  let roundWinnerId = caller.uid;

  // Calculate all hand values and find the actual lowest among active players
  for (const player of game.players) {
    if (!player.isInRound) continue;

    const val = getHandValue(player.hand, game.wildRank);
    player.score = val;
    
    if (val < actualLowestValue) {
      actualLowestValue = val;
      roundWinnerId = player.uid;
    }
    
    if (player.uid !== caller.uid && val <= callerValue) {
      // If multiple people catch, the first one found is fine for logic
      if (!caughtBy || val < getHandValue(caughtBy.hand, game.wildRank)) {
        caughtBy = player;
      }
    }
  }

  game.lastRoundWinnerId = roundWinnerId;
  game.lastRoundCaughtId = caughtBy ? caller.uid : null;

  if (caughtBy) {
    // Wrong Show: Penalty count only (as requested by user)
    caller.score = game.config.penaltyValue;
    
    // The player who caught the caller (or tied) gets 0.
    caughtBy.score = 0;
    game.logs.push(`${caller.displayName} was CAUGHT by ${caughtBy.displayName}! Penalty: ${caller.score}.`);
  } else {
    // Good Show: 0 points
    caller.score = 0;
    game.logs.push(`${caller.displayName} WON the round with ${callerValue} points!`);
  }

  // Update total scores for all players (even spectators keep their total)
  const currentRoundScores: Record<string, number> = {};
  for (const player of game.players) {
    if (player.isInRound) {
      player.totalScore += player.score;
      currentRoundScores[player.uid] = player.score;
    }
  }
  
  if (!game.roundScores) {
    game.roundScores = [];
  }
  game.roundScores.push({
    round: game.roundNumber,
    scores: currentRoundScores
  });

  // Mega-Game Edition: Sudden Death after round 3
  // If there are many players (e.g. >= 10), eliminate the top 5 highest scorers
  if (game.roundNumber === 3 && game.players.length >= 10) {
    const sortedByScore = [...game.players]
      .filter(p => p.totalScore < game.config.eliminationLimit)
      .sort((a, b) => b.totalScore - a.totalScore);
    
    const toEliminate = sortedByScore.slice(0, 5);
    toEliminate.forEach(p => {
      p.totalScore = game.config.eliminationLimit; // Force elimination
      game.logs.push(`SUDDEN DEATH: ${p.displayName} eliminated (Top 5 highest scores).`);
    });
  }

  // Check for elimination
  const activePlayers = game.players.filter(p => p.totalScore < game.config.eliminationLimit);
  if (activePlayers.length <= 1) {
    game.status = 'ended';
    game.winnerId = activePlayers[0]?.uid || [...game.players].sort((a,b) => a.totalScore - b.totalScore)[0].uid;
    game.logs.push(`Game Over! Winner is ${game.players.find(p => p.uid === game.winnerId)?.displayName}.`);
    console.log(`[GAME] Game ${game.roomId} ended. Winner: ${game.winnerId}. Finalizing profiles...`);
    await finalizeUserProfiles(game, 'leastcount');
  } else {
    // Auto-start next round after 10 seconds
    const timer = setTimeout(() => {
      const g = games.get(game.roomId);
      if (g && g.status === 'showdown') {
        startRound(g);
        updateGame(g);
      }
    }, 10000);
    showdownTimers.set(game.roomId, timer);
  }

  updateGame(game);
}

// Socket.io Handlers
// --- Call Break Logic ---
function createCallBreakDeck(): Card[] {
  const suits: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];
  let id = 0;
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `cb_${id++}`,
        suit,
        rank,
        value: ranks.indexOf(rank) + 2,
      });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function getCardValueCB(card: Card): number {
  return card.value;
}

function evaluateTrickCB(trick: { playerUid: string; card: Card }[], leadSuit: CardSuit): string {
  let winningCard = trick[0].card;
  let winnerUid = trick[0].playerUid;

  for (let i = 1; i < trick.length; i++) {
    const play = trick[i];
    if (play.card.suit === 'spades' && winningCard.suit !== 'spades') {
      winningCard = play.card;
      winnerUid = play.playerUid;
    } else if (play.card.suit === winningCard.suit && getCardValueCB(play.card) > getCardValueCB(winningCard)) {
      winningCard = play.card;
      winnerUid = play.playerUid;
    }
  }
  return winnerUid;
}

function isValidPlayCB(card: Card, hand: Card[], leadSuit: CardSuit | null, currentTrick: { playerUid: string; card: Card }[]): boolean {
  if (!leadSuit) return true; // First to play can play anything

  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) {
    if (card.suit !== leadSuit) return false; // Must follow suit

    // Must over-trump if possible AND (no spades have been played OR lead suit IS spades)
    const spadePlayed = currentTrick.some(c => c.card.suit === 'spades');
    if (!spadePlayed || leadSuit === 'spades') {
      const leadSuitCardsInTrick = currentTrick.filter(c => c.card.suit === leadSuit);
      const highestLeadCardValue = leadSuitCardsInTrick.length > 0 ? Math.max(...leadSuitCardsInTrick.map(c => getCardValueCB(c.card))) : 0;
      const hasHigherLeadCard = hand.some(c => c.suit === leadSuit && getCardValueCB(c) > highestLeadCardValue);

      if (hasHigherLeadCard && getCardValueCB(card) <= highestLeadCardValue) {
        return false; // Must play higher card if possible
      }
    }
    return true;
  }

  // Void in lead suit
  const hasSpade = hand.some(c => c.suit === 'spades');
  if (hasSpade) {
    if (card.suit !== 'spades') return false; // Must play spade if void in lead suit and has spade

    const spadesInTrick = currentTrick.filter(c => c.card.suit === 'spades');
    const highestSpadeValue = spadesInTrick.length > 0 ? Math.max(...spadesInTrick.map(c => getCardValueCB(c.card))) : 0;
    const hasHigherSpade = hand.some(c => c.suit === 'spades' && getCardValueCB(c) > highestSpadeValue);
    
    if (hasHigherSpade && getCardValueCB(card) <= highestSpadeValue) {
      return false; // Must over-trump spade if possible
    }
    return true;
  }

  // Void in lead suit and no spades
  return true; // Can play anything
}

function handleCallBreakBotBidding(game: CallBreakGame, player: CallBreakPlayer) {
  if (game.status !== 'bidding' || game.players[game.turnIndex].uid !== player.uid) return;

  // Intelligent bidding
  let bid = 0;
  const hand = player.hand;
  
  // Count high cards
  const aces = hand.filter(c => c.rank === 'A').length;
  const kings = hand.filter(c => c.rank === 'K').length;
  const spades = hand.filter(c => c.suit === 'spades').length;
  
  bid += aces;
  bid += Math.floor(kings * 0.7); // Kings are likely but not guaranteed
  
  // Spades are trumps
  if (spades >= 4) bid += Math.floor((spades - 2) / 2);
  
  bid = Math.max(1, Math.min(8, bid)); // Reasonable bid range for bots

  player.call = bid;
  game.logs.push(`${player.displayName} (Bot) called ${bid}.`);

  const allCalled = game.players.every(p => p.call > 0);
  if (allCalled) {
    game.status = 'playing';
    game.turnIndex = (game.dealerIndex + 1) % 4;
    game.logs.push(`Bidding finished. ${game.players[game.turnIndex].displayName} leads.`);
  } else {
    game.turnIndex = (game.turnIndex + 1) % 4;
  }

  startCallBreakTurnTimer(game);
  updateCallBreakGame(game);

  // Handle next bot bidding or turn
  const nextPlayer = game.players[game.turnIndex];
  if (game.status === 'bidding' && nextPlayer.isBot) {
    setTimeout(() => handleCallBreakBotBidding(game, nextPlayer), 1000);
  } else if (game.status === 'playing' && nextPlayer.isBot) {
    setTimeout(() => handleCallBreakBotTurn(game, nextPlayer), 1000);
  }
}

function handleCallBreakBotTurn(game: CallBreakGame, player: CallBreakPlayer) {
  if (game.status !== 'playing' || game.players[game.turnIndex].uid !== player.uid) return;

  const validCards = player.hand.filter(c => isValidPlayCB(c, player.hand, game.leadSuit, game.currentTrick));
  if (validCards.length === 0) return;

  // Intelligent card play
  let cardToPlay: Card;
  
  if (game.currentTrick.length === 0) {
    // Leading: Play a high card of a non-spade suit if possible, or a low spade
    const nonSpades = validCards.filter(c => c.suit !== 'spades');
    if (nonSpades.length > 0) {
      // Prefer high cards of suits we have few of? No, just play high cards to win tricks we called
      const highCards = nonSpades.filter(c => c.value >= 11); // J, Q, K, A
      if (highCards.length > 0) {
        cardToPlay = highCards[Math.floor(Math.random() * highCards.length)];
      } else {
        cardToPlay = nonSpades[Math.floor(Math.random() * nonSpades.length)];
      }
    } else {
      cardToPlay = validCards[Math.floor(Math.random() * validCards.length)];
    }
  } else {
    // Following: Try to win if possible, otherwise play low
    const leadSuitCards = validCards.filter(c => c.suit === game.leadSuit);
    const spades = validCards.filter(c => c.suit === 'spades');
    
    const currentHighest = Math.max(...game.currentTrick.map(t => {
      if (t.card.suit === game.leadSuit) return t.card.value;
      if (t.card.suit === 'spades') return t.card.value + 100; // Spades beat everything
      return 0;
    }));

    if (leadSuitCards.length > 0) {
      const winningCards = leadSuitCards.filter(c => c.value > currentHighest);
      if (winningCards.length > 0) {
        // Play the lowest winning card
        cardToPlay = winningCards.sort((a, b) => a.value - b.value)[0];
      } else {
        // Play the lowest card
        cardToPlay = leadSuitCards.sort((a, b) => a.value - b.value)[0];
      }
    } else if (spades.length > 0) {
      const winningSpades = spades.filter(c => (c.value + 100) > currentHighest);
      if (winningSpades.length > 0) {
        cardToPlay = winningSpades.sort((a, b) => a.value - b.value)[0];
      } else {
        cardToPlay = spades.sort((a, b) => a.value - b.value)[0];
      }
    } else {
      // Throw away lowest card
      cardToPlay = validCards.sort((a, b) => a.value - b.value)[0];
    }
  }

  const cardIndex = player.hand.findIndex(c => c.id === cardToPlay.id);
  player.hand.splice(cardIndex, 1);
  game.currentTrick.push({ playerUid: player.uid, card: cardToPlay });

  if (game.currentTrick.length === 1) {
    game.leadSuit = cardToPlay.suit!;
  }

  if (game.currentTrick.length === 4) {
    game.status = 'trickEnd';
    const winnerUid = evaluateTrickCB(game.currentTrick, game.leadSuit!);
    const winner = game.players.find(p => p.uid === winnerUid)!;
    winner.tricksWon++;
    game.lastTrick = [...game.currentTrick];
    game.lastTrickWinnerId = winnerUid;
    game.logs.push(`${winner.displayName} won the trick.`);
    
    updateCallBreakGame(game);

    setTimeout(() => {
      const g = callBreakGames.get(game.roomId);
      if (!g || g.status !== 'trickEnd') return;

      g.currentTrick = [];
      g.leadSuit = null;
      g.turnIndex = g.players.findIndex(p => p.uid === winnerUid);

      if (g.players[0].hand.length === 0) {
        g.status = 'roundEnd';
        for (const p of g.players) {
          let roundScore = 0;
          if (p.tricksWon >= p.call) {
            roundScore = p.call + (p.tricksWon - p.call) * 0.1;
          } else {
            roundScore = -p.call;
          }
          p.roundScores.push(roundScore);
          p.totalScore += roundScore;
          p.totalScore = Math.round(p.totalScore * 10) / 10;
        }
      } else {
        g.status = 'playing';
        startCallBreakTurnTimer(g);
      }
      
      updateCallBreakGame(g);

      if (g.status === 'playing') {
        const nextPlayer = g.players[g.turnIndex];
        if (nextPlayer.isBot) {
          setTimeout(() => handleCallBreakBotTurn(g, nextPlayer), 1000);
        }
      }
    }, 1500);
    return;
  } else {
    game.turnIndex = (game.turnIndex + 1) % 4;
    startCallBreakTurnTimer(game);
  }

  updateCallBreakGame(game);

  // Handle next bot turn
  const nextPlayer = game.players[game.turnIndex];
  if (game.status === 'playing' && nextPlayer.isBot) {
    setTimeout(() => handleCallBreakBotTurn(game, nextPlayer), 1000);
  }
}

function updateCallBreakGame(game: CallBreakGame) {
  io.to(game.roomId).emit("cb_gameState", game);
}

function updateUnoGame(game: UnoGame) {
  io.to(game.roomId).emit("uno_gameUpdate", game);
  
  // Handle bot turns
  const currentPlayer = game.players[game.turnIndex];
  if (game.status === 'playing' && currentPlayer && currentPlayer.isBot) {
    setTimeout(async () => {
      const g = unoGames.get(game.roomId);
      if (g && g.status === 'playing' && g.players[g.turnIndex].uid === currentPlayer.uid) {
        await handleUnoBotTurn(g, g.players[g.turnIndex]);
        updateUnoGame(g);
      }
    }, 1500);
  }
}

async function playUnoCard(game: UnoGame, player: UnoPlayer, cardId: string, chosenColor: UnoColor) {
  const cardIndex = player.unoHand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return false;

  const card = player.unoHand[cardIndex];
  
  // Stacking rules
  let isPlayable = false;
  if (game.pendingDrawCount > 0) {
    if (game.currentValue === 'draw2') {
      isPlayable = card.value === 'draw2' || card.value === 'draw4';
    } else if (game.currentValue === 'draw4') {
      isPlayable = card.value === 'draw4';
    }
  } else {
    isPlayable = card.color === 'wild' || card.color === game.currentColor || card.value === game.currentValue;
  }
  
  if (!isPlayable) return false;

  player.unoHand.splice(cardIndex, 1);
  game.discardPile.push(card);
  game.currentColor = card.color === 'wild' ? chosenColor : card.color;
  game.currentValue = card.value;
  game.logs.push(`${player.displayName} played ${card.color} ${card.value}.`);

  if (player.unoHand.length === 0) {
    game.status = 'ended';
    game.winnerId = player.uid;
    game.logs.push(`${player.displayName} wins the game!`);
    await finalizeUserProfiles(game, 'uno');
    return true;
  }

  let skipNext = false;

  if (card.value === 'skip') {
    skipNext = true;
  } else if (card.value === 'reverse') {
    if (game.players.length === 2) {
      skipNext = true;
    } else {
      game.direction *= -1;
    }
  } else if (card.value === 'draw2') {
    game.pendingDrawCount += 2;
  } else if (card.value === 'draw4') {
    game.pendingDrawCount += 4;
  }

  game.turnIndex = (game.turnIndex + (skipNext ? 2 : 1) * game.direction + game.players.length) % game.players.length;
  
  game.turnStartedAt = Date.now();
  return true;
}

function drawUnoCard(game: UnoGame, player: UnoPlayer) {
  if (game.pendingDrawCount > 0) {
    const drawCount = game.pendingDrawCount;
    
    if (game.deck.length < drawCount) {
      const topCard = game.discardPile.pop()!;
      game.deck.push(...game.discardPile);
      game.discardPile = [topCard];
      game.deck = game.deck.sort(() => Math.random() - 0.5);
    }
    
    const drawnCards = game.deck.splice(0, drawCount);
    player.unoHand.push(...drawnCards);
    game.logs.push(`${player.displayName} draws ${drawCount} penalty cards and skips.`);
    
    game.pendingDrawCount = 0;
    game.turnIndex = (game.turnIndex + game.direction + game.players.length) % game.players.length;
    game.turnStartedAt = Date.now();
    return true;
  }

  if (game.deck.length === 0) {
    const topCard = game.discardPile.pop()!;
    game.deck.push(...game.discardPile);
    game.discardPile = [topCard];
    game.deck = game.deck.sort(() => Math.random() - 0.5);
  }

  const drawnCard = game.deck.shift()!;
  player.unoHand.push(drawnCard);
  game.logs.push(`${player.displayName} drew a card.`);
  
  const isPlayable = drawnCard.color === 'wild' || drawnCard.color === game.currentColor || drawnCard.value === game.currentValue;
  if (!isPlayable) {
    game.turnIndex = (game.turnIndex + game.direction + game.players.length) % game.players.length;
    game.turnStartedAt = Date.now();
  }
  
  return true;
}

async function handleUnoBotTurn(game: UnoGame, bot: UnoPlayer) {
  let playableCards: UnoCard[] = [];
  
  if (game.pendingDrawCount > 0) {
    if (game.currentValue === 'draw2') {
      playableCards = bot.unoHand.filter(c => c.value === 'draw2' || c.value === 'draw4');
    } else if (game.currentValue === 'draw4') {
      playableCards = bot.unoHand.filter(c => c.value === 'draw4');
    }
  } else {
    playableCards = bot.unoHand.filter(card => 
      card.color === 'wild' || card.color === game.currentColor || card.value === game.currentValue
    );
  }

  if (playableCards.length > 0) {
    const card = playableCards[Math.floor(Math.random() * playableCards.length)];
    let chosenColor: UnoColor = 'red';
    if (card.color === 'wild') {
      const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
      const counts = colors.map(c => bot.unoHand.filter(h => h.color === c).length);
      chosenColor = colors[counts.indexOf(Math.max(...counts))];
    }

    if (bot.unoHand.length === 2) {
      bot.hasSaidUno = true;
      game.logs.push(`${bot.displayName} said UNO!`);
    }

    await playUnoCard(game, bot, card.id, chosenColor);
  } else {
    drawUnoCard(game, bot);
  }
}

function startCallBreakTurnTimer(game: CallBreakGame) {
  if (game.status !== 'bidding' && game.status !== 'playing') return;

  const existingTimer = cbTurnTimers.get(game.roomId);
  if (existingTimer) clearTimeout(existingTimer);

  game.turnStartedAt = Date.now();

  const timer = setTimeout(() => {
    const g = callBreakGames.get(game.roomId);
    if (!g || g.status !== game.status || g.turnIndex !== game.turnIndex) return;

    const player = g.players[g.turnIndex];
    if (g.status === 'bidding') {
      player.call = 1; // Auto-call 1
      g.logs.push(`${player.displayName} auto-called 1 due to timeout.`);
      
      const allCalled = g.players.every(p => p.call > 0);
      if (allCalled) {
        g.status = 'playing';
        g.turnIndex = (g.dealerIndex + 1) % 4;
        g.logs.push(`Bidding finished. ${g.players[g.turnIndex].displayName} leads.`);
      } else {
        g.turnIndex = (g.turnIndex + 1) % 4;
      }
      startCallBreakTurnTimer(g);
      updateCallBreakGame(g);
    } else if (g.status === 'playing') {
      // Auto-play a valid card
      const validCards = player.hand.filter(c => isValidPlayCB(c, player.hand, g.leadSuit, g.currentTrick));
      if (validCards.length > 0) {
        const cardToPlay = validCards[0]; // Just play the first valid card
        const cardIndex = player.hand.findIndex(c => c.id === cardToPlay.id);
        
        player.hand.splice(cardIndex, 1);
        g.currentTrick.push({ playerUid: player.uid, card: cardToPlay });
        
        if (g.currentTrick.length === 1) {
          g.leadSuit = cardToPlay.suit!;
        }
        g.logs.push(`${player.displayName} auto-played a card due to timeout.`);

        if (g.currentTrick.length === 4) {
          // Trick over
          const winnerUid = evaluateTrickCB(g.currentTrick, g.leadSuit!);
          const winner = g.players.find(p => p.uid === winnerUid)!;
          winner.tricksWon++;
          g.lastTrick = [...g.currentTrick];
          g.lastTrickWinnerId = winnerUid;
          g.currentTrick = [];
          g.leadSuit = null;
          g.turnIndex = g.players.findIndex(p => p.uid === winnerUid);
          g.logs.push(`${winner.displayName} won the trick.`);

          // Check if round over
          if (g.players[0].hand.length === 0) {
            g.status = 'roundEnd';
            g.logs.push(`Round ${g.currentRound} ended.`);
            
            // Calculate scores
            for (const p of g.players) {
              let roundScore = 0;
              if (p.tricksWon >= p.call) {
                roundScore = p.call + (p.tricksWon - p.call) * 0.1;
              } else {
                roundScore = -p.call;
              }
              p.roundScores.push(roundScore);
              p.totalScore += roundScore;
              p.totalScore = Math.round(p.totalScore * 10) / 10;
            }
            // Don't auto-end here, let the host click "Finish Game" to see round scores
          } else {
            startCallBreakTurnTimer(g);
          }
        } else {
          g.turnIndex = (g.turnIndex + 1) % 4;
          startCallBreakTurnTimer(g);
        }
        updateCallBreakGame(g);
      }
    }
  }, (game.config.turnTimer || 30) * 1000);

  cbTurnTimers.set(game.roomId, timer);
}

// --- End Call Break Logic ---

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("presence_update", ({ user }) => {
    if (!user?.uid) return;
    socket.data.uid = user.uid;
    onlineUsers.set(user.uid, {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL
    });
    io.emit("online_count", onlineUsers.size);
    io.emit("online_users", Array.from(onlineUsers.values()));
  });

  socket.on("global_message", async (msg: any) => {
    if (!msg.text?.trim() && msg.type === 'text') return;
    
    const message = {
      id: Math.random().toString(36).substring(7),
      uid: msg.uid,
      displayName: msg.displayName,
      photoURL: msg.photoURL,
      text: msg.text?.substring(0, 500) || "",
      type: msg.type || 'text',
      payload: msg.payload,
      createdAt: Date.now()
    };

    // Persist to Firestore if possible
    const clientDb = (global as any).clientDb;
    if (clientDb) {
      try {
        await clientSetDoc(clientDoc(clientDb, 'chat', message.id), message);
      } catch (err) {
        console.error("[CHAT] Failed to persist message:", err);
      }
    }

    io.emit("global_message", message);
  });

  socket.on("disconnect", () => {
    const uid = socket.data.uid;
    if (uid) {
      onlineUsers.delete(uid);
      io.emit("online_count", onlineUsers.size);
      io.emit("online_users", Array.from(onlineUsers.values()));
    }
    console.log("User disconnected:", socket.id);
  });

  socket.on("joinRoom", async ({ roomId, user, isCreating }) => {
    console.log(`[JOIN] User ${user.displayName} (${user.uid}) attempting to join room ${roomId} (isCreating: ${isCreating})`);
    let game = games.get(roomId);
    
    // If not in memory, try loading from Firestore
    if (!game && !isCreating) {
      game = await loadGame(roomId);
      if (game) {
        console.log(`[RESTORE] Room ${roomId} restored from Firestore`);
        games.set(roomId, game);
      }
    }
    
    if (!game) {
      if (isCreating) {
        game = {
          roomId,
          hostId: user.uid,
          status: 'waiting',
          players: [],
          deck: [],
          discardPile: [],
          tempDiscardPile: [],
          turnIndex: 0,
          wildRank: null,
          config: {
            maxPlayers: 15,
            callLimit: 10,
            eliminationLimit: 200,
            penaltyValue: 40,
            turnTimer: 30
          },
          winnerId: null,
          roundNumber: 0,
          roundScores: [],
          logs: [`Room ${roomId} created.`],
          turnStartedAt: Date.now(),
          jokerCard: null,
          lastRoundWinnerId: null,
          lastRoundCallerId: null,
          lastRoundCaughtId: null
        };
        games.set(roomId, game);
        await persistGame(game);
      } else {
        console.log(`[ERROR] Room ${roomId} not found for user ${user.displayName}`);
        socket.emit('error', { message: 'Room not found. Check the ID and try again.' });
        return;
      }
    }

    socket.join(roomId);
    socket.data.uid = user.uid;
    socket.data.roomId = roomId;

    if (!game.players.find(p => p.uid === user.uid)) {
      if (game.players.length < game.config.maxPlayers) {
        game.players.push({
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          hand: [],
          score: 0,
          totalScore: 0,
          isBot: false,
          isReady: false,
          isAway: false,
          isInRound: false,
          lastActionAt: Date.now(),
          hasDiscarded: false
        });
        game.logs.push(`${user.displayName} joined.`);
        
        // If game is already in progress, they'll wait for next round
        if (game.status !== 'waiting') {
          game.logs.push(`${user.displayName} is spectating until next round.`);
        }
      } else {
        console.log(`[ERROR] Room ${roomId} is full. User ${user.displayName} denied.`);
        socket.emit('error', { message: 'Room is full.' });
        return;
      }
    } else {
      // Re-joining player
      const player = game.players.find(p => p.uid === user.uid);
      if (player) {
        player.isAway = false;
        player.lastActionAt = Date.now();
        game.logs.push(`${user.displayName} reconnected.`);
      }
    }

    updateGame(game);
  });

  socket.on("addBot", ({ roomId, difficulty }) => {
    const game = games.get(roomId);
    if (!game) return;

    if (game.players.length < game.config.maxPlayers) {
      const botId = `bot-${Math.random().toString(36).substring(2, 6)}`;
      game.players.push({
        uid: botId,
        displayName: `Bot (${difficulty})`,
        hand: [],
        score: 0,
        totalScore: 0,
        isBot: true,
        isReady: true,
        isAway: false,
        isInRound: false,
        lastActionAt: Date.now(),
        hasDiscarded: false
      });
      updateGame(game);
    }
  });

  socket.on("updateConfig", ({ roomId, config }) => {
    const game = games.get(roomId);
    if (game && game.status === 'waiting') {
      game.config = { ...game.config, ...config };
      game.logs.push(`Host updated game configuration.`);
      updateGame(game);
    }
  });

  socket.on("startGame", ({ roomId }) => {
    const game = games.get(roomId);
    if (!game) return;
    startRound(game);
    updateGame(game);
  });

  socket.on("discard", ({ roomId, playerUid, cardIds }) => {
    const game = games.get(roomId);
    if (!game) return;
    handleDiscard(game, playerUid, cardIds);
    updateGame(game);
  });

  socket.on("draw", ({ roomId, playerUid, source }) => {
    const game = games.get(roomId);
    if (!game) return;
    handleDraw(game, playerUid, source);
    updateGame(game);
  });

  socket.on("call", async ({ roomId, playerUid }) => {
    const game = games.get(roomId);
    if (!game) return;
    await handleCall(game, playerUid);
    updateGame(game);
  });

  socket.on("nextRound", ({ roomId }) => {
    const game = games.get(roomId);
    if (!game) return;
    startRound(game);
    updateGame(game);
  });

  socket.on("chatMessage", ({ text, userName }) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      io.to(roomId).emit('chatMessage', { userName, text });
    }
  });

  socket.on("sendEmoji", ({ emoji }) => {
    const roomId = socket.data.roomId;
    const userId = socket.data.uid;
    console.log(`[EMOJI_DEBUG] Received sendEmoji from ${userId} in room ${roomId}: ${emoji}`);
    if (roomId && userId) {
      const game = games.get(roomId);
      const playerUids = game ? game.players.map(p => p.uid) : [];
      const clients = io.sockets.adapter.rooms.get(roomId);
      const numClients = clients ? clients.size : 0;
      console.log(`[EMOJI] Broadcasting emojiUpdate for ${userId} in room ${roomId} (${numClients} clients). Players in game state: ${JSON.stringify(playerUids)}`);
      io.to(roomId).emit('emojiUpdate', { userId, emoji });
    } else {
      console.error(`[EMOJI_ERROR] Missing roomId (${roomId}) or userId (${userId}) for socket ${socket.id}`);
    }
  });

  socket.on("sendReactionSound", ({ sound }) => {
    const roomId = socket.data.roomId;
    const userId = socket.data.uid;
    console.log(`[SOUND_DEBUG] Received sendReactionSound from ${userId} in room ${roomId}: ${sound}`);
    if (roomId && userId) {
      const clients = io.sockets.adapter.rooms.get(roomId);
      const numClients = clients ? clients.size : 0;
      console.log(`[SOUND] Broadcasting reactionSoundUpdate to room ${roomId} (${numClients} clients)`);
      io.to(roomId).emit('reactionSoundUpdate', { userId, sound });
    } else {
      console.error(`[SOUND_ERROR] Missing roomId (${roomId}) or userId (${userId}) for socket ${socket.id}`);
    }
  });

  socket.on("setAway", ({ roomId, isAway }) => {
    const game = games.get(roomId);
    if (!game) return;
    const player = game.players.find(p => p.uid === socket.data.uid);
    if (player) {
      player.isAway = isAway;
      game.logs.push(`${player.displayName} is ${isAway ? 'away' : 'back'}.`);
      updateGame(game);
      
      // If they are away and it's their turn, trigger bot turn
      if (isAway && game.players[game.turnIndex]?.uid === player.uid && game.status === 'playing') {
        handleBotTurn(game, player);
      }
    }
  });

  socket.on("leaveRoom", async ({ roomId, user }) => {
    const game = games.get(roomId);
    if (game) {
      game.players = game.players.filter(p => p.uid !== user.uid);
      game.logs.push(`${user.displayName} left.`);
      
      // If no players left, delete the room
      if (game.players.length === 0) {
        games.delete(roomId);
        deleteGame(roomId);
        if (turnTimers.has(roomId)) {
          clearTimeout(turnTimers.get(roomId)!);
          turnTimers.delete(roomId);
        }
        if (showdownTimers.has(roomId)) {
          clearTimeout(showdownTimers.get(roomId)!);
          showdownTimers.delete(roomId);
        }
      } else {
        // If only one human player left, end the game
        const humanPlayers = game.players.filter(p => !p.isBot);
        if (humanPlayers.length === 1 && (game.status === 'playing' || game.status === 'showdown')) {
          game.status = 'ended';
          game.winnerId = humanPlayers[0].uid;
          game.logs.push(`Game Over! ${humanPlayers[0].displayName} is the last player standing.`);
          console.log(`[GAME] Game ${game.roomId} ended due to player leaving. Winner: ${game.winnerId}. Finalizing profiles...`);
          await finalizeUserProfiles(game, 'leastcount');
        } else if (humanPlayers.length === 0) {
          // Only bots left, delete the room
          games.delete(roomId);
          deleteGame(roomId);
        }
        updateGame(game);
      }
    }
    socket.leave(roomId);
    socket.data.roomId = null;
  });

  // --- Call Break Socket Handlers ---
  socket.on("cb_joinRoom", async ({ roomId, user, isCreating }) => {
    console.log(`[CB_JOIN] User ${user.displayName} joining Call Break room ${roomId}`);
    let game = callBreakGames.get(roomId);

    if (!game) {
      if (isCreating) {
        game = {
          roomId,
          hostId: user.uid,
          status: 'waiting',
          players: [],
          config: { rounds: 5, maxPlayers: 4, turnTimer: 30 },
          currentRound: 0,
          turnIndex: 0,
          dealerIndex: 0,
          leadSuit: null,
          currentTrick: [],
          logs: [],
          turnStartedAt: Date.now()
        };
        callBreakGames.set(roomId, game);
      } else {
        socket.emit("error", "Room not found");
        return;
      }
    } else if (isCreating && game.hostId !== user.uid) {
      socket.emit("error", "Room already exists");
      return;
    }

    if (game.status !== 'waiting' && !game.players.find(p => p.uid === user.uid)) {
      socket.emit("error", "Game already in progress");
      return;
    }

    if (game.players.length >= game.config.maxPlayers && !game.players.find(p => p.uid === user.uid)) {
      socket.emit("error", "Room is full");
      return;
    }

    socket.join(roomId);
    socket.data.uid = user.uid;
    socket.data.roomId = roomId;
    socket.data.gameType = 'callbreak';

    const existingPlayer = game.players.find(p => p.uid === user.uid);
    if (existingPlayer) {
      existingPlayer.isAway = false;
    } else {
      game.players.push({
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        hand: [],
        score: 0,
        totalScore: 0,
        isBot: false,
        isReady: false,
        isAway: false,
        isInRound: true,
        lastActionAt: Date.now(),
        hasDiscarded: false,
        call: 0,
        tricksWon: 0,
        roundScores: []
      });
      game.logs.push(`${user.displayName} joined the game.`);
    }

    updateCallBreakGame(game);
  });

  socket.on("cb_addBot", ({ roomId }) => {
    const game = callBreakGames.get(roomId);
    if (game && game.hostId === socket.data.uid && game.status === 'waiting') {
      if (game.players.length < 4) {
        const botId = `cb-bot-${Math.random().toString(36).substring(2, 6)}`;
        game.players.push({
          uid: botId,
          displayName: `Bot ${game.players.length}`,
          photoURL: null,
          hand: [],
          score: 0,
          totalScore: 0,
          isBot: true,
          isReady: true,
          isAway: false,
          isInRound: true,
          lastActionAt: Date.now(),
          hasDiscarded: false,
          call: 0,
          tricksWon: 0,
          roundScores: []
        });
        game.logs.push(`Bot ${game.players.length - 1} joined.`);
        updateCallBreakGame(game);
      }
    }
  });

  socket.on("cb_updateSettings", ({ roomId, settings }) => {
    const game = callBreakGames.get(roomId);
    if (game && game.hostId === socket.data.uid && game.status === 'waiting') {
      game.config = { ...game.config, ...settings };
      updateCallBreakGame(game);
    }
  });

  socket.on("cb_startGame", ({ roomId }) => {
    const game = callBreakGames.get(roomId);
    if (game && game.hostId === socket.data.uid && game.players.length === 4) {
      game.status = 'bidding';
      game.currentRound = 1;
      game.dealerIndex = Math.floor(Math.random() * 4);
      game.turnIndex = (game.dealerIndex + 1) % 4;
      game.logs.push(`Game started! Round ${game.currentRound} begins.`);
      
      // Deal cards
      const deck = createCallBreakDeck();
      for (let i = 0; i < 4; i++) {
        game.players[i].hand = deck.slice(i * 13, (i + 1) * 13);
        // Sort hand: Spades, Hearts, Clubs, Diamonds, then by value
        game.players[i].hand.sort((a, b) => {
          const suitOrder = { 'spades': 1, 'hearts': 2, 'clubs': 3, 'diamonds': 4 };
          if (suitOrder[a.suit!] !== suitOrder[b.suit!]) {
            return suitOrder[a.suit!] - suitOrder[b.suit!];
          }
          return b.value - a.value;
        });
        game.players[i].call = 0;
        game.players[i].tricksWon = 0;
      }
      
      startCallBreakTurnTimer(game);
      updateCallBreakGame(game);

      // Handle first bot bidding
      const firstPlayer = game.players[game.turnIndex];
      if (firstPlayer.isBot) {
        setTimeout(() => handleCallBreakBotBidding(game, firstPlayer), 1000);
      }
    }
  });

  socket.on("cb_makeCall", ({ roomId, call }) => {
    const game = callBreakGames.get(roomId);
    if (game && game.status === 'bidding') {
      const player = game.players[game.turnIndex];
      if (player.uid === socket.data.uid) {
        player.call = call;
        game.logs.push(`${player.displayName} called ${call}.`);
        
        const allCalled = game.players.every(p => p.call > 0);
        if (allCalled) {
          game.status = 'playing';
          game.turnIndex = (game.dealerIndex + 1) % 4;
          game.logs.push(`Bidding finished. ${game.players[game.turnIndex].displayName} leads.`);
        } else {
          game.turnIndex = (game.turnIndex + 1) % 4;
        }
        
        startCallBreakTurnTimer(game);
        updateCallBreakGame(game);

        // Handle next bot bidding or turn
        const nextPlayer = game.players[game.turnIndex];
        if (game.status === 'bidding' && nextPlayer.isBot) {
          setTimeout(() => handleCallBreakBotBidding(game, nextPlayer), 1000);
        } else if (game.status === 'playing' && nextPlayer.isBot) {
          setTimeout(() => handleCallBreakBotTurn(game, nextPlayer), 1000);
        }
      }
    }
  });

  socket.on("cb_playCard", ({ roomId, cardId }) => {
    const game = callBreakGames.get(roomId);
    if (game && game.status === 'playing') {
      const player = game.players[game.turnIndex];
      if (player.uid === socket.data.uid) {
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
          const card = player.hand[cardIndex];
          
          if (!isValidPlayCB(card, player.hand, game.leadSuit, game.currentTrick)) {
            socket.emit("error", "Invalid play according to Call Break rules.");
            return;
          }

          player.hand.splice(cardIndex, 1);
          game.currentTrick.push({ playerUid: player.uid, card });
          
          if (game.currentTrick.length === 1) {
            game.leadSuit = card.suit!;
          }

          if (game.currentTrick.length === 4) {
            // Trick over
            game.status = 'trickEnd';
            const winnerUid = evaluateTrickCB(game.currentTrick, game.leadSuit!);
            const winner = game.players.find(p => p.uid === winnerUid)!;
            winner.tricksWon++;
            game.lastTrick = [...game.currentTrick];
            game.lastTrickWinnerId = winnerUid;
            game.logs.push(`${winner.displayName} won the trick.`);
            
            updateCallBreakGame(game);

            setTimeout(() => {
              const g = callBreakGames.get(roomId);
              if (!g || g.status !== 'trickEnd') return;

              g.currentTrick = [];
              g.leadSuit = null;
              g.turnIndex = g.players.findIndex(p => p.uid === winnerUid);

              // Check if round over
              if (g.players[0].hand.length === 0) {
                g.status = 'roundEnd';
                g.logs.push(`Round ${g.currentRound} ended.`);
                
                // Calculate scores
                for (const p of g.players) {
                  let roundScore = 0;
                  if (p.tricksWon >= p.call) {
                    roundScore = p.call + (p.tricksWon - p.call) * 0.1;
                  } else {
                    roundScore = -p.call;
                  }
                  p.roundScores.push(roundScore);
                  p.totalScore += roundScore;
                  p.totalScore = Math.round(p.totalScore * 10) / 10;
                }
              } else {
                g.status = 'playing';
                startCallBreakTurnTimer(g);
              }
              
              updateCallBreakGame(g);

              // Handle next bot turn
              if (g.status === 'playing') {
                const nextPlayer = g.players[g.turnIndex];
                if (nextPlayer.isBot) {
                  setTimeout(() => handleCallBreakBotTurn(g, nextPlayer), 1000);
                }
              }
            }, 1500);
            return;
          } else {
            game.turnIndex = (game.turnIndex + 1) % 4;
            startCallBreakTurnTimer(game);
          }
          
          updateCallBreakGame(game);

          // Handle next bot turn
          const nextPlayer = game.players[game.turnIndex];
          if (game.status === 'playing' && nextPlayer.isBot) {
            setTimeout(() => handleCallBreakBotTurn(game, nextPlayer), 1000);
          }
        }
      }
    }
  });

  socket.on("cb_nextRound", async ({ roomId }) => {
    const game = callBreakGames.get(roomId);
    if (game && game.status === 'roundEnd' && game.hostId === socket.data.uid) {
      if (game.currentRound >= game.config.rounds) {
        game.status = 'ended';
        const sortedPlayers = [...game.players].sort((a, b) => b.totalScore - a.totalScore);
        game.winnerId = sortedPlayers[0].uid;
        game.logs.push(`Game Over! ${sortedPlayers[0].displayName} wins!`);
        await finalizeUserProfiles(game, 'callbreak');
        updateCallBreakGame(game);
        return;
      }

      game.currentRound++;
      game.status = 'bidding';
      game.dealerIndex = (game.dealerIndex + 1) % 4;
      game.turnIndex = (game.dealerIndex + 1) % 4;
      game.lastTrick = undefined;
      game.lastTrickWinnerId = undefined;
      
      const deck = createCallBreakDeck();
      for (let i = 0; i < 4; i++) {
        game.players[i].hand = deck.slice(i * 13, (i + 1) * 13);
        game.players[i].hand.sort((a, b) => {
          const suitOrder = { 'spades': 1, 'hearts': 2, 'clubs': 3, 'diamonds': 4 };
          if (suitOrder[a.suit!] !== suitOrder[b.suit!]) {
            return suitOrder[a.suit!] - suitOrder[b.suit!];
          }
          return b.value - a.value;
        });
        game.players[i].call = 0;
        game.players[i].tricksWon = 0;
      }
      
      game.logs.push(`Round ${game.currentRound} begins.`);
      startCallBreakTurnTimer(game);
      updateCallBreakGame(game);

      // Handle first bot bidding
      const firstPlayer = game.players[game.turnIndex];
      if (firstPlayer.isBot) {
        setTimeout(() => handleCallBreakBotBidding(game, firstPlayer), 1000);
      }
    }
  });

  socket.on("cb_leaveRoom", async ({ roomId, user }) => {
    const game = callBreakGames.get(roomId);
    if (game) {
      game.players = game.players.filter(p => p.uid !== user.uid);
      game.logs.push(`${user.displayName} left the game.`);
      
      if (game.players.length === 0) {
        callBreakGames.delete(roomId);
      } else {
        if (game.hostId === user.uid) {
          game.hostId = game.players[0].uid;
        }
        
        if (game.status !== 'waiting' && game.status !== 'ended') {
          game.status = 'ended';
          game.logs.push("Game ended because a player left.");
          await finalizeUserProfiles(game, 'callbreak');
        }
        
        updateCallBreakGame(game);
      }
    }
    socket.leave(roomId);
    if (socket.data.gameType === 'callbreak') {
      socket.data.roomId = null;
      socket.data.gameType = null;
    }
  });

  // --- Uno Socket Handlers ---
  socket.on("uno_joinRoom", async ({ roomId, user, isCreating }) => {
    console.log(`[UNO_JOIN] User ${user.displayName} joining Uno room ${roomId}, isCreating: ${isCreating}`);
    let game = unoGames.get(roomId);

    if (!game) {
      if (isCreating) {
        game = {
          roomId,
          hostId: user.uid,
          status: 'waiting',
          players: [],
          deck: [],
          discardPile: [],
          turnIndex: 0,
          direction: 1,
          currentColor: 'red',
          currentValue: '0',
          winnerId: null,
          logs: [],
          turnStartedAt: Date.now(),
          pendingDrawCount: 0,
          config: { maxPlayers: 10, turnTimer: 30, scoreLimit: 500 }
        };
        unoGames.set(roomId, game);
      } else {
        console.log(`[UNO_ERROR] Room ${roomId} not found for join request from ${user.displayName}`);
        socket.emit("error", "Room not found");
        return;
      }
    } else if (isCreating && game.hostId !== user.uid) {
      socket.emit("error", "Room already exists");
      return;
    }

    if (game.status !== 'waiting' && !game.players.find(p => p.uid === user.uid)) {
      socket.emit("error", "Game already in progress");
      return;
    }

    if (game.players.length >= game.config.maxPlayers && !game.players.find(p => p.uid === user.uid)) {
      socket.emit("error", "Room is full");
      return;
    }

    socket.join(roomId);
    socket.data.uid = user.uid;
    socket.data.roomId = roomId;
    socket.data.gameType = 'uno';

    const existingPlayer = game.players.find(p => p.uid === user.uid);
    if (existingPlayer) {
      existingPlayer.isAway = false;
    } else {
      game.players.push({
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        hand: [], // For compatibility
        unoHand: [],
        score: 0,
        totalScore: 0,
        isBot: false,
        isReady: false,
        isAway: false,
        isInRound: true,
        lastActionAt: Date.now(),
        hasDiscarded: false,
        hasSaidUno: false
      });
      game.logs.push(`${user.displayName} joined the game.`);
    }

    updateUnoGame(game);
  });

  socket.on("uno_startGame", ({ roomId }) => {
    const game = unoGames.get(roomId);
    if (game && game.hostId === socket.data.uid && game.players.length >= 2) {
      game.status = 'playing';
      game.deck = createUnoDeck();
      game.discardPile = [];
      game.direction = 1;
      game.turnIndex = 0;
      game.pendingDrawCount = 0;
      game.logs.push(`Game started!`);

      // Deal 7 cards to each player
      game.players.forEach(player => {
        player.unoHand = game.deck.splice(0, 7);
        player.hasSaidUno = false;
      });

      // Start discard pile
      let firstCard = game.deck.shift()!;
      while (firstCard.color === 'wild') {
        game.deck.push(firstCard);
        game.deck = game.deck.sort(() => Math.random() - 0.5);
        firstCard = game.deck.shift()!;
      }
      game.discardPile.push(firstCard);
      game.currentColor = firstCard.color;
      game.currentValue = firstCard.value;

      // Handle first card action
      if (firstCard.value === 'skip') {
        game.turnIndex = (game.turnIndex + 1) % game.players.length;
        game.logs.push(`First card is Skip. ${game.players[0].displayName} skipped.`);
      } else if (firstCard.value === 'reverse') {
        if (game.players.length === 2) {
          game.turnIndex = (game.turnIndex + 1) % game.players.length;
          game.logs.push(`First card is Reverse. Acts as Skip in 2-player game.`);
        } else {
          game.direction = -1;
          game.turnIndex = game.players.length - 1;
          game.logs.push(`First card is Reverse. Direction changed.`);
        }
      } else if (firstCard.value === 'draw2') {
        game.pendingDrawCount = 2;
        game.logs.push(`First card is Draw Two. ${game.players[0].displayName} must stack or draw 2.`);
      } else if (firstCard.value === 'draw4') {
        game.pendingDrawCount = 4;
        game.logs.push(`First card is Draw Four. ${game.players[0].displayName} must stack or draw 4.`);
      }

      game.turnStartedAt = Date.now();
      updateUnoGame(game);
    }
  });

  socket.on("uno_playCard", async ({ roomId, cardId, chosenColor }) => {
    const game = unoGames.get(roomId);
    if (game && game.status === 'playing') {
      const player = game.players[game.turnIndex];
      if (player.uid === socket.data.uid) {
        if (await playUnoCard(game, player, cardId, chosenColor)) {
          updateUnoGame(game);
        }
      }
    }
  });

  socket.on("uno_drawCard", ({ roomId }) => {
    const game = unoGames.get(roomId);
    if (game && game.status === 'playing') {
      const player = game.players[game.turnIndex];
      if (player.uid === socket.data.uid) {
        if (drawUnoCard(game, player)) {
          updateUnoGame(game);
        }
      }
    }
  });

  socket.on("uno_addBot", ({ roomId }) => {
    const game = unoGames.get(roomId);
    if (game && game.hostId === socket.data.uid && game.status === 'waiting') {
      if (game.players.length < game.config.maxPlayers) {
        const botId = `uno-bot-${Math.random().toString(36).substring(2, 6)}`;
        game.players.push({
          uid: botId,
          displayName: `Bot ${game.players.length}`,
          photoURL: null,
          hand: [],
          unoHand: [],
          score: 0,
          totalScore: 0,
          isBot: true,
          isReady: true,
          isAway: false,
          isInRound: true,
          lastActionAt: Date.now(),
          hasDiscarded: false,
          hasSaidUno: false
        });
        game.logs.push(`Bot ${game.players.length - 1} joined.`);
        updateUnoGame(game);
      }
    }
  });

  socket.on("uno_sayUno", ({ roomId }) => {
    const game = unoGames.get(roomId);
    if (game && game.status === 'playing') {
      const player = game.players.find(p => p.uid === socket.data.uid);
      if (player && player.unoHand.length <= 2) {
        player.hasSaidUno = true;
        game.logs.push(`${player.displayName} said UNO!`);
        updateUnoGame(game);
      }
    }
  });

  socket.on("uno_sendReaction", ({ roomId, emoji }) => {
    io.to(roomId).emit("uno_reaction", { uid: socket.data.uid, emoji });
  });

  socket.on("uno_sendSound", ({ roomId, soundId }) => {
    io.to(roomId).emit("uno_sound", { uid: socket.data.uid, soundId });
  });

  socket.on("uno_leaveRoom", async ({ roomId, user }) => {
    const game = unoGames.get(roomId);
    if (game) {
      game.players = game.players.filter(p => p.uid !== user.uid);
      game.logs.push(`${user.displayName} left the game.`);
      
      if (game.players.length === 0) {
        unoGames.delete(roomId);
      } else {
        if (game.hostId === user.uid) {
          game.hostId = game.players[0].uid;
        }
        
        if (game.status !== 'waiting' && game.status !== 'ended') {
          game.status = 'ended';
          game.logs.push("Game ended because a player left.");
          await finalizeUserProfiles(game, 'uno');
        }
        
        updateUnoGame(game);
      }
    }
    socket.leave(roomId);
    if (socket.data.gameType === 'uno') {
      socket.data.roomId = null;
      socket.data.gameType = null;
    }
  });

  // --- End Uno Socket Handlers ---

  socket.on("disconnect", async () => {
    const { uid, roomId, gameType } = socket.data;
    if (uid && roomId) {
      if (gameType === 'callbreak') {
        const game = callBreakGames.get(roomId);
        if (game) {
          const player = game.players.find(p => p.uid === uid);
          if (player) {
            player.isAway = true;
            game.logs.push(`${player.displayName} disconnected.`);
            
            const humanPlayers = game.players.filter(p => !p.isBot);
            const allAway = humanPlayers.every(p => p.isAway);
            
            if (allAway) {
              console.log(`[GAME] All human players away in ${roomId}. Ending game in 30s...`);
              setTimeout(async () => {
                const g = callBreakGames.get(roomId);
                if (g && g.players.filter(p => !p.isBot).every(p => p.isAway)) {
                  console.log(`[GAME] Game ${roomId} ended due to all players away.`);
                  g.status = 'ended';
                  g.logs.push("Game ended because all players disconnected.");
                  await finalizeUserProfiles(g, 'callbreak');
                  updateCallBreakGame(g);
                  callBreakGames.delete(roomId);
                }
              }, 30000);
            }
            
            updateCallBreakGame(game);
          }
        }
      } else if (gameType === 'uno') {
        const game = unoGames.get(roomId);
        if (game) {
          const player = game.players.find(p => p.uid === uid);
          if (player) {
            player.isAway = true;
            game.logs.push(`${player.displayName} disconnected.`);
            
            const humanPlayers = game.players.filter(p => !p.isBot);
            const allAway = humanPlayers.every(p => p.isAway);
            
            if (allAway) {
              console.log(`[GAME] All human players away in ${roomId}. Ending game in 30s...`);
              setTimeout(async () => {
                const g = unoGames.get(roomId);
                if (g && g.players.filter(p => !p.isBot).every(p => p.isAway)) {
                  console.log(`[GAME] Game ${roomId} ended due to all players away.`);
                  g.status = 'ended';
                  g.logs.push("Game ended because all players disconnected.");
                  await finalizeUserProfiles(g, 'uno');
                  updateUnoGame(g);
                  unoGames.delete(roomId);
                }
              }, 30000);
            }
            
            updateUnoGame(game);
          }
        }
      } else {
        const game = games.get(roomId);
        if (game) {
          const player = game.players.find(p => p.uid === uid);
          if (player) {
            player.isAway = true;
            player.lastActionAt = Date.now();
            game.logs.push(`${player.displayName} disconnected.`);
            
            // If all human players are away, end the game after a timeout
            const humanPlayers = game.players.filter(p => !p.isBot);
            const allAway = humanPlayers.every(p => p.isAway);
            
            if (allAway) {
              console.log(`[GAME] All human players away in ${roomId}. Ending game in 30s...`);
              setTimeout(async () => {
                const g = games.get(roomId);
                if (g && g.players.filter(p => !p.isBot).every(p => p.isAway)) {
                  g.status = 'ended';
                  g.winnerId = g.players.find(p => !p.isBot)?.uid || g.players[0].uid;
                  g.logs.push("Game ended because all players are away.");
                  console.log(`[GAME] Game ${g.roomId} ended due to inactivity. Finalizing profiles...`);
                  await finalizeUserProfiles(g, 'leastcount');
                  updateGame(g);
                }
              }, 30000);
            }
            
            updateGame(game);
          }
        }
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// Vite middleware for development
async function startServer() {
  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
  
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully bound to 0.0.0.0:${PORT}`);
    console.log(`Access the app at http://localhost:${PORT}`);
  });
}

startServer();
