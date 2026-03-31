import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Crown, Copy, Users, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './LobbyPage.module.css';

const LobbyPage: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { currentRoom, startGame, username, updateRoomSettings, leaveRoom, socket } = useGame();

    // On refresh, state is lost (mock), so redirect to home as requested.
    useEffect(() => {
        if (!currentRoom) {
            // Redirect to landing page with join code if coming from a shared link
            navigate(`/?join=${roomId}`);
        } else if (currentRoom.status === 'playing') {
            navigate(`/game/${roomId}`);
        }
    }, [currentRoom, navigate, roomId]);

    if (!currentRoom) {
        return null; // Or a spinner, but we are redirecting
    }

    const handleCopyLink = () => {
        // Construct valid join link: base URL + /?join=ROOMID
        const joinLink = `${window.location.origin}/?join=${roomId}`;
        navigator.clipboard.writeText(joinLink);
        toast.success('Link copied to clipboard!');
    };

    const handleLeaveRoom = () => {
        leaveRoom();
        navigate('/');
        toast.success('Left the room');
    };

    const handleStartGame = () => {
        if (currentRoom && currentRoom.players.length < 1) {
            toast.error("Need at least 1 player to test!");
            return;
        }
        startGame();
        // Navigation handled by useEffect when status changes
    };

    const updateSettings = (key: string, value: string | number) => {
        if (!currentRoom) return;
        updateRoomSettings({
            [key]: value
        });
    };

    const isHost = currentRoom.players.find(p => p.id === socket?.id)?.isHost;

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button className={styles.backBtn} onClick={handleLeaveRoom} title="Leave Room">
                            <ArrowLeft size={24} />
                        </button>
                        <h2 className={styles.title}>Lobby</h2>
                    </div>
                    
                    <div className={styles.roomCode} onClick={handleCopyLink} title="Click to copy">
                        Code: <span>{roomId}</span> <Copy size={16} />
                    </div>
                </div>

                <div className={styles.content}>
                    <div className={styles.settings}>
                        <h3 className={styles.sectionTitle}>Settings</h3>

                        <div className={styles.settingRow}>
                            <span>Max Players</span>
                            <select
                                disabled={!isHost}
                                value={currentRoom.maxPlayers}
                                onChange={(e) => updateSettings('maxPlayers', Number(e.target.value))}
                            >
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <option key={num} value={num}>{num}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.settingRow}>
                            <span>Rounds</span>
                            <select
                                disabled={!isHost}
                                value={currentRoom.totalRounds}
                                onChange={(e) => updateSettings('totalRounds', Number(e.target.value))}
                            >
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <option key={num} value={num}>{num}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.settingRow}>
                            <span>Draw Time (s)</span>
                            <select
                                disabled={!isHost}
                                value={currentRoom.drawTime}
                                onChange={(e) => updateSettings('drawTime', Number(e.target.value))}
                            >
                                {[15, 30, 60, 90, 120].map(num => (
                                    <option key={num} value={num}>{num}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.settingRow}>
                            <span>Hints</span>
                            <select
                                disabled={!isHost}
                                value={currentRoom.hints}
                                onChange={(e) => updateSettings('hints', Number(e.target.value))}
                            >
                                {[0, 1, 2, 3].map(num => (
                                    <option key={num} value={num}>{num}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.playerSection}>
                        <div className={styles.listHeader}>
                            <Users size={20} /> Players ({currentRoom.players.length}/{currentRoom.maxPlayers})
                        </div>
                        {/* We add a wrapper or specific class here for the scrollable area */}
                        <div className={styles.players}>
                            {currentRoom.players.map(player => (
                                <div key={player.id} className={styles.playerRow}>
                                    <div className={styles.avatarWrapper}>
                                    {/* Avatar is now an emoji string */}
                                        <div className={styles.avatarIcon}>{player.avatar}</div>
                                    </div>
                                    <div className={styles.playerInfo}>
                                        <span className={styles.playerName}>
                                            {player.name} {player.name === username && '(You)'}
                                        </span>
                                        <span className={styles.playerScore}>{player.score} pts</span>
                                    </div>
                                    {player.isHost && <Crown size={20} className={styles.hostIcon} />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    {isHost ? (
                        <div style={{ width: '100%' }}>
                            <button 
                                className={styles.startBtn} 
                                onClick={handleStartGame}
                                disabled={currentRoom.players.length < 1}
                            >
                                Start Game
                            </button>
                            {currentRoom.players.length < 1 &&
                                <div className={styles.minPlayersNote}>Note: You need at least 1 player to test!</div>
                            }
                        </div>
                    ) : (
                        <div className={styles.waitingMsg}>Waiting for host to start...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LobbyPage;