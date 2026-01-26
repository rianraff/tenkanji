import { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, UserContext } from './context/UserContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Session from './pages/Session';
import Summary from './pages/Summary';
import Loading from './components/Loading';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useContext(UserContext);
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" />;
  return children;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session"
        element={
          <ProtectedRoute>
            <Session />
          </ProtectedRoute>
        }
      />
      <Route
        path="/summary"
        element={
          <ProtectedRoute>
            <Summary />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
