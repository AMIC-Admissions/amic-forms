import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Download, Plus, FileText, Users, Clock, TrendingUp,
  RefreshCw, Trash2, Eye, ExternalLink, Copy, Check, ToggleLeft, Lock,
  ToggleRight, CreditCard as Edit2, Upload, ImageOff,
  LayoutDashboard, Settings, LogOut, ChevronRight, Menu, X,
  CheckCircle2, AlertCircle, BarChart3, Plug, Webhook,
  HardDrive, Cloud, UserCog, Shield, Mail, PieChart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart as RechartsPieChart, Pie, Legend,
} from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useLogo } from '../contexts/LogoContext';
import { supabase } from '../lib/supabase';
import { formatDate, downloadFromUrl } from '../lib/utils';
import { getCurrentUserRole } from '../lib/auth';
import type { UserRole } from '../lib/auth';
import type { Submission } from '../types';

type Tab = 'submissions' | 'templates' | 'analytics' | 'integrations' | 'settings' | 'users';

export default function AdminDashboard() {
  const { t, isRTL } = useLanguage();
  const { logoUrl } = useLogo();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('submissions');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    getCurrentUserRole().then(setUserRole);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const allNavItems: { id: Tab; label: string; labelAr: string; icon: typeof LayoutDashboard; minRole: UserRole }[] = [
    { id: 'submissions', label: 'Dashboard', labelAr: 'لوحة التحكم', icon: LayoutDashboard, minRole: 'staff' },
    { id: 'templates', label: 'Templates', labelAr: 'القوالب', icon: FileText, minRole: 'admin' },
    { id: 'analytics', label: 'Analytics', labelAr: 'الإحصائيات', icon: PieChart, minRole: 'admin' },
    { id: 'integrations', label: 'Integrations', labelAr: 'التكاملات', icon: Plug, minRole: 'admin' },
    { id: 'settings', label: 'Settings', labelAr: 'الإعدادات', icon: Settings, minRole: 'admin' },
    { id: 'users', label: 'Users', labelAr: 'المستخدمون', icon: UserCog, minRole: 'super_admin' },
  ];

  const roleRank: Record<UserRole, number> = { staff: 0, admin: 1, super_admin: 2 };
  const navItems = allNavItems.filter(item =>
    userRole && roleRank[userRole] >= roleRank[item.minRole]
  );

  return (
    <div className="min-h-screen bg-[#f0f0ef]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 h-full z-50 w-64 bg-[#222d64] flex flex-col transition-transform duration-300 shadow-2xl
          ${isRTL ? 'right-0' : 'left-0'}
          ${sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <p className="text-white font-bold text-sm leading-tight">AMIC Forms</p>
              <p className="text-white/50 text-xs">Admin Panel</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ms-auto p-1 rounded-lg hover:bg-white/10 transition-colors lg:hidden text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isRTL ? 'flex-row-reverse text-right' : ''} ${
                tab === item.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{isRTL ? item.labelAr : item.label}</span>
              {tab === item.id && <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isRTL ? 'rotate-180' : ''}`} />}
            </button>
          ))}
        </nav>

        {/* New template shortcut */}
        <div className="p-3 border-t border-white/10">
          <Link
            to="/admin/templates/new"
            className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-[#222d64] bg-white hover:bg-gray-100 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {isRTL ? 'قالب جديد' : 'New Template'}
          </Link>
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className={`min-h-screen ${isRTL ? 'lg:mr-64' : 'lg:ml-64'} flex flex-col`}>
        {/* Mobile top bar */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
          <p className="font-bold text-sm" style={{ color: '#222d64' }}>AMIC Forms</p>
          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            <div className={`mb-6 ${isRTL ? 'text-right' : ''}`}>
              <h1 className="text-xl font-extrabold" style={{ color: '#222d64' }}>
                {isRTL ? navItems.find(n => n.id === tab)?.labelAr : navItems.find(n => n.id === tab)?.label}
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">AMIC School — Forms Management</p>
            </div>

            {tab === 'submissions' && <SubmissionsTab />}
            {tab === 'templates' && <TemplatesTab />}
            {tab === 'analytics' && <AnalyticsTab />}
            {tab === 'integrations' && <IntegrationsTab />}
            {tab === 'settings' && <SettingsTab />}
            {tab === 'users' && <UsersTab />}
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="flex items-stretch">
            {navItems.slice(0, 5).map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 transition-colors ${
                  tab === item.id ? 'text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
                style={tab === item.id ? { backgroundColor: '#222d64' } : {}}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-[10px] font-semibold leading-tight truncate max-w-[52px]">
                  {isRTL ? item.labelAr : item.label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

/* ─── Submissions Tab ─── */
function SubmissionsTab() {
  const { t, isRTL, lang } = useLanguage();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filtered, setFiltered] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const fetchSubmissions = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });
    const subs = (data as Submission[]) || [];
    setSubmissions(subs);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchSubmissions(); }, []);

  useEffect(() => {
    let result = submissions;
    if (statusFilter !== 'all') result = result.filter(s => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.reference_number.toLowerCase().includes(q) ||
        (s.form_data?.parentName || '').toLowerCase().includes(q) ||
        (s.form_data?.studentName || '').toLowerCase().includes(q) ||
        (s.template_name || '').toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, submissions, statusFilter]);

  const handleDownload = async (sub: Submission) => {
    const url = sub.signed_pdf_data || localStorage.getItem(`amic_pdf_${sub.reference_number}`);
    if (url) {
      await downloadFromUrl(url, `AMIC-Form-${sub.reference_number}.pdf`);
    } else {
      alert(lang === 'ar'
        ? 'ملف PDF غير متاح لهذا الطلب.'
        : 'No signed PDF available for this submission.');
    }
  };

  const handleDelete = async (id: string, refNum: string) => {
    if (!confirm(lang === 'ar' ? 'هل تريد حذف هذا الطلب؟' : 'Delete this submission?')) return;
    await supabase.from('submissions').delete().eq('id', id);
    localStorage.removeItem(`amic_pdf_${refNum}`);
    localStorage.removeItem(`amic_sub_${refNum}`);
    setSubmissions(prev => prev.filter(s => s.id !== id));
  };

  const weekCount = submissions.filter(s => {
    const d = new Date(s.created_at);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).length;
  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const completedCount = submissions.filter(s => s.status === 'completed').length;

  const statCards = [
    { label: isRTL ? 'إجمالي الطلبات' : 'Total Submissions', value: submissions.length, icon: Users, color: '#222d64', bg: '#222d640f' },
    { label: isRTL ? 'هذا الأسبوع' : 'This Week', value: weekCount, icon: TrendingUp, color: '#f9b106', bg: '#f9b10612' },
    { label: isRTL ? 'قيد الانتظار' : 'Pending', value: pendingCount, icon: Clock, color: '#d97706', bg: '#fef3c712' },
    { label: isRTL ? 'مكتملة' : 'Completed', value: completedCount, icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf412' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">{stat.label}</p>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: stat.bg }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
            </div>
            <p className="text-3xl font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className={`flex flex-wrap items-center gap-3 p-4 border-b border-gray-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`w-full border border-gray-200 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-gray-50 ${isRTL ? 'pe-10 ps-4' : 'ps-10 pe-4'}`}
              style={{ '--tw-ring-color': '#222d64' } as React.CSSProperties}
            />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1">
            {(['all', 'pending', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? 'text-white shadow-sm' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                style={statusFilter === s ? { backgroundColor: '#222d64' } : {}}
              >
                {s === 'all' ? (isRTL ? 'الكل' : 'All') : s === 'pending' ? (isRTL ? 'انتظار' : 'Pending') : (isRTL ? 'مكتملة' : 'Completed')}
              </button>
            ))}
          </div>

          <button
            onClick={fetchSubmissions}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors ms-auto"
            title={isRTL ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
            <p className="text-gray-400 text-sm">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-semibold mb-1">
              {search || statusFilter !== 'all' ? (isRTL ? 'لا توجد نتائج' : 'No results') : t('noSubmissions')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir={isRTL ? 'rtl' : 'ltr'}>
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    { key: 'ref', label: t('refNumber') },
                    { key: 'parent', label: t('parentNameCol') },
                    { key: 'student', label: t('studentNameCol') },
                    { key: 'form', label: isRTL ? 'النموذج' : 'Form' },
                    { key: 'status', label: isRTL ? 'الحالة' : 'Status' },
                    { key: 'date', label: t('submittedAt') },
                    { key: 'actions', label: t('actions') },
                  ].map(col => (
                    <th key={col.key} className={`px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg tracking-wider border" style={{ color: '#222d64', backgroundColor: '#222d6410', borderColor: '#222d6420' }}>
                        {sub.reference_number}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-medium text-gray-900 text-sm">
                        {sub.form_data?.parentName || <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-600 text-sm">
                        {sub.form_data?.studentName || <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-500 text-xs">
                        {sub.template_name || <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={sub.status} isRTL={isRTL} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-gray-400 text-xs">{formatDate(sub.created_at, lang)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Link
                          to={`/admin/submissions/${sub.reference_number}`}
                          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#222d64] transition-all"
                          title={isRTL ? 'عرض' : 'View'}
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDownload(sub)}
                          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-all"
                          title={t('download')}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id, sub.reference_number)}
                          className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          title={isRTL ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className={`px-5 py-3 border-t border-gray-100 text-xs text-gray-400 ${isRTL ? 'text-right' : ''}`}>
            {isRTL ? `عرض ${filtered.length} من ${submissions.length} طلب` : `Showing ${filtered.length} of ${submissions.length} submissions`}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status, isRTL }: { status: string; isRTL: boolean }) {
  const map: Record<string, { label: string; labelAr: string; className: string; icon: typeof CheckCircle2 }> = {
    completed: { label: 'Completed', labelAr: 'مكتمل', className: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
    pending: { label: 'Pending', labelAr: 'انتظار', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
    rejected: { label: 'Rejected', labelAr: 'مرفوض', className: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  };
  const info = map[status] || { label: status, labelAr: status, className: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock };
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${info.className} ${isRTL ? 'flex-row-reverse' : ''}`}>
      <Icon className="w-3 h-3 flex-shrink-0" />
      {isRTL ? info.labelAr : info.label}
    </span>
  );
}

/* ─── Templates Tab ─── */
function TemplatesTab() {
  const { t, isRTL, lang } = useLanguage();
  const [templates, setTemplates] = useState<Array<{
    id: string; name: string; name_ar: string; pdf_filename: string; is_active: boolean; created_at: string;
    fields: Array<{ type: string }>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('form_templates')
      .select('id, name, name_ar, pdf_filename, is_active, created_at, fields')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates((data as typeof templates) || []);
        setLoading(false);
      });
  }, []);

  const toggleStatus = async (id: string, current: boolean) => {
    await supabase.from('form_templates').update({ is_active: !current }).eq('id', id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !current } : t));
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'هل تريد حذف هذا القالب؟' : 'Delete this template?')) return;
    await supabase.from('form_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/form/${id}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-600 font-semibold mb-1">{t('noTemplates')}</p>
        <p className="text-gray-400 text-sm mb-5">
          {isRTL ? 'أنشئ قالباً لبدء استقبال النماذج' : 'Create a template to start receiving form submissions'}
        </p>
        <Link
          to="/admin/templates/new"
          className="inline-flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors hover:brightness-110"
          style={{ backgroundColor: '#222d64' }}
        >
          <Plus className="w-4 h-4" />
          {t('newTemplate')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {templates.map(tmpl => (
        <div key={tmpl.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
          <div className={`p-5 ${isRTL ? 'text-right' : ''}`}>
            <div className={`flex items-start gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#222d6415', border: '1px solid #222d6420' }}>
                <FileText className="w-5 h-5" style={{ color: '#222d64' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-2 mb-0.5 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <h3 className="font-bold text-gray-900 text-sm truncate">
                    {lang === 'ar' ? (tmpl.name_ar || tmpl.name) : tmpl.name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${tmpl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {tmpl.is_active ? t('active') : t('inactive')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">{tmpl.pdf_filename}</p>
              </div>
            </div>
            {tmpl.fields && tmpl.fields.length > 0 && (
              <div className={`flex flex-wrap gap-1 mb-1 ${isRTL ? 'justify-end' : ''}`}>
                {Array.from(new Set(tmpl.fields.map(f => f.type))).slice(0, 5).map(type => (
                  <span key={type} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{type}</span>
                ))}
              </div>
            )}
          </div>

          <div className={`px-5 pb-5 flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <a href={`/form/${tmpl.id}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#222d64', backgroundColor: '#222d6410' }}>
              <ExternalLink className="w-3 h-3" />{t('viewForm')}
            </a>
            <Link to={`/admin/templates/${tmpl.id}/edit`}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#f9b106', backgroundColor: '#f9b10615' }}>
              <Edit2 className="w-3 h-3" />{isRTL ? 'تعديل' : 'Edit'}
            </Link>
            <button onClick={() => copyLink(tmpl.id)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
              {copiedId === tmpl.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
              {copiedId === tmpl.id ? t('linkCopied') : t('copyLink')}
            </button>
            <button onClick={() => toggleStatus(tmpl.id, tmpl.is_active)}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">
              {tmpl.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              {t('toggleStatus')}
            </button>
            <button onClick={() => handleDelete(tmpl.id)}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors ms-auto">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Integrations Tab ─── */
function IntegrationsTab() {
  const { isRTL } = useLanguage();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [oneDriveUrl, setOneDriveUrl] = useState('');
  const [gDriveUrl, setGDriveUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [savingOneDrive, setSavingOneDrive] = useState(false);
  const [savingGDrive, setSavingGDrive] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    supabase.from('school_settings')
      .select('key, value')
      .in('key', ['global_webhook_url', 'onedrive_webhook_url', 'gdrive_webhook_url'])
      .then(({ data }) => {
        if (data) {
          data.forEach((row: { key: string; value: string }) => {
            if (row.key === 'global_webhook_url') setWebhookUrl(row.value || '');
            if (row.key === 'onedrive_webhook_url') setOneDriveUrl(row.value || '');
            if (row.key === 'gdrive_webhook_url') setGDriveUrl(row.value || '');
          });
        }
        setLoadingSettings(false);
      });
  }, []);

  const saveSetting = async (
    key: string,
    value: string,
    setSaving: (v: boolean) => void,
    setSaved?: (v: boolean) => void
  ) => {
    setSaving(true);
    await supabase.from('school_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (setSaved) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const integrations = [
    {
      id: 'webhook',
      icon: Webhook,
      iconBg: '#f0fdf4',
      iconColor: '#16a34a',
      title: isRTL ? 'Webhook العام' : 'Global Webhook',
      titleAr: 'ويب هوك',
      description: isRTL
        ? 'أرسل بيانات كل طلب إلى أي خدمة خارجية (Power Automate، Zapier، إلخ)'
        : 'Send all submission data to any external service (Power Automate, Zapier, etc.)',
      placeholder: 'https://prod-xx.logic.azure.com/...',
      value: webhookUrl,
      onChange: setWebhookUrl,
      onSave: () => saveSetting('global_webhook_url', webhookUrl, setSavingWebhook, setWebhookSaved),
      saving: savingWebhook,
      saved: webhookSaved,
      badge: isRTL ? 'نشط' : 'Active',
      badgeColor: webhookUrl ? '#16a34a' : '#9ca3af',
      badgeBg: webhookUrl ? '#f0fdf4' : '#f3f4f6',
    },
    {
      id: 'onedrive',
      icon: HardDrive,
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
      title: 'OneDrive',
      titleAr: 'ون درايف',
      description: isRTL
        ? 'ارفع نسخة من كل PDF موقّع إلى مجلد OneDrive الخاص بك عبر Power Automate'
        : 'Upload a copy of each signed PDF to your OneDrive folder via Power Automate webhook',
      placeholder: 'https://prod-xx.logic.azure.com/workflows/...',
      value: oneDriveUrl,
      onChange: setOneDriveUrl,
      onSave: () => saveSetting('onedrive_webhook_url', oneDriveUrl, setSavingOneDrive),
      saving: savingOneDrive,
      saved: false,
      badge: 'Power Automate',
      badgeColor: '#2563eb',
      badgeBg: '#eff6ff',
    },
    {
      id: 'gdrive',
      icon: Cloud,
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      title: 'Google Drive',
      titleAr: 'جوجل درايف',
      description: isRTL
        ? 'ارفع ملفات PDF الموقعة إلى Google Drive عبر رابط webhook من Google Apps Script أو Zapier'
        : 'Upload signed PDFs to Google Drive via a webhook URL from Google Apps Script or Zapier',
      placeholder: 'https://script.google.com/macros/s/...',
      value: gDriveUrl,
      onChange: setGDriveUrl,
      onSave: () => saveSetting('gdrive_webhook_url', gDriveUrl, setSavingGDrive),
      saving: savingGDrive,
      saved: false,
      badge: 'Apps Script / Zapier',
      badgeColor: '#d97706',
      badgeBg: '#fef3c7',
    },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className={`${isRTL ? 'text-right' : ''}`}>
        <p className="text-sm text-gray-500">
          {isRTL
            ? 'اربط نماذجك بالخدمات الخارجية لأتمتة سير العمل'
            : 'Connect your forms to external services to automate your workflow'}
        </p>
      </div>

      {loadingSettings ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map(integration => (
            <div key={integration.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className={`p-6 ${isRTL ? 'text-right' : ''}`}>
                <div className={`flex items-start gap-4 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: integration.iconBg }}
                  >
                    <integration.icon className="w-5 h-5" style={{ color: integration.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`flex items-center gap-2 flex-wrap mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <h3 className="font-bold text-gray-900 text-sm">
                        {isRTL ? integration.titleAr : integration.title}
                      </h3>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: integration.badgeColor, backgroundColor: integration.badgeBg }}
                      >
                        {integration.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{integration.description}</p>
                  </div>
                </div>

                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="url"
                    value={integration.value}
                    onChange={e => integration.onChange(e.target.value)}
                    placeholder={integration.placeholder}
                    dir="ltr"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:border-transparent bg-gray-50"
                    style={{ '--tw-ring-color': '#222d64' } as React.CSSProperties}
                  />
                  <button
                    onClick={integration.onSave}
                    disabled={integration.saving}
                    className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:brightness-110 disabled:opacity-60 flex-shrink-0"
                    style={{ backgroundColor: integration.saved ? '#16a34a' : '#222d64' }}
                  >
                    {integration.saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : integration.saved ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {integration.saved ? (isRTL ? 'تم الحفظ' : 'Saved!') : (isRTL ? 'حفظ' : 'Save')}
                  </button>
                </div>

                {integration.value && (
                  <div className={`mt-3 flex items-center gap-1.5 text-xs text-green-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {isRTL ? 'متصل — سيتم الإرسال عند كل طلب جديد' : 'Connected — will fire on each new submission'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#222d64]/5 border border-[#222d64]/10 rounded-2xl p-5">
        <h4 className={`font-bold text-sm mb-2 ${isRTL ? 'text-right' : ''}`} style={{ color: '#222d64' }}>
          {isRTL ? 'كيف يعمل؟' : 'How it works'}
        </h4>
        <ul className={`text-xs text-gray-600 space-y-1.5 leading-relaxed ${isRTL ? 'text-right' : ''}`}>
          <li>{isRTL ? '• عند إرسال نموذج جديد، يتم إرسال بيانات JSON إلى الرابط المحدد' : '• When a form is submitted, JSON data is posted to the configured URL'}</li>
          <li>{isRTL ? '• يتضمن الحمولة: رقم المرجع، بيانات النموذج، معرف القالب، ورابط PDF' : '• Payload includes: reference number, form data, template ID, and PDF URL'}</li>
          <li>{isRTL ? '• يمكنك استخدام Power Automate أو Zapier أو Make.com لأتمتة سير عملك' : '• Use Power Automate, Zapier, or Make.com to automate your workflow'}</li>
        </ul>
      </div>
    </div>
  );
}

/* ─── Settings Tab ─── */
function SettingsTab() {
  const { isRTL } = useLanguage();
  const { logoUrl, bgImageUrl, logoSize, refreshLogo } = useLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [success, setSuccess] = useState('');
  const [uploadingBg, setUploadingBg] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [savingSize, setSavingSize] = useState(false);
  const [localLogoSize, setLocalLogoSize] = useState<'sm' | 'md' | 'lg'>(logoSize);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(isRTL ? 'يرجى اختيار ملف صورة' : 'Please select an image file.');
      return;
    }
    setUploading(true);
    setSuccess('');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const { error } = await supabase
        .from('school_settings')
        .upsert({ key: 'school_logo', value: base64, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (!error) {
        refreshLogo();
        setSuccess(isRTL ? 'تم تحديث الشعار بنجاح' : 'Logo updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemove = async () => {
    if (!confirm(isRTL ? 'هل تريد حذف الشعار؟' : 'Remove the school logo?')) return;
    setRemoving(true);
    await supabase.from('school_settings').delete().eq('key', 'school_logo');
    refreshLogo();
    setRemoving(false);
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(isRTL ? 'يرجى اختيار ملف صورة' : 'Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(isRTL ? 'الحجم الأقصى 5 ميجابايت' : 'Maximum file size is 5MB.');
      return;
    }
    setUploadingBg(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await supabase.from('school_settings')
        .upsert({ key: 'hero_bg_image', value: base64, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      refreshLogo();
      setUploadingBg(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBgRemove = async () => {
    if (!confirm(isRTL ? 'هل تريد حذف صورة الخلفية؟' : 'Remove the background image?')) return;
    setRemovingBg(true);
    await supabase.from('school_settings').delete().eq('key', 'hero_bg_image');
    refreshLogo();
    setRemovingBg(false);
  };

  const handleLogoSizeChange = async (size: 'sm' | 'md' | 'lg') => {
    setLocalLogoSize(size);
    setSavingSize(true);
    await supabase.from('school_settings')
      .upsert({ key: 'logo_size', value: size, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    refreshLogo();
    setSavingSize(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* School Logo */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: '#222d640a' }}>
          <h2 className="font-bold text-sm" style={{ color: '#222d64' }}>
            {isRTL ? 'شعار المدرسة' : 'School Logo'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isRTL ? 'يظهر في الشريط العلوي وصفحة الدخول والنماذج' : 'Displayed in the navbar, login page, and forms'}
          </p>
        </div>
        <div className="p-6">
          {logoUrl ? (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {isRTL ? 'الشعار الحالي' : 'Current Logo'}
              </p>
              <div className="inline-flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <img src={logoUrl} alt="School Logo" className="h-16 w-auto object-contain max-w-[200px]" />
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#222d64' }}>
                  <img src={logoUrl} alt="School Logo on Navy" className="h-10 w-auto object-contain max-w-[120px]" style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center">
                <ImageOff className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">{isRTL ? 'لا يوجد شعار محمل حالياً' : 'No logo uploaded yet'}</p>
            </div>
          )}
          <div className={`flex flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl transition-all text-sm text-white hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: '#222d64' }}
            >
              {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
              {logoUrl ? (isRTL ? 'تغيير الشعار' : 'Change Logo') : (isRTL ? 'رفع الشعار' : 'Upload Logo')}
            </button>
            {logoUrl && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="inline-flex items-center gap-2 text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-colors"
              >
                {removing ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <ImageOff className="w-4 h-4" />}
                {isRTL ? 'حذف الشعار' : 'Remove Logo'}
              </button>
            )}
          </div>
          {success && (
            <div className="mt-4 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl text-sm font-medium">
              <Check className="w-4 h-4" />{success}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">
            {isRTL ? 'يُوصى برفع صورة PNG بخلفية شفافة بحجم أقصى 2 ميجابايت' : 'Recommended: PNG with transparent background, max 2MB'}
          </p>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: '#222d640a' }}>
          <h2 className="font-bold text-sm" style={{ color: '#222d64' }}>
            {isRTL ? 'المظهر' : 'Appearance'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isRTL ? 'صورة خلفية الصفحة الرئيسية وحجم الشعار' : 'Hero background image and logo size'}
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* Logo Size */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {isRTL ? 'حجم الشعار' : 'Logo Size'}
            </p>
            <div className="flex gap-2">
              {(['sm', 'md', 'lg'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => handleLogoSizeChange(size)}
                  disabled={savingSize}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                    localLogoSize === size
                      ? 'text-white border-transparent'
                      : 'text-gray-500 bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                  style={localLogoSize === size ? { backgroundColor: '#222d64', borderColor: '#222d64' } : {}}
                >
                  {size === 'sm' ? (isRTL ? 'صغير' : 'Small') : size === 'md' ? (isRTL ? 'متوسط' : 'Medium') : (isRTL ? 'كبير' : 'Large')}
                </button>
              ))}
            </div>
          </div>

          {/* Hero Background Image */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {isRTL ? 'صورة خلفية الصفحة الرئيسية' : 'Hero Background Image'}
            </p>
            {bgImageUrl ? (
              <div className="mb-4">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 h-32">
                  <img src={bgImageUrl} alt="Background" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-semibold">{isRTL ? 'الصورة الحالية' : 'Current background'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <ImageOff className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <p className="text-sm text-gray-500">{isRTL ? 'لا توجد صورة خلفية' : 'No background image set'}</p>
              </div>
            )}
            <div className={`flex flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
              <button
                onClick={() => bgFileRef.current?.click()}
                disabled={uploadingBg}
                className="inline-flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl transition-all text-sm hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: '#222d6415', color: '#222d64' }}
              >
                {uploadingBg ? <div className="w-4 h-4 border-2 border-[#222d64] border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                {bgImageUrl ? (isRTL ? 'تغيير الخلفية' : 'Change Background') : (isRTL ? 'رفع صورة خلفية' : 'Upload Background')}
              </button>
              {bgImageUrl && (
                <button
                  onClick={handleBgRemove}
                  disabled={removingBg}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-colors"
                >
                  {removingBg ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <ImageOff className="w-4 h-4" />}
                  {isRTL ? 'حذف الخلفية' : 'Remove Background'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {isRTL ? 'الحجم الأقصى 5 ميجابايت — JPG أو PNG' : 'Max 5MB — JPG or PNG recommended'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Analytics Tab ─── */
function AnalyticsTab() {
  const { isRTL } = useLanguage();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    supabase.from('submissions').select('created_at, status')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setSubmissions((data as Submission[]) || []); setLoading(false); });
  }, []);

  const barData = (() => {
    const result: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' });
      const count = submissions.filter(s => s.created_at.slice(0, 10) === key).length;
      result.push({ date: label, count });
    }
    return result;
  })();

  const completed = submissions.filter(s => s.status === 'completed').length;
  const pending = submissions.filter(s => s.status !== 'completed').length;
  const donutData = [
    { name: isRTL ? 'مكتملة' : 'Completed', value: completed },
    { name: isRTL ? 'قيد الانتظار' : 'Pending', value: pending },
  ];
  const DONUT_COLORS = ['#16a34a', '#f9b106'];

  if (loading) return (
    <div className="py-16 flex justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#222d64' }}>{isRTL ? 'الطلبات عبر الزمن' : 'Submissions Over Time'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{isRTL ? `آخر ${days} يوم` : `Last ${days} days`}</p>
          </div>
          <div className="flex gap-1">
            {([7, 14, 30] as const).map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${days === d ? 'text-white' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                style={days === d ? { backgroundColor: '#222d64' } : {}}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={Math.floor(days / 7)} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 12 }}
                cursor={{ fill: '#222d640a' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={32}>
                {barData.map((_, i) => (
                  <Cell key={i} fill="#222d64" fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-sm" style={{ color: '#222d64' }}>{isRTL ? 'توزيع الحالات' : 'Status Distribution'}</h3>
        </div>
        <div className="p-6 flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-1/2" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  dataKey="value" paddingAngle={3}>
                  {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 12, color: '#374151' }}>{v}</span>} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full md:w-1/2 space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-600" />
                <span className="text-sm font-semibold text-green-700">{isRTL ? 'مكتملة' : 'Completed'}</span>
              </div>
              <span className="text-xl font-extrabold text-green-700">{completed}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm font-semibold text-amber-700">{isRTL ? 'قيد الانتظار' : 'Pending'}</span>
              </div>
              <span className="text-xl font-extrabold text-amber-700">{pending}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm font-semibold text-gray-600">{isRTL ? 'الإجمالي' : 'Total'}</span>
              </div>
              <span className="text-xl font-extrabold text-gray-700">{submissions.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Users Tab ─── */
/* ─── Users Tab ─── */
/* REPLACE the entire UsersTab function in AdminDashboard.tsx */

function UsersTab() {
  const { isRTL } = useLanguage();
  const [users, setUsers] = useState<Array<{ user_id: string; role: string; email?: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Add user modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Change password modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwUserId, setPwUserId] = useState('');
  const [pwUserEmail, setPwUserEmail] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id, role, created_at')
      .order('created_at', { ascending: true });
    if (!data) { setLoading(false); return; }

    // Try to get emails via admin API
    try {
      const { data: authData } = await (supabase.auth as any).admin.listUsers();
      const emailMap: Record<string, string> = {};
      if (authData?.users) {
        authData.users.forEach((u: { id: string; email: string }) => {
          emailMap[u.id] = u.email;
        });
      }
      setUsers(data.map((r: { user_id: string; role: string; created_at: string }) => ({
        ...r,
        email: emailMap[r.user_id] || '',
      })));
    } catch {
      setUsers(data.map((r: { user_id: string; role: string; created_at: string }) => ({
        ...r,
        email: '',
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setSaving(userId);
    await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
    setSaving(null);
  };

  const handleAddUser = async () => {
    setAddError('');
    if (!newEmail.trim() || !newPassword.trim()) {
      setAddError(isRTL ? 'أدخل الإيميل وكلمة المرور' : 'Enter email and password');
      return;
    }
    if (newPassword.length < 6) {
      setAddError(isRTL ? 'كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    setAddLoading(true);
    try {
      const { data, error } = await (supabase.auth as any).admin.createUser({
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        email_confirm: true,
      });
      if (error) throw error;
      const userId = data?.user?.id;
      if (userId) {
        await supabase.from('user_roles').upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });
      }
      setShowAddModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('staff');
      await fetchUsers();
    } catch (err: any) {
      setAddError(err?.message || (isRTL ? 'حدث خطأ' : 'An error occurred'));
    }
    setAddLoading(false);
  };

  const openPwModal = (userId: string, email: string) => {
    setPwUserId(userId);
    setPwUserEmail(email);
    setNewPw('');
    setPwError('');
    setPwSuccess(false);
    setShowPwModal(true);
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (newPw.length < 6) {
      setPwError(isRTL ? 'كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await (supabase.auth as any).admin.updateUserById(pwUserId, { password: newPw });
      if (error) throw error;
      setPwSuccess(true);
      setTimeout(() => setShowPwModal(false), 1500);
    } catch (err: any) {
      setPwError(err?.message || (isRTL ? 'حدث خطأ' : 'An error occurred'));
    }
    setPwLoading(false);
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(isRTL ? `هل تريد حذف المستخدم ${email}؟` : `Delete user ${email}?`)) return;
    try {
      await (supabase.auth as any).admin.deleteUser(userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    } catch (err: any) {
      alert(err?.message || 'Error deleting user');
    }
  };

  const roleColors: Record<string, string> = {
    super_admin: '#b45309',
    admin: '#1d4ed8',
    staff: '#374151',
  };
  const roleBgs: Record<string, string> = {
    super_admin: '#fef3c7',
    admin: '#eff6ff',
    staff: '#f3f4f6',
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white text-gray-800";

  return (
    <div className="max-w-3xl space-y-6">

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className={`flex items-center justify-between mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-extrabold text-base" style={{ color: '#222d64' }}>
                {isRTL ? 'إضافة مستخدم جديد' : 'Add New User'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {isRTL ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="user@school.com"
                  className={inputCls}
                  dir="ltr"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {isRTL ? 'كلمة المرور' : 'Password'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                  dir="ltr"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {isRTL ? '6 أحرف على الأقل' : 'Minimum 6 characters'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {isRTL ? 'الدور' : 'Role'}
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className={inputCls}
                >
                  <option value="staff">Staff — {isRTL ? 'عرض الطلبات فقط' : 'View submissions only'}</option>
                  <option value="admin">Admin — {isRTL ? 'إدارة القوالب والطلبات' : 'Manage templates & submissions'}</option>
                  <option value="super_admin">Super Admin — {isRTL ? 'وصول كامل' : 'Full access'}</option>
                </select>
              </div>

              {addError && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {addError}
                </div>
              )}
            </div>

            <div className={`flex gap-3 mt-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={handleAddUser}
                disabled={addLoading}
                className="flex-1 flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl text-white text-sm transition-all hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: '#222d64' }}
              >
                {addLoading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Plus className="w-4 h-4" />
                }
                {isRTL ? 'إضافة' : 'Add User'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className={`flex items-center justify-between mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-extrabold text-base" style={{ color: '#222d64' }}>
                {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
              </h3>
              <button onClick={() => setShowPwModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4 bg-gray-50 rounded-xl px-4 py-2.5 font-mono">
              {pwUserEmail}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                  dir="ltr"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  {isRTL ? '6 أحرف على الأقل' : 'Minimum 6 characters'}
                </p>
              </div>

              {pwError && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {pwError}
                </div>
              )}

              {pwSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully'}
                </div>
              )}
            </div>

            <div className={`flex gap-3 mt-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={handleChangePassword}
                disabled={pwLoading || pwSuccess}
                className="flex-1 flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl text-white text-sm transition-all hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: pwSuccess ? '#16a34a' : '#222d64' }}
              >
                {pwLoading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : pwSuccess
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <Lock className="w-4 h-4" />
                }
                {pwSuccess ? (isRTL ? 'تم!' : 'Done!') : (isRTL ? 'تغيير' : 'Change')}
              </button>
              <button
                onClick={() => setShowPwModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`} style={{ backgroundColor: '#222d640a' }}>
          <div>
            <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: '#222d64' }}>
              <Shield className="w-4 h-4" />
              {isRTL ? 'إدارة المستخدمين والأدوار' : 'Users & Roles'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isRTL ? 'تحكم في صلاحيات كل مستخدم' : 'Control permissions for each user'}
            </p>
          </div>
          <button
            onClick={() => { setAddError(''); setShowAddModal(true); }}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl text-white transition-all hover:brightness-110"
            style={{ backgroundColor: '#222d64' }}
          >
            <Plus className="w-4 h-4" />
            {isRTL ? 'مستخدم جديد' : 'Add User'}
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {isRTL ? 'لا يوجد مستخدمون بعد' : 'No users yet'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map(user => (
              <div key={user.user_id} className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ backgroundColor: roleBgs[user.role] || '#f3f4f6', color: roleColors[user.role] || '#374151' }}>
                  {(user.email || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {user.email || <span className="text-gray-400 font-mono text-xs">{user.user_id.slice(0, 12)}…</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isRTL ? 'انضم' : 'Joined'} {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Role badge + select */}
                <div className={`flex items-center gap-2 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full hidden sm:inline" style={{ color: roleColors[user.role] || '#374151', backgroundColor: roleBgs[user.role] || '#f3f4f6' }}>
                    {user.role.replace('_', ' ')}
                  </span>
                  <select
                    value={user.role}
                    onChange={e => handleRoleChange(user.user_id, e.target.value)}
                    disabled={saving === user.user_id}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white text-gray-700 disabled:opacity-60 cursor-pointer"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  {saving === user.user_id && (
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
                  )}
                </div>

                {/* Actions */}
                <div className={`flex items-center gap-1 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => openPwModal(user.user_id, user.email || '')}
                    className="p-2 rounded-lg text-gray-400 hover:text-[#222d64] hover:bg-blue-50 transition-all"
                    title={isRTL ? 'تغيير كلمة المرور' : 'Change password'}
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.user_id, user.email || '')}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    title={isRTL ? 'حذف المستخدم' : 'Delete user'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Roles guide */}
      <div className="bg-[#222d64]/5 border border-[#222d64]/10 rounded-2xl p-5">
        <h4 className="font-bold text-sm mb-3" style={{ color: '#222d64' }}>
          {isRTL ? 'مستويات الصلاحيات' : 'Permission Levels'}
        </h4>
        <div className="space-y-2 text-xs text-gray-600">
          {[
            { role: 'Super Admin', color: '#b45309', desc: isRTL ? 'وصول كامل: القوالب، الطلبات، الإعدادات، إدارة المستخدمين' : 'Full access: templates, submissions, settings, user management' },
            { role: 'Admin', color: '#1d4ed8', desc: isRTL ? 'القوالب، الطلبات، الإعدادات' : 'Templates, submissions, settings' },
            { role: 'Staff', color: '#374151', desc: isRTL ? 'عرض الطلبات فقط' : 'View submissions only' },
          ].map(item => (
            <div key={item.role} className="flex items-start gap-2">
              <span className="font-bold w-24 flex-shrink-0" style={{ color: item.color }}>{item.role}</span>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}