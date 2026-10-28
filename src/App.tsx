import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { BotsPage } from './pages/BotsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiquidationsPage } from './pages/LiquidationsPage';
import { LivePage } from './pages/LivePage';
import { ProfitPage } from './pages/ProfitPage';
import { LandingPage, LoginPage, PricingPage, RegisterPage, RequireAuth } from './pages/PublicPages';
import { SafetyPage } from './pages/SafetyPage';
import { SettingsPage } from './pages/SettingsPage';
import { StrategiesPage } from './pages/StrategiesPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="bots" element={<BotsPage />} />
        <Route path="strategies" element={<StrategiesPage />} />
        <Route path="profit" element={<ProfitPage />} />
        <Route path="liquidations" element={<LiquidationsPage />} />
        <Route path="safety" element={<SafetyPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
