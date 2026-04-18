import React from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { Dashboard } from './pages/Dashboard';
import { MaintenanceLogs } from './pages/MaintenanceLogs';
import { G081Gallery } from './pages/G081Gallery';
import { DIFMLogs } from './pages/DIFMLogs';
import { TrainingTracker } from './pages/TrainingTracker';
import { Personnel } from './pages/Personnel';
import { Support } from './pages/Support';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { PendingApproval } from './pages/PendingApproval';
import { Onboarding } from './pages/Onboarding';
import { Handoff } from './pages/Handoff';
import { Workload } from './pages/Workload';
import { Diagnostics } from './pages/Diagnostics';
import { SkillMatrix } from './pages/SkillMatrix';

// Components
import { MaintenanceAssistant } from './components/MaintenanceAssistant';

// Hooks
import { useProactiveTrainingScan } from './hooks/useProactiveTrainingScan';
import { useG081ExpiryScan } from './hooks/useG081ExpiryScan';
import { useSupplyRiskScan } from './hooks/useSupplyRiskScan';

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  
  // Proactive compliance monitoring
  useProactiveTrainingScan();
  useG081ExpiryScan();
  useSupplyRiskScan();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-medium text-sm animate-pulse">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;
  if (!profile) return <Setup />;
  if (profile.status === 'pending') return <PendingApproval />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/maintenance" element={<MaintenanceLogs />} />
        <Route path="/difm" element={<DIFMLogs />} />
        <Route path="/g081" element={<G081Gallery />} />
        <Route path="/training" element={<TrainingTracker />} />
        <Route path="/personnel" element={<Personnel />} />
        <Route path="/support" element={<Support />} />
        <Route path="/handoff" element={<Handoff />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
        <Route path="/skills" element={<SkillMatrix />} />
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
          <Route path="/workload" element={<Workload />} />
        )}
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && <Route path="/onboarding" element={<Onboarding />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <MaintenanceAssistant />
    </AppLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
