import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { LogoProvider } from './contexts/LogoContext';
import { supabase } from './lib/supabase';
import { getCurrentUserRole, type UserRole } from './lib/auth';
import LandingPage from './pages/LandingPage';
import FormPage from './pages/FormPage';
import SuccessPage from './pages/SuccessPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminTemplateEditor from './pages/AdminTemplateEditor';
import SubmissionDetail from './pages/SubmissionDetail';
import type { Session } from '@supabase/supabase-js';

const roleRank: Record<UserRole, number> = {
  staff: 0,
  admin: 1,
  super_admin: 2,
};

function hasMinimumRole(role: UserRole | null, minRole: UserRole): boolean {
  if (!role) return false;
  return roleRank[role] >= roleRank[minRole];
}

function RequireAdmin({
  session,
  role,
  minRole,
  children,
}: {
  session: Session | null | undefined;
  role: UserRole | null | undefined;
  minRole: UserRole;
  children: React.ReactNode;
}) {
  const loading = session === undefined || (session && role === undefined);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeeed] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!session) return <Navigate to="/admin/login" replace />;
  if (!hasMinimumRole(role ?? null, minRole)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [userRole, setUserRole] = useState<UserRole | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const syncAuthState = async (nextSession: Session | null) => {
      if (cancelled) return;
      setSession(nextSession);

      if (!nextSession) {
        setUserRole(null);
        return;
      }

      setUserRole(undefined);
      const role = await getCurrentUserRole();
      if (!cancelled) setUserRole(role);
    };

    supabase.auth.getSession().then(({ data }) => {
      void syncAuthState(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <LanguageProvider>
      <LogoProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/form/:templateId" element={<FormPage />} />
            <Route path="/success/:refNum" element={<SuccessPage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<RequireAdmin session={session} role={userRole} minRole="staff"><AdminDashboard /></RequireAdmin>} />
            <Route path="/admin/templates/new" element={<RequireAdmin session={session} role={userRole} minRole="admin"><AdminTemplateEditor /></RequireAdmin>} />
            <Route path="/admin/templates/:templateId/edit" element={<RequireAdmin session={session} role={userRole} minRole="admin"><AdminTemplateEditor /></RequireAdmin>} />
            <Route path="/admin/submissions/:refNum" element={<RequireAdmin session={session} role={userRole} minRole="staff"><SubmissionDetail /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LogoProvider>
    </LanguageProvider>
  );
}
