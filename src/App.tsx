import React from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AIScanStatusProvider } from './contexts/AIScanStatusContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Operations } from './pages/Operations';
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

// Components
import { MaintenanceAssistant } from './components/MaintenanceAssistant';

// Hooks
import { useProactiveTrainingScan } from './hooks/useProactiveTrainingScan';
import { useG081ExpiryScan } from './hooks/useG081ExpiryScan';
import { useSupplyRiskScan } from './hooks/useSupplyRiskScan';
import { useGuidedTour } from './hooks/useGuidedTour';
import { TourContext } from './contexts/TourContext';

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const tour = useGuidedTour();

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
    <TourContext.Provider value={tour}>
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ops/*" element={<Operations />} />
        <Route path="/maintenance" element={<Navigate to="/ops/maintenance" replace />} />
        <Route path="/difm" element={<Navigate to="/ops/difm" replace />} />
        <Route path="/g081" element={<Navigate to="/ops/g081" replace />} />
        <Route path="/training" element={<TrainingTracker />} />
        <Route path="/personnel" element={<Personnel />} />
        <Route path="/support" element={<Support />} />
        <Route path="/handoff" element={<Handoff />} />
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
          <Route path="/diagnostics" element={<Diagnostics />} />
        )}
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && (
          <Route path="/workload" element={<Workload />} />
        )}
        {(profile?.role === 'ncoic' || profile?.role === 'leadership') && <Route path="/onboarding" element={<Onboarding />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <MaintenanceAssistant />
    </AppLayout>
    </TourContext.Provider>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AIScanStatusProvider>
          <Router>
            <AppContent />
          </Router>
        </AIScanStatusProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
