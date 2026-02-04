import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MainLayout } from './components/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import './index.css';
import { BoilerPage } from './pages/BoilerPage';
import { HeatingPage } from './pages/HeatingPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { HomeProfilePage } from './pages/HomeProfilePage';
import { GasReadingsPage } from './pages/GasReadingsPage';
import { GasAnalyticsPage } from './pages/GasAnalyticsPage';
import { NotificationsPage } from './pages/NotificationsPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <DashboardPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/boiler"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <BoilerPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/heating"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <HeatingPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gas/readings"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <GasReadingsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gas/analytics"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <GasAnalyticsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ReportsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/home-profile"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <HomeProfilePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ProfilePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <NotificationsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
