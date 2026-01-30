import { Room, Player } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Extended Room interface for server-side only to store secret word
export interface ServerRoom extends Room {
    secretWord: string | null;
    timer: NodeJS.Timeout | null;
    drawnPlayers: string[]; // Track who has drawn in the current Round
}

const WORDS = [
    'APPLE', 'BANANA', 'CAT', 'DOG', 'ELEPHANT', 'FISH', 'GUITAR', 'HOUSE', 'ICE CREAM',
    'JELLYFISH', 'KITE', 'LION', 'MOON', 'NEST', 'OCTOPUS', 'PENGUIN', 'QUEEN', 'ROBOT',
    'SUN', 'TREE', 'UMBRELLA', 'VIOLIN', 'WHALE', 'XYLOPHONE', 'YACHT', 'ZEBRA', 'CAR',
    'BUS', 'TRAIN', 'AIRPLANE', 'BOAT', 'BIKE', 'COMPUTER', 'PHONE', 'BOOK', 'PEN', 'PENCIL'
];

class RoomManager {
    private rooms: Map<string, ServerRoom> = new Map();

    createRoom(username: string, avatar: string, socketId: string, drawTime: number = 60, rounds: number = 3): Room {
        const roomId = uuidv4().slice(0, 6).toUpperCase();
        
        const newRoom: ServerRoom = {
            id: roomId,
            players: [{
                id: socketId, // Use socketId as player ID for simplicity initially, or uuid
                socketId: socketId,
                name: username,
                score: 0,
                isHost: true,
                avatar: avatar
            }],
            status: 'lobby',
            currentRound: 1,
            totalRounds: rounds,
            drawTime: drawTime,
            currentDrawerId: null,
            currentWord: null, // Public masked word
            secretWord: null,
            wordsToChoose: [],
            maxPlayers: 8,
            hints: 2,            
            roundPhase: null,            
            roundStartTime: null,
            guessedCorrectly: [],
            canvasHistory: [],
            timer: null,
            drawnPlayers: []
        };

        this.rooms.set(roomId, newRoom);
        return this.getPublicRoom(newRoom);
    }

    joinRoom(roomId: string, username: string, avatar: string, socketId: string): Room | { error: string } {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { error: 'Room not found' };
        }

        if (room.players.length >= room.maxPlayers) {
            return { error: 'Room is full' };
        }

        // Allow duplicate names as requested. 
        
        const newPlayer: Player = {
            id: socketId,
            socketId: socketId,
            name: username,
            score: 0,
            isHost: false, // Only first one is host
            avatar: avatar
        };

        room.players.push(newPlayer);
        return this.getPublicRoom(room);
    }

    leaveRoom(roomId: string, socketId: string): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const playerIndex = room.players.findIndex(p => p.socketId === socketId);
        if (playerIndex === -1) return this.getPublicRoom(room);

        const wasHost = room.players[playerIndex].isHost;
        const wasDrawer = room.currentDrawerId === socketId;

        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
            if (room.timer) clearInterval(room.timer);
            this.rooms.delete(roomId);
            return null;
        }

        if (wasHost) {
            // Assign new host randomly
            const newHostIndex = Math.floor(Math.random() * room.players.length);
            room.players[newHostIndex].isHost = true;
        }

        if (wasDrawer && room.status === 'playing') {
            // End round early if drawer leaves
            this.endRound(roomId);
        }

        return this.getPublicRoom(room);
    }

    getRoom(roomId: string): ServerRoom | undefined {
        return this.rooms.get(roomId);
    }
    
    // Returns sanitized room object safely for clients
    getPublicRoom(room: ServerRoom): Room {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { secretWord, timer, ...publicRoom } = room;
        // Mask wordsToChoose to prevent guessers looking at network tab
        return {
            ...publicRoom,
            wordsToChoose: [] 
        };
    }

    // New Game Logic
    startGame(roomId: string): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        if (room.timer) clearInterval(room.timer);

        room.status = 'playing';
        room.currentRound = 1;
        room.drawnPlayers = [];
        room.roundPhase = 'starting';
        
        // 3 Seconds countdown before first turn
        let countdown = 3;
        
        // Emit initial state
        if (this.onRoomUpdate) this.onRoomUpdate(roomId, this.getPublicRoom(room));
        if (this.onTick) this.onTick(roomId, countdown);

        room.timer = setInterval(() => {
            countdown--;
            if (this.onTick) this.onTick(roomId, countdown);
            
            if (countdown <= 0) {
                 if (room.timer) clearInterval(room.timer);
                 this.startNewRound(roomId);
            }
        }, 1000);

        return this.getPublicRoom(room);
    }

    startNewRound(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        if (room.timer) clearInterval(room.timer);

        // Check if current "round" (sequence where everyone draws) is complete
        // Filter out players who might have left
        const activePlayerIds = room.players.map(p => p.id);
        // Clean up drawnPlayers (remove IDs of people who left)
        room.drawnPlayers = room.drawnPlayers.filter(id => activePlayerIds.includes(id));

        if (room.drawnPlayers.length >= room.players.length) {
            // Everyone has drawn, increment round
            room.currentRound++;
            room.drawnPlayers = [];
            
            if (room.currentRound > room.totalRounds) {
                room.status = 'ended';
                room.roundPhase = null;
                room.currentDrawerId = null;
                if (this.onRoomUpdate) this.onRoomUpdate(roomId, this.getPublicRoom(room));
                return null;
            }
        }

        // Reset Turn State
        room.guessedCorrectly = [];
        room.canvasHistory = [];
        room.currentWord = null;
        room.secretWord = null;

        // Pick Drawer from those who haven't drawn this round
        const availableDrawers = room.players.filter(p => !room.drawnPlayers.includes(p.id));
        if (availableDrawers.length === 0) {
             // Should not happen due to logic above, but fallback
             // Force reset if something glitchy happened
             room.drawnPlayers = [];
             this.startNewRound(roomId);
             return;
        }

        const drawerIndex = Math.floor(Math.random() * availableDrawers.length);
        const drawer = availableDrawers[drawerIndex];
        room.currentDrawerId = drawer.id;
        room.drawnPlayers.push(drawer.id);

        // Pick 3 Words
        const options: string[] = [];
        for(let i=0; i<3; i++) {
             options.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
        }
        room.wordsToChoose = options;
        room.roundPhase = 'selecting';
        
        // Notify socket.ts to send options to drawer (via onRoomUpdate or separately)
        if (this.onRoomUpdate) {
             this.onRoomUpdate(roomId, this.getPublicRoom(room));
        }

        // Start Selection Timer (5s)
        let timeLeft = 5;
        if (this.onTick) this.onTick(roomId, timeLeft);
        
        room.timer = setInterval(() => {
            timeLeft--;
             if (this.onTick) this.onTick(roomId, timeLeft);
             
            if (timeLeft <= 0) {
                 // Auto select first word
                 this.selectWord(roomId, options[0]);
            }
        }, 1000);
        
        return { drawerId: drawer.id, options };
    }

    selectWord(roomId: string, word: string): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        if (room.timer) clearInterval(room.timer);

        room.secretWord = word;
        room.currentWord = word.replace(/[^\s]/g, '_ '); // Keep spaces
        room.roundPhase = 'drawing';
        room.wordsToChoose = []; // Clear options
        room.roundStartTime = Date.now();

        // Start Drawing Timer
        let timeLeft = room.drawTime; 
        
        // We need a way to emit updates! 
        // We will attach a callback or simple "tick" function?
        // Since I cannot change socket.ts injection easily right now, 
        // I'll stick to logic here and socket.ts just handles user interactions.
        // However, the TIMER Ticks need to go to clients.
        // "processTick" method called by interval? 
        
        // Hack: The RoomManager doesn't emit. 
        // I will make the Room object accessible and let socket.ts set up the interval? 
        // No, game logic should be here.
        // I will add an callback to startNewRound/selectWord? 
        
        // For this task, I will assume socket.ts polls or I will inject a simplified event emitter.
        // OR: I will just manage the state transitions here. The "timer_update" 
        // is technically handled by `setInterval` inside `RoomManager` 
        // but `RoomManager` has no `io`.
        
        // Let's attach an optional `onTick` handler to the room or manager?
        // I will add `setEventEmitter(callback)` to RoomManager.
        
        room.timer = setInterval(() => {
            timeLeft--;
            if (this.onTick) this.onTick(roomId, timeLeft);
            
            if (timeLeft <= 0) {
                 this.endRound(roomId);
            }
        }, 1000);

        if (this.onRoomUpdate) this.onRoomUpdate(roomId, this.getPublicRoom(room));

        return this.getPublicRoom(room);
    }
    
    // Callback hooks
    public onTick?: (roomId: string, timeLeft: number) => void; 
    // Changing method usage in socket.ts might be cleaner.
    
    // Actually, socket.ts already has `start_game` which calls `startGame`.
    // But `selectWord` is called asynchronously by timer (auto pick).
    // So `roomController` needs a way to push to `socket`.
    
    // I will add `onRoomUpdate` callback.
    public onRoomUpdate?: (roomId: string, room: Room) => void;
    public onTimerUpdate?: (roomId: string, time: number) => void;

    endRound(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        if (room.timer) clearInterval(room.timer);
        
        // Reveal Word
        room.currentWord = room.secretWord;
        room.roundPhase = 'review';
        
        if (this.onRoomUpdate) this.onRoomUpdate(roomId, this.getPublicRoom(room));

        setTimeout(() => {
            // Let startNewRound decide if we continue or end
            if (room.status !== 'ended') {
                 this.startNewRound(roomId);
            }
        }, 5000);
    }


    processGuess(roomId: string, socketId: string, guess: string): { isCorrect: boolean; score?: number } {
        const room = this.rooms.get(roomId);
        if (!room || !room.secretWord || room.status !== 'playing' || room.roundPhase !== 'drawing') return { isCorrect: false };
        
        if (socketId === room.currentDrawerId) return { isCorrect: false }; // Drawer can't guess!

        if (guess.trim().toUpperCase() === room.secretWord.toUpperCase()) {
            if (room.guessedCorrectly.includes(socketId)) return { isCorrect: true }; // Already guessed
            
            // Calculate Score (Simple: 10 * time left?)
            // For now flat 50
            const points = 50; 
            const player = room.players.find(p => p.id === socketId);
            if (player) player.score += points;
            
            // Drawer gets points too
            const drawer = room.players.find(p => p.id === room.currentDrawerId);
            if (drawer) drawer.score += 10;

            room.guessedCorrectly.push(socketId);

            // Check if all guessed
            const guessers = room.players.filter(p => p.id !== room.currentDrawerId);
            if (room.guessedCorrectly.length >= guessers.length) {
                this.endRound(roomId); // End early
            }

            return { isCorrect: true, score: points };
        }
        return { isCorrect: false };
    }

    getRoomBySocketId(socketId: string): ServerRoom | undefined {
        for (const room of this.rooms.values()) {
            if (room.players.find(p => p.id === socketId)) {
                return room;
            }
        }
        return undefined;
    }

    updateSettings(roomId: string, settings: Partial<Room>): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        Object.assign(room, settings);
        return this.getPublicRoom(room);
    }

    resetToLobby(roomId: string): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        if (room.timer) clearInterval(room.timer);

        room.status = 'lobby';
        room.currentRound = 1;
        room.currentDrawerId = null;
        room.currentWord = null;
        room.secretWord = null;
        room.roundPhase = null;
        room.drawnPlayers = [];
        room.guessedCorrectly = [];
        room.canvasHistory = [];
        room.wordsToChoose = [];
        
        // Reset scores? Generally play again resets scores
        room.players.forEach(p => p.score = 0);

        if (this.onRoomUpdate) this.onRoomUpdate(roomId, this.getPublicRoom(room));
        
        return this.getPublicRoom(room);
    }
}

export const roomManager = new RoomManager();
