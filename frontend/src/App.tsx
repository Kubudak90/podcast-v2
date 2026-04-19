import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header, TabBar } from './components/Layout';
import { Home, Login, SignUp, Room, RoomEnded, Profile, Listen, CreateRoom, Library } from './pages';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { useEffect } from 'react';
import { api } from './lib/api';
import { useAuthStore } from './lib/store';

function App() {
  const { token, setAuth, logout } = useAuthStore();

  useEffect(() => {
    if (token) {
      api.setToken(token);
      api.me().then(user => {
        setAuth(user, token);
      }).catch(() => {
        api.setToken(null);
        logout();
      });
    }
  }, [token, setAuth, logout]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-pod-bg">
          <Header />
          <main className="pb-24">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/create-room" element={<CreateRoom />} />
              <Route path="/room/:slug" element={<Room />} />
              <Route path="/room/:slug/ended" element={<RoomEnded />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/library" element={<Library />} />
              <Route path="/listen/:shareSlug" element={<Listen />} />
            </Routes>
          </main>
          <TabBar />
        </div>
        <ToastContainer />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
