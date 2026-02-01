export interface DrawData {
    type: 'start' | 'draw' | 'clear';
    x?: number;
    y?: number;
    color?: string;
    size?: number;
}

export interface Player {
    id: string; // Socket ID or specific UUID
    name: string;
    score: number;
    isHost: boolean;
    avatar: string;
    socketId: string;
}

export interface Room {
    id: string;
    players: Player[];
    status: 'lobby' | 'playing' | 'ended';
    currentRound: number;
    totalRounds: number;
    drawTime: number;
    currentDrawerId: string | null;
    currentWord: string | null; // This will now be the MASKED word for clients (e.g. "_ _ _")
    revealedWord: string | null; // The word revealed at the end of the round
    wordsToChoose: string[];
    maxPlayers: number;
    hints: number;
    roundPhase: 'starting' | 'selecting' | 'drawing' | 'review' | null;
    roundEndReason?: 'timer' | 'all_guessed' | 'drawer_left';
    // Game state tracking
    roundStartTime: number | null;
    guessedCorrectly: string[]; // List of player IDs who guessed the word
    canvasHistory: DrawData[]; // Store drawing actions to sync for new joiners
}

export interface CreateRoomPayload {
    username: string;
    avatar: string;
    drawTime?: number;
    rounds?: number;
}

export interface JoinRoomPayload {
    roomId: string;
    username: string;
    avatar: string;
}

export interface RoomSettingsPayload {
    roomId: string; // Add explicit roomId in payload for clarity, or derive from socket room
    settings: Partial<Room>;
}

export interface DrawPayload {
    roomId: string;
    data: DrawData; // Drawing data (x, y, color, etc.)
}

export interface ChatPayload {
    roomId: string; // Add explicit roomId in payload for clarity, or derive from socket room
    message: string;
}
