import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Pencil, Play, LogIn, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './LandingPage.module.css';

const AVATARS = [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', 
    '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
    '🦄', '🐝', '🐛', '🦋', '🐌', '🐢', '🐙', '🦑'
];

const LandingPage: React.FC = () => {
    const { username, setUsername, avatar, setAvatar, createRoom, joinRoom } = useGame();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    // Initialize with URL param if present to avoid setting state in effect
    const [roomCode, setRoomCode] = useState(searchParams.get('join') || '');
    const isJoinMode = !!searchParams.get('join');

    // Check for join code in URL
    useEffect(() => {
        // Notification removed as requested
    }, []);

    const handleCreateRoom = async () => {
        if (!username.trim()) {
            toast.error('Please enter a username');
            return;
        }
        const roomId = await createRoom();
        if (roomId) {
            toast.success(`Created room ${roomId}!`);
            navigate(`/lobby/${roomId}`);
        }
    };

    const handleJoinRoom = async () => {
        if (!username.trim()) {
            toast.error('Please enter a username');
            return;
        }
        if (!roomCode.trim()) {
            toast.error('Please enter a room code');
            return;
        }
        const success = await joinRoom(roomCode);
        if (success) {
            toast.success(`Joined room ${roomCode}`);
            navigate(`/lobby/${roomCode}`);
        }
    };

    const changeAvatar = (direction: 'prev' | 'next') => {
        const currentIndex = AVATARS.indexOf(avatar);
        let nextIndex;
        if (direction === 'prev') {
            nextIndex = (currentIndex - 1 + AVATARS.length) % AVATARS.length;
        } else {
            nextIndex = (currentIndex + 1) % AVATARS.length;
        }
        setAvatar(AVATARS[nextIndex]);
    };

    return (
        <div className={styles.container}>
            <header className={styles.logoArea}>
                <h1 className={styles.title}>
                    <Pencil className={styles.logoIcon} size={50} />
                    Scribbl
                </h1>
            </header>

            <div className={styles.card}>
                <div className={styles.avatarSection}>
                    <button className={styles.arrowBtn} onClick={() => changeAvatar('prev')}>
                        <ChevronLeft size={32} />
                    </button>
                    
                    <div className={styles.currentAvatar}>{avatar}</div>
                    
                    <button className={styles.arrowBtn} onClick={() => changeAvatar('next')}>
                        <ChevronRight size={32} />
                    </button>
                </div>

                <div className={styles.inputGroup}>
                    <input
                        type="text"
                        placeholder="Enter your nickname"
                        className={styles.input}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        maxLength={12}
                    />
                    
                    <input
                        type="text"
                        placeholder="Room Code (if joining)"
                        className={styles.input}
                        value={roomCode}
                        onChange={(e) => !isJoinMode && setRoomCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        disabled={isJoinMode}
                        style={isJoinMode ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                    />
                </div>

                <div className={styles.actionButtons}>
                    <button 
                        className={`${styles.btn} ${styles.createBtn}`} 
                        onClick={handleCreateRoom}
                        disabled={isJoinMode}
                        style={isJoinMode ? { cursor: 'not-allowed', opacity: 0.5 } : {}}
                    >
                        <Play size={20} fill="currentColor" />
                        Create
                    </button>
                    <button className={`${styles.btn} ${styles.joinBtn}`} onClick={handleJoinRoom}>
                        <LogIn size={20} />
                        Join
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
