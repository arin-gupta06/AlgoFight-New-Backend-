import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { unifiedAnalytics } from './services/analytics.js';

import Login from './components/Login/Login.jsx';
import NavBar from './components/NavBar/NavBar.jsx';
import ProtectedRoute from './components/Common/routing/ProtectedRoute.jsx';
import AdminRoute from './components/Common/routing/AdminRoute.jsx';
import FacultyRoute from './components/Common/routing/FacultyRoute.jsx';
import SystemBroadcastBanner from './components/Common/broadcasts/SystemBroadcastBanner.jsx';
import FeedbackNotificationPrompt from './components/Feedback/FeedbackNotificationPrompt.jsx';
import ActiveEventDock from './components/Common/ActiveEventDock.jsx';
import ActiveEventCountdownModal from './components/Common/ActiveEventCountdownModal.jsx';
import RejoinSessionModal from './components/Common/RejoinSessionModal.jsx';
import SEOManager from './components/Common/SEO/SEOManager.jsx';

// 🚀 Code-split secondary route components with React.lazy
const LandingPage = lazy(() => import('./components/LandingPage/LandingPage.jsx'));
const Home = lazy(() => import('./components/Home/Home.jsx'));
const Rewards = lazy(() => import('./components/Rewards/Rewards.jsx'));
const Signup = lazy(() => import('./components/Signup/Signup.jsx'));
const Profile = lazy(() => import('./components/Profile/Profile.jsx'));
const LiveBattle = lazy(() => import('./components/Battle/LiveBattle.jsx'));
const Leaderboard = lazy(() => import('./components/Leaderboard/Leaderboard.jsx'));
const About = lazy(() => import('./components/About/About.jsx'));
const Blog = lazy(() => import('./components/Blog/Blog.jsx'));
const Careers = lazy(() => import('./components/Careers/Careers.jsx'));
const Help = lazy(() => import('./components/Help/Help.jsx'));
const Contact = lazy(() => import('./components/Contact/Contact.jsx'));
const Developer = lazy(() => import('./components/Developer/Developer.jsx'));
const BattleArena = lazy(() => import('./components/Battle/BattleArena.jsx'));
const Practice = lazy(() => import('./components/Practice/Practice.jsx'));
const PracticeWorkspace = lazy(() => import('./components/Practice/PracticeWorkspace.jsx'));
const Terms = lazy(() => import('./components/Legal/Terms.jsx'));
const Privacy = lazy(() => import('./components/Legal/Privacy.jsx'));
const Cookies = lazy(() => import('./components/Legal/Cookies.jsx'));
const RoomLobby = lazy(() => import("./components/Battle/RoomLobby.jsx"));
const ControlHub = lazy(() => import('./components/Admin/ControlHub.jsx'));
const FacultyControlHub = lazy(() => import('./components/Faculty/FacultyControlHub.jsx'));
const IntelHub = lazy(() => import('./components/Intel/IntelHub.jsx'));
const IntelArticleView = lazy(() => import('./components/Intel/IntelArticleView.jsx'));
const IntelEventsDirectory = lazy(() => import('./components/Intel/IntelEventsDirectory.jsx'));

// Fast, non-blocking loading placeholder
function PageLoader() {
  return (
    <div className="app-page-loader">
      <div className="app-loader-spinner" />
      <span>Loading...</span>
    </div>
  );
}

// 📌 Auth & Landing layout (no NavBar)
function AuthLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

// 📌 Main layout (with NavBar)
function MainLayout() {
  const location = useLocation();
  const isCodeEditorRoute =
    location.pathname.startsWith('/battle/live') ||
    /^\/practice\/[^/]+/.test(location.pathname);
  const hideNavBar = isCodeEditorRoute;

  // Auto exit browser fullscreen mode when leaving code editor environments
  useEffect(() => {
    if (!isCodeEditorRoute && document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(() => {});
      }
    }
  }, [isCodeEditorRoute, location.pathname]);

  return (
    <>
      {!hideNavBar && <NavBar />}
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </>
  );
}

function App() {
  const location = useLocation();

  useEffect(() => {
    unifiedAnalytics.init();
    unifiedAnalytics.trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <>
      <SEOManager />
      <SystemBroadcastBanner />
      <FeedbackNotificationPrompt />
      <ActiveEventDock />
      <ActiveEventCountdownModal />
      <RejoinSessionModal />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* ================= Auth Routes ================= */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/student-login" element={<Navigate to="/login" replace />} />
          </Route>

          {/* ================= Main App Routes ================= */}
          <Route element={<MainLayout />}>
            {/* Merged Home Page (Open to all visitors, default landing) */}
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />

            <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><ControlHub /></AdminRoute>} />
            <Route path="/faculty" element={<FacultyRoute><FacultyControlHub /></FacultyRoute>} />

            {/* ✅ Battle Routes */}
            <Route path="/battle" element={<ProtectedRoute><BattleArena /></ProtectedRoute>} />
            <Route path="/battle/players" element={<ProtectedRoute><BattleArena defaultTab="players" /></ProtectedRoute>} />
            <Route path="/battle/live" element={<ProtectedRoute><LiveBattle /></ProtectedRoute>} />
            <Route path="/battle/live/:roomCode" element={<ProtectedRoute><LiveBattle /></ProtectedRoute>} />
            <Route path="/battle/room/:roomCode" element={<ProtectedRoute><RoomLobby /></ProtectedRoute>} />
            <Route path="/practice" element={<ProtectedRoute><Practice /></ProtectedRoute>} />
            <Route path="/practice/:problemId" element={<ProtectedRoute><PracticeWorkspace /></ProtectedRoute>} />

            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />

            {/* ✅ Public Informational Routes (No Login Required) */}
            <Route path="/intel" element={<IntelHub />} />
            <Route path="/intel/events" element={<IntelEventsDirectory />} />
            <Route path="/intel/:slug" element={<IntelArticleView />} />
            <Route path="/about" element={<About />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/help" element={<Help />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/developer" element={<Developer />} />
            <Route path="/developers" element={<Developer />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
          </Route>
      </Routes>
    </AnimatePresence>
    </>
  );
}

export default App;
