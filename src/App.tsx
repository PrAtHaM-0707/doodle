import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import { GameProvider } from './context/GameContext';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <GameProvider>
      <Toaster position="top-center" toastOptions={{
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
          fontFamily: 'Fredoka, sans-serif',
        },
      }} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/lobby/:roomId" element={<LobbyPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}

export default App;
