import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppBackground } from './design/Shell';
import { Toaster } from './components/Toaster';
import { BootScreen } from './components/BootScreen';
import { HomePage } from './pages/HomePage';
import { ModeSelectPage } from './pages/ModeSelectPage';
import { LobbyPage } from './pages/LobbyPage';
import { WaitingRoomPage } from './pages/WaitingRoomPage';
import { ArenaPage } from './pages/ArenaPage';
import { ResultPage } from './pages/ResultPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { attachGameListeners, useGameStore } from './store/game';
import { useSessionStore } from './store/session';
import { serverUrl, serverUrlError, socket } from './net/socket';

let listenersAttached = false;

/** Owns the socket lifecycle and routes the player as server events arrive. */
function NetworkBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const hello = useSessionStore((s) => s.hello);
  const setStatus = useSessionStore((s) => s.setStatus);
  const setOffline = useSessionStore((s) => s.setOffline);

  useEffect(() => {
    // Misconfigured build: there is nothing to connect to, so retrying would
    // only spin. Report it once and stop.
    if (serverUrlError) {
      setOffline(serverUrlError);
      return;
    }

    if (!listenersAttached) {
      attachGameListeners();
      listenersAttached = true;
    }

    const onConnect = (): void => {
      setStatus('online');
      void hello();
    };
    const onDisconnect = (): void => setStatus('reconnecting');
    const onError = (): void => setOffline(`Could not reach the game server at ${serverUrl}.`);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    // If the socket connected before these listeners were attached (StrictMode
    // remounts, hot reloads), the connect event is already gone — run it now.
    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
    };
  }, [hello, setStatus, setOffline]);

  const matchId = useGameStore((s) => s.matchId);
  const result = useGameStore((s) => s.result);
  const room = useGameStore((s) => s.room);

  // A live match always wins over whatever page the player is looking at.
  useEffect(() => {
    if (matchId && !result && location.pathname !== '/arena') navigate('/arena');
  }, [matchId, result, location.pathname, navigate]);

  useEffect(() => {
    if (result && location.pathname !== '/result') navigate('/result');
  }, [result, location.pathname, navigate]);

  useEffect(() => {
    if (room && !matchId && !result && location.pathname === '/lobby') navigate('/room');
  }, [room, matchId, result, location.pathname, navigate]);

  useEffect(() => {
    if (!room && !matchId && location.pathname === '/room') navigate('/lobby');
  }, [room, matchId, location.pathname, navigate]);

  return null;
}

export function App() {
  const location = useLocation();
  const profile = useSessionStore((s) => s.profile);

  return (
    <>
      <AppBackground />
      <NetworkBridge />
      <Toaster />
      {!profile ? (
        <BootScreen />
      ) : (
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/play" element={<ModeSelectPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/room" element={<WaitingRoomPage />} />
            <Route path="/arena" element={<ArenaPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </AnimatePresence>
      )}
    </>
  );
}
