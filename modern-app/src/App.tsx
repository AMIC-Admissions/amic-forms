import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { LogoProvider } from './contexts/LogoContext';
import { supabase } from './lib/supabase';
import LandingPage from './pages/LandingPage';
import FormPage from './pages/FormPage';
import SuccessPage from './pages/SuccessPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminTemplateEditor from './pages/AdminTemplateEditor';
import SubmissionDetail from './pages/SubmissionDetail';
import type { Session } from '@supabase/supabase-js';

function RequireAdmin({ session, children }: { session: Session | null | undefined; children: React.ReactNode }) {
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#eeeeed] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
      </div>
    );
  }
  return session ? <>{children}</> : <Navigate to="/admin/login" replace />;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
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
            <Route path="/admin" element={<RequireAdmin session={session}><AdminDashboard /></RequireAdmin>} />
            <Route path="/admin/templates/new" element={<RequireAdmin session={session}><AdminTemplateEditor /></RequireAdmin>} />
            <Route path="/admin/templates/:templateId/edit" element={<RequireAdmin session={session}><AdminTemplateEditor /></RequireAdmin>} />
            <Route path="/admin/submissions/:refNum" element={<RequireAdmin session={session}><SubmissionDetail /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LogoProvider>
    </LanguageProvider>
  );
}
