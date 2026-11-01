import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Spinner from './components/ui/Spinner.jsx';
import PageTracker from './components/common/PageTracker.jsx';
import WhatsAppButton from './components/common/WhatsAppButton.jsx';

// Landing + auth are eager (small, first-paint critical for marketing).
import LandingPage from './pages/LandingPage.jsx';

// Everything behind auth is lazy-loaded for a lean initial bundle.
const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail.jsx'));

const DashboardLayout = lazy(() => import('./layouts/DashboardLayout.jsx'));
const Overview = lazy(() => import('./pages/dashboard/Overview.jsx'));
const ChartVision = lazy(() => import('./pages/dashboard/ChartVision.jsx'));
const AssistantChat = lazy(() => import('./pages/dashboard/AssistantChat.jsx'));
const Scanner = lazy(() => import('./pages/dashboard/Scanner.jsx'));
const MultiTimeframe = lazy(() => import('./pages/dashboard/MultiTimeframe.jsx'));
const Opportunities = lazy(() => import('./pages/dashboard/Opportunities.jsx'));
const TradingJournal = lazy(() => import('./pages/dashboard/TradingJournal.jsx'));
const Backtesting = lazy(() => import('./pages/dashboard/Backtesting.jsx'));
const Mentor = lazy(() => import('./pages/dashboard/Mentor.jsx'));
const TradeValidator = lazy(() => import('./pages/dashboard/TradeValidator.jsx'));
const PositionCalculator = lazy(() => import('./pages/dashboard/PositionCalculator.jsx'));
const ManagedTrading = lazy(() => import('./pages/dashboard/ManagedTrading.jsx'));
const TradingDelegate = lazy(() => import('./pages/dashboard/TradingDelegate.jsx'));
const EconomicNews = lazy(() => import('./pages/dashboard/EconomicNews.jsx'));
const VoiceAssistant = lazy(() => import('./pages/dashboard/VoiceAssistant.jsx'));
const History = lazy(() => import('./pages/dashboard/History.jsx'));
const AnalysisDetail = lazy(() => import('./pages/dashboard/AnalysisDetail.jsx'));
const Subscription = lazy(() => import('./pages/dashboard/Subscription.jsx'));
const Profile = lazy(() => import('./pages/dashboard/Profile.jsx'));
const Settings = lazy(() => import('./pages/dashboard/Settings.jsx'));

const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminStrategies = lazy(() => import('./pages/admin/AdminStrategies.jsx'));
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans.jsx'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs.jsx'));
const AdminAIConfig = lazy(() => import('./pages/admin/AdminAIConfig.jsx'));

const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Dashboard (auth required) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="chart-vision" element={<ChartVision />} />
          <Route path="assistant" element={<AssistantChat />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="multi-timeframe" element={<MultiTimeframe />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="journal" element={<TradingJournal />} />
          <Route path="backtesting" element={<Backtesting />} />
          <Route path="mentor" element={<Mentor />} />
          <Route path="trade-validator" element={<TradeValidator />} />
          <Route path="calculator" element={<PositionCalculator />} />
          <Route path="managed-trading" element={<ManagedTrading />} />
          <Route path="delegate" element={<TradingDelegate />} />
          <Route path="economic-news" element={<EconomicNews />} />
          <Route path="voice-assistant" element={<VoiceAssistant />} />
          <Route path="history" element={<History />} />
          <Route path="history/:id" element={<AnalysisDetail />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Admin (admin role required) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="strategies" element={<AdminStrategies />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="ai-config" element={<AdminAIConfig />} />
        </Route>

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <PageTracker />
      <WhatsAppButton />
    </Suspense>
  );
}
