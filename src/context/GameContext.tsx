import React, { createContext, useContext, useState, type ReactNode, useCallback, useMemo, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  avatar: string;
}

export interface Room {
  id: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'ended';
  currentRound: number;
  totalRounds: number;
  drawTime: number;
  currentDrawerId: string | null;
  currentWord: string | null;
  revealedWord?: string | null;
  wordsToChoose: string[];
  maxPlayers: number;
  hints: number;
  roundPhase?: 'starting' | 'selecting' | 'drawing' | 'review' | null;
  guessedCorrectly?: string[];
}

interface GameContextType {
  username: string;
  setUsername: (name: string) => void;
  avatar: string;
  setAvatar: (avatar: string) => void;
  currentRoom: Room | null;
  socket: Socket | null;
  createRoom: () => Promise<string | null>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: () => void;
  startGame: () => void;
  updateRoomSettings: (settings: Partial<Room>) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [username, setUsername] = useState('Player');
  const [avatar, setAvatar] = useState('😊');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize Socket
  useEffect(() => {
    let active = true;
    const newSocket = io(BACKEND_URL);
    
    // Only set socket if the effect is still active (mounted)
    // The previous error about synchronous setState inside effect was actually fine traditionally for initialization,
    // but React 18 strict mode + eslint warns about cascading updates.
    // However, the real fix for cascading renders is not doing it synchronously if dependencies change often,
    // but here we only run once.
    // A clean way is just to set it. But to appease the linter we can check mounting.
    if (active) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(newSocket);
    }

    return () => {
      active = false;
      newSocket.disconnect();
    };
  }, []); // Run once on mount

  // Socket Event Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('room_updated', (room: Room) => {
      console.log('Room updated:', room);
      setCurrentRoom(room);
    });

    socket.on('game_started', () => {
        // Can handle specific game start logic here if needed
        toast.success('Game Started!', { icon: '🎮' });
    });

    socket.on('error', (msg: string) => {
        toast.error(msg);
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_started');
      socket.off('error');
    };
  }, [socket]);

  const createRoom = useCallback(() => {
    return new Promise<string | null>((resolve) => {
        if (!socket) {
            toast.error("Not connected to server");
            resolve(null);
            return;
        }
        // Send default settings or let server handle them. 
        // Sending 60 and 3 as initial values, but they will be editable in lobby.
        const defaultDrawTime = 60;
        const defaultRounds = 3;
        socket.emit('create_room', { username, avatar, drawTime: defaultDrawTime, rounds: defaultRounds }, (response: { roomId: string, room: Room }) => {
            setCurrentRoom(response.room);
            resolve(response.roomId);
        });
    });
  }, [socket, username, avatar]);

  const joinRoom = useCallback((roomId: string) => {
    return new Promise<boolean>((resolve) => {
        if (!socket) {
             toast.error("Not connected to server");
             resolve(false);
             return;
        }
        socket.emit('join_room', { roomId, username, avatar }, (response: { success?: boolean, error?: string, room?: Room }) => {
            if (response.error) {
                toast.error(response.error);
                resolve(false);
            } else {
                if (response.room) setCurrentRoom(response.room);
                resolve(true);
            }
        });
    });
  }, [socket, username, avatar]);

  const leaveRoom = useCallback(() => {
    if (socket) {
        socket.emit('leave_room');
    }
    setCurrentRoom(null);
  }, [socket]);

  const startGame = useCallback(() => {
    if (socket && currentRoom) {
      if (currentRoom.players.length < 1) return; // Backend should also validate
      socket.emit('start_game', currentRoom.id);
    }
  }, [socket, currentRoom]);

  const updateRoomSettings = useCallback((settings: Partial<Room>) => {
    if (socket && currentRoom) {
        socket.emit('update_settings', { roomId: currentRoom.id, settings });
    }
  }, [socket, currentRoom]);

  const value = useMemo(() => ({
      username, 
      setUsername, 
      avatar,
      setAvatar,
      currentRoom,
      socket,
      createRoom, 
      joinRoom, 
      leaveRoom,
      startGame,
      updateRoomSettings
  }), [username, setUsername, avatar, setAvatar, currentRoom, socket, createRoom, joinRoom, leaveRoom, startGame, updateRoomSettings]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
