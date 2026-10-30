import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MainLayout } from './components/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import './index.css';

/**
 * FE2-4 (FE-004): code-splitting po ruti.
 *
 * Prije ove izmjene `App.tsx` je statički importovao svih 10 stranica, pa je
 * `npm run build` proizvodio **jedan** JS čip od 2.975,35 kB (gzip 906,26 kB) —
 * izmjereno 2026-10-30. Posljedica: korisnik na `/login` preuzima cijelu
 * aplikaciju, uključujući `@ant-design/plots` (teška biblioteka za grafikone)
 * koju koristi **samo** `DashboardPage.tsx:6`.
 *
 * Sada je svaka stranica zaseban čip koji se dohvaća tek kad se ruta posjeti.
 * `Suspense` fallback je namjerno **bez antd-a** (običan `div` + CSS), da
 * početni čip ostane mali — antd ionako dolazi s prvom stranicom koja ga treba.
 *
 * Stranice koriste **imenovane** izvoze, pa `React.lazy` (koji traži default
 * izvoz) mora mapirati modul: `.then((m) => ({ default: m.X }))`.
 */
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const BoilerPage = lazy(() => import('./pages/BoilerPage').then((m) => ({ default: m.BoilerPage })));
const HeatingPage = lazy(() =>
  import('./pages/HeatingPage').then((m) => ({ default: m.HeatingPage }))
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const HomeProfilePage = lazy(() =>
  import('./pages/HomeProfilePage').then((m) => ({ default: m.HomeProfilePage }))
);
const GasReadingsPage = lazy(() =>
  import('./pages/GasReadingsPage').then((m) => ({ default: m.GasReadingsPage }))
);
const GasAnalyticsPage = lazy(() =>
  import('./pages/GasAnalyticsPage').then((m) => ({ default: m.GasAnalyticsPage }))
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);

/**
 * Prikazuje se dok se čip stranice dohvaća. Bez antd-a (vidi komentar gore).
 * `role="status"` + tekst čine ga dostupnim čitačima ekrana — FE2-13 je
 * utvrdio da a11y nedostaci u ovom projektu nisu bili samo vizuelni.
 */
function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '16rem',
      }}
    >
      <span className="route-fallback-text">Učitavanje…</span>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
