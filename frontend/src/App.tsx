import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MainLayout } from './components/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { QueryState } from './shared/components/query-state';
import './index.css';

/**
 * FE2-4 (FE-004): code-splitting po ruti.
 *
 * Svaka stranica je zaseban čip koji se dohvaća tek kad se ruta posjeti.
 * `Suspense` fallback je `QueryState` loading (bez teških UI biblioteka).
 * Stranice koriste imenovane izvoze, pa `React.lazy` mapira:
 * `.then((m) => ({ default: m.X }))`.
 */
const LoginPage = lazy(() =>
  import('./features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const DashboardPage = lazy(() =>
  import('./features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const BoilerPage = lazy(() =>
  import('./features/boiler/pages/BoilerPage').then((m) => ({ default: m.BoilerPage }))
);
const HeatingPage = lazy(() =>
  import('./features/heating/pages/HeatingPage').then((m) => ({ default: m.HeatingPage }))
);
const ProfilePage = lazy(() =>
  import('./features/profile/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const ReportsPage = lazy(() =>
  import('./features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const HomeProfilePage = lazy(() =>
  import('./features/home-profile/pages/HomeProfilePage').then((m) => ({ default: m.HomeProfilePage }))
);
const GasReadingsPage = lazy(() =>
  import('./features/gas/pages/GasReadingsPage').then((m) => ({ default: m.GasReadingsPage }))
);
const GasAnalyticsPage = lazy(() =>
  import('./features/gas/pages/GasAnalyticsPage').then((m) => ({ default: m.GasAnalyticsPage }))
);
const NotificationsPage = lazy(() =>
  import('./features/notifications/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const AppReleasesPage = lazy(() =>
  import('./features/app-releases/pages/AppReleasesPage').then((m) => ({
    default: m.AppReleasesPage,
  })),
);
const DesignGalleryPage = lazy(() =>
  import('./features/design/pages/DesignGalleryPage').then((m) => ({
    default: m.DesignGalleryPage,
  })),
);

/**
 * Prikazuje se dok se čip stranice dohvaća. Bez antd-a (vidi komentar gore).
 * `role="status"` + tekst čine ga dostupnim čitačima ekrana — FE2-13 je
 * utvrdio da a11y nedostaci u ovom projektu nisu bili samo vizuelni.
 */
function RouteFallback() {
  return <QueryState status="loading" />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              {import.meta.env.DEV ? (
                <Route path="/design" element={<DesignGalleryPage />} />
              ) : null}
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
              {/*
                F15: objava verzija. Ruta je zaštićena loginom; ADMIN provjerava
                server (`RolesGuard`). Ako korisnik bez role otvori putanju,
                vidi prazan ekran sa greškom 403 — što je tačan odgovor.
              */}
              <Route
                path="/app-releases"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <AppReleasesPage />
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
