import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Send, Eraser, Trash2, Pencil, Clock, LogOut, Trophy, RotateCcw } from 'lucide-react';
import styles from './GamePage.module.css';
import clsx from 'clsx';

const GamePage: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const { currentRoom, socket, username, leaveRoom } = useGame();
    const navigate = useNavigate();
    
    // Canvas related refs and state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    
    // Game state
    const [timeLeft, setTimeLeft] = useState(60);
    const [secretWord, setSecretWord] = useState<string | null>(null);
    const [wordChoices, setWordChoices] = useState<string[]>([]); // Choices for drawer
    const [messages, setMessages] = useState<{user: string, text: string, type?: 'system'|'chat'}[]>([]);
    
    // Chat state
    const [chatInput, setChatInput] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [showLeaveModal, setShowLeaveModal] = useState(false);

    const isDrawer = currentRoom?.currentDrawerId === socket?.id;
    const isSelecting = currentRoom?.roundPhase === 'selecting';
    const isStarting = currentRoom?.roundPhase === 'starting';
    const isReview = currentRoom?.roundPhase === 'review';
    const isEnded = currentRoom?.status === 'ended';

    // Navigation check
    useEffect(() => {
        if (!currentRoom) {
             navigate('/');
        } else if (currentRoom.status === 'lobby') {
             navigate(`/lobby/${roomId}`);
        }
    }, [roomId, currentRoom, navigate]);

    // Clear canvas on new round/turn
    useEffect(() => {
        if (isSelecting || isStarting) {
             const ctx = canvasRef.current?.getContext('2d');
             if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
             // Also reset color/brush for new drawer
             setColor('#000000');
             setBrushSize(5);
        }
    }, [isSelecting, isStarting, currentRoom?.currentDrawerId]);

    // Update timer from room state initially
    useEffect(() => {
        if (currentRoom) {
            setTimeLeft(currentRoom.drawTime); // Default/Start value
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentRoom?.currentRound]); // Reset on round change

    // Socket Events
    useEffect(() => {
        if (!socket) return;
        
        const handleDraw = (data: { type: string, x: number, y: number, color?: string, size?: number }) => {
             const ctx = canvasRef.current?.getContext('2d');
             if (!ctx) return;
             
             if (data.type === 'start') {
                 ctx.beginPath();
                 ctx.moveTo(data.x, data.y);
             } else if (data.type === 'draw') {
                 ctx.lineWidth = data.size || 5;
                 ctx.lineCap = 'round';
                 ctx.strokeStyle = data.color || '#000000';
                 ctx.lineTo(data.x, data.y);
                 ctx.stroke();
             } else if (data.type === 'clear') {
                 ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
             }
        };

        const handleChat = (msg: {user: string, text: string, type: 'chat'|'system'}) => {
            setMessages(prev => [...prev, msg]);
            // Scroll to bottom
            setTimeout(() => {
                if (chatContainerRef.current) {
                    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                }
            }, 10);
        };

        const handleTimerUpdate = (time: number) => {
            setTimeLeft(time);
        };

        const handleYourTurn = (data: { word: string }) => {
            setSecretWord(data.word);
            setWordChoices([]); // Clear choices once word is set
            // Optionally show a notification "You are drawing!"
            setMessages(prev => [...prev, { user: 'System', text: `It's your turn! Draw: ${data.word}`, type: 'system' }]);
        };

        const handleChooseWords = (words: string[]) => {
            setWordChoices(words);
        };

        const handleRoundEnd = () => {
             setSecretWord(null);
             setWordChoices([]);
             // Clear canvas for everyone
             const ctx = canvasRef.current?.getContext('2d');
             if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        }

        socket.on('draw', handleDraw);
        socket.on('chat', handleChat);
        socket.on('timer_update', handleTimerUpdate);
        socket.on('your_turn', handleYourTurn);
        socket.on('choose_words', handleChooseWords);
        socket.on('round_end', handleRoundEnd);

        return () => {
            socket.off('draw', handleDraw);
            socket.off('chat', handleChat);
            socket.off('timer_update', handleTimerUpdate);
            socket.off('your_turn', handleYourTurn);
            socket.off('choose_words', handleChooseWords);
            socket.off('round_end', handleRoundEnd);
        };
    }, [socket]);

    if (!currentRoom) return null;

    const handleSelectWord = (word: string) => {
        if (!currentRoom) return;
        socket?.emit('select_word', { roomId: currentRoom.id, word });
        setWordChoices([]); 
    };

    const handleLeaveRoom = () => {
        leaveRoom();
        navigate('/');
    };

    const handlePlayAgain = () => {
         socket?.emit('reset_to_lobby', currentRoom.id);
    };

    // --- Drawing Logic ---
    const startDraw = (e: React.MouseEvent) => {
        if (!isDrawer) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        const rect = canvas.getBoundingClientRect();
        // Calculate scale factors if canvas is resized by CSS
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.beginPath();
        ctx.moveTo(x, y);

        socket?.emit('draw', { roomId: currentRoom.id, data: { type: 'start', x, y } });
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !isDrawer) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        
        ctx.lineTo(x, y);
        ctx.stroke();

        socket?.emit('draw', { roomId: currentRoom.id, data: { type: 'draw', x, y, color, size: brushSize } });
    };

    const stopDraw = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        socket?.emit('draw', { roomId: currentRoom.id, data: { type: 'clear' } });
    };

    // --- Chat Logic ---
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        
        // Use username from context or fallback
        const msgUser = username || 'Guest';
        
        socket?.emit('chat', { roomId: currentRoom.id, message: chatInput, user: msgUser });
        setChatInput('');
    };

    const colors = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'];

    // Word Display: If drawer, show secretWord. If guesser, show currentWord (masked).
    const displayWord = isDrawer ? secretWord : (currentRoom.currentWord || 'WAITING...');

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.clockContainer}>
                    <Clock size={32} className={styles.clockIcon} />
                    <span className={clsx(styles.timer, timeLeft <= 10 && styles.timerUrgent)}>{timeLeft}</span>
                </div>
                
                <div className={styles.wordDisplay}>
                    {displayWord?.split('').join(' ')}
                </div>
                
                <div className={styles.roundInfo}>
                    Round {currentRoom.currentRound} / {currentRoom.totalRounds}
                </div>
                
                <button className={styles.leaveBtn} onClick={() => setShowLeaveModal(true)} title="Leave Game">
                    <LogOut size={20} />
                </button>
            </div>

            <main className={styles.main}>
                <div className={styles.scoreboard}>
                    {currentRoom.players.map((player, idx) => (
                        <div key={player.id} className={clsx(styles.playerScore, player.id === currentRoom.currentDrawerId && styles.activeDrawer)}>
                           <div className={styles.scoreAvatar}>{player.avatar}</div>
                           <div className={styles.playerInfo}>
                                <div className={styles.name}>{player.name} {player.id === socket?.id ? '(You)' : ''}</div>
                                <div className={styles.score}>{player.score} pts</div>
                           </div>
                           <div className={styles.rank}>#{idx + 1}</div>
                           {player.id === currentRoom.currentDrawerId && <Pencil size={16} className={styles.pencilIndicator} />}
                        </div>
                    ))}
                </div>

                <div className={styles.canvasArea}>
                    {/* Starting Overlay */}
                    {isStarting && (
                        <div className={styles.overlay} style={{ zIndex: 50, background: 'rgba(0,0,0,0.8)' }}>
                            <div className={styles.waitingMessage}>
                                <div style={{fontSize: '4rem', marginBottom: '20px'}}>🚀</div>
                                <h2>Game Starting!</h2>
                                <h1 style={{fontSize: '5rem', margin: '20px 0', color: '#ffd700'}}>{timeLeft}</h1>
                                <p>Get ready...</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Review Overlay */}
                    {isReview && (
                        <div className={styles.overlay} style={{ zIndex: 60, background: 'rgba(0,0,0,0.9)' }}>
                            <div className={styles.waitingMessage}>
                                <h2>Time's Up!</h2>
                                <p style={{marginTop: '20px'}}>The word was:</p>
                                <h1 style={{fontSize: '4rem', margin: '20px 0', color: '#00ff00', letterSpacing: '5px'}}>
                                    {secretWord || currentRoom.currentWord || '???'}
                                </h1>
                                <p>Next round starting soon...</p>
                            </div>
                        </div>
                    )}

                    {/* Game Over Overlay */}
                    {isEnded && (
                        <div className={styles.overlay} style={{ zIndex: 70, background: 'rgba(0,0,0,0.95)' }}>
                             <div className={styles.gameOverContainer} style={{textAlign: 'center', color: 'white'}}>
                                 <Trophy size={64} style={{color: 'gold', marginBottom: '20px'}} />
                                 <h1 style={{fontSize: '3rem', marginBottom: '30px'}}>Game Over!</h1>
                                 
                                 <div className={styles.winnersPodium} style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px'}}>
                                     {/* Sort copy of players */}
                                     {[...currentRoom.players].sort((a,b) => b.score - a.score).map((p, idx) => (
                                         <div key={p.id} style={{
                                             display: 'flex', 
                                             alignItems: 'center', 
                                             gap: '15px', 
                                             justifyContent: 'center',
                                             fontSize: idx === 0 ? '1.5rem' : '1.1rem',
                                             fontWeight: idx === 0 ? 'bold' : 'normal',
                                             color: idx === 0 ? 'gold' : 'white'
                                         }}>
                                             <span>#{idx+1}</span>
                                             <span style={{fontSize: '2rem'}}>{p.avatar}</span>
                                             <span>{p.name}</span>
                                             <span>-</span>
                                             <span>{p.score} pts</span>
                                         </div>
                                     ))}
                                 </div>

                                 <div className={styles.endButtons} style={{display: 'flex', gap: '20px', justifyContent: 'center'}}>
                                     {currentRoom.players.find(p => p.id === socket?.id)?.isHost && (
                                         <button onClick={handlePlayAgain} style={{
                                             padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer',
                                             display: 'flex', alignItems: 'center', gap: '8px',
                                             background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px'
                                         }}>
                                             <RotateCcw size={20} /> Play Again
                                         </button>
                                     )}
                                     <button onClick={() => navigate('/')} style={{
                                             padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer',
                                             display: 'flex', alignItems: 'center', gap: '8px',
                                             background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px'
                                     }}>
                                         <LogOut size={20} /> Exit
                                     </button>
                                 </div>
                             </div>
                        </div>
                    )}
                    
                    {/* Confirmation Modal */}
                    {showLeaveModal && (
                        <div className={styles.overlay} style={{zIndex: 100, background: 'rgba(0,0,0,0.5)'}}>
                            <div className={styles.modal} style={{background: 'white', color: 'black', padding: '30px', borderRadius: '15px', textAlign: 'center'}}>
                                <h3>Leave Game?</h3>
                                <p style={{margin: '15px 0'}}>Are you sure you want to quit?</p>
                                <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                                    <button onClick={handleLeaveRoom} style={{background: '#ef4444', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
                                        Yes, Leave
                                    </button>
                                    <button onClick={() => setShowLeaveModal(false)} style={{background: '#ccc', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Word Selection Overlay */}
                    {isSelecting && (
                        <div className={styles.overlay}>
                            {isDrawer ? (
                                <div className={styles.wordSelection}>
                                    <h2>Choose a Word!</h2>
                                    <div className={styles.selectionTimer}>{timeLeft}s</div>
                                    <div className={styles.wordOptions}>
                                        {wordChoices.length > 0 ? (
                                            wordChoices.map(word => (
                                                <button key={word} className={styles.wordBtn} onClick={() => handleSelectWord(word)}>
                                                    {word}
                                                </button>
                                            ))
                                        ) : (
                                            <p>Loading words...</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.waitingMessage}>
                                    <div style={{fontSize: '3rem', marginBottom: '15px'}}>🎨</div>
                                    <h3>Drawer is choosing a word...</h3>
                                    <div className={styles.selectionTimer} style={{background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid white'}}>
                                        {timeLeft}s
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className={clsx(styles.gameLayer, (isSelecting || isStarting || isReview || isEnded) && styles.blurred)}>
                        <canvas 
                            ref={canvasRef}
                            width={800}
                            height={600}
                            className={clsx(styles.canvas, (!isDrawer || isSelecting) && styles.canvasDisabled)}
                            onMouseDown={startDraw}
                            onMouseMove={draw}
                            onMouseUp={stopDraw}
                            onMouseLeave={stopDraw}
                        />
                        
                        <div className={clsx(styles.toolbar, !isDrawer && styles.toolbarDisabled)}>
                           <div className={styles.colors} style={{ pointerEvents: isDrawer ? 'auto' : 'none' }}>
                               {colors.map(c => (
                                   <button 
                                        key={c} 
                                        className={clsx(styles.colorSwatch, color === c && styles.activeColor)} 
                                        style={{ backgroundColor: c }}
                                        onClick={() => isDrawer && setColor(c)}
                                        aria-label={`Color ${c}`}
                                        disabled={!isDrawer}
                                   />
                               ))}
                           </div>
                           <div className={styles.tools}>
                                <div className={styles.brushControl} style={{ opacity: isDrawer ? 1 : 0.5 }}>
                                    <div 
                                        className={styles.brushPreview} 
                                        style={{ 
                                            width: brushSize, 
                                            height: brushSize, 
                                            background: color === '#ffffff' ? '#ccc' : color 
                                        }}
                                    />
                                    <input 
                                        type="range" 
                                        min="2" 
                                        max="40" 
                                        value={brushSize} 
                                        onChange={(e) => setBrushSize(Number(e.target.value))}
                                        className={styles.sizeSlider}
                                        disabled={!isDrawer}
                                    />
                                </div>
                                <button 
                                    className={clsx(styles.toolBtn, color !== '#ffffff' && styles.activeTool)} 
                                    onClick={() => { if(isDrawer) { if(color === '#ffffff') setColor('#000000'); } }}
                                    title="Pencil"
                                    disabled={!isDrawer}
                                >
                                    <Pencil size={20} />
                                </button>
                                <button 
                                    className={clsx(styles.toolBtn, color === '#ffffff' && styles.activeTool)} 
                                    onClick={() => isDrawer && setColor('#ffffff')}
                                    title="Eraser"
                                    disabled={!isDrawer}
                                >
                                    <Eraser size={20} />
                                </button>
                                <button 
                                    className={styles.toolBtn} 
                                    onClick={() => isDrawer && clearCanvas()}
                                    title="Reset Canvas (Clear)"
                                    disabled={!isDrawer}
                                >
                                    <Trash2 size={20} />
                                </button>
                           </div>
                        </div>
                        {!isDrawer && !isSelecting && (
                            <div className={styles.guesserMessage}>
                                You are guessing! Type your answer in the chat.
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.chatArea}>
                    <div className={styles.messages} ref={chatContainerRef}>
                        {messages.map((msg, i) => (
                            <div key={i} className={clsx(styles.message, msg.type === 'system' && styles.systemMsg)}>
                                <span className={styles.msgUser}>{msg.user !== 'System' ? msg.user + ':' : ''}</span>
                                <span className={styles.msgText}> {msg.text}</span>
                            </div>
                        ))}
                    </div>
                    <form className={styles.chatInputArea} onSubmit={handleSendMessage}>
                        <input 
                            type="text" 
                            placeholder={isDrawer ? "Chat is disabled for drawer" : "Type your guess here..."}
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            disabled={isDrawer} 
                        />
                        <button type="submit" disabled={isDrawer}><Send size={18} /></button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default GamePage;
