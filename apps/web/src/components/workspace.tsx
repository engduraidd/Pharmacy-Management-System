'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Activity, Bell, CalendarClock, ClipboardList, LayoutDashboard, LogOut, Menu, Package, Pill, ShieldCheck, ShoppingCart, X } from 'lucide-react';
import { useAuth } from './auth-provider';
import { api, errorMessage } from '@/lib/api';
import { Loading } from './ui';

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/medicines', label: 'Medicines', icon: Pill },
  { href: '/inventory', label: 'Inventory & batches', icon: Package },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/expiry', label: 'Expiry alerts', icon: CalendarClock },
  { href: '/reports', label: 'Reports', icon: ClipboardList },
];

export function Workspace({ children }: { children: ReactNode }) {
  const { session, loading, setSession } = useAuth();
  const router = useRouter(); const pathname = usePathname();
  const [open, setOpen] = useState(false); const [logoutError, setLogoutError] = useState('');
  useEffect(() => { if (!loading && !session) router.replace('/login'); }, [loading, session, router]);
  if (loading || !session) return <Loading />;
  const { user } = session;
  const section = navigation.find(item => pathname.startsWith(item.href))?.label ?? 'Workspace';
  async function logout() {
    try { await api('/auth/logout', { method: 'POST', body: {} }); setSession(null); router.replace('/login'); }
    catch (error) { setLogoutError(errorMessage(error)); }
  }
  return <div className="workspace">
    {open && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <Link className="brand" href="/dashboard"><span className="brand-mark"><Pill size={24} /></span><span>PharmaDesk<small>PHARMACY MANAGEMENT</small></span></Link>
      <div className="pharmacy-location"><span className="location-dot" />Al-Hamdaniyah, Mosul</div>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Main navigation">{navigation.filter(item => item.href !== '/reports' || user.role === 'OWNER').map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
        className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}><item.icon size={19} />{item.label}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={20} /><div>Carefully protected<small>Your role controls access.</small></div></div>
        <div className="sidebar-profile"><span className="avatar">{user.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}</span><div><strong>{user.fullName}</strong><small>{user.role === 'OWNER' ? 'Pharmacy owner' : 'Pharmacy employee'}</small></div>
          <button className="logout-button" aria-label="Sign out" onClick={logout}><LogOut size={18} /></button></div>
        {logoutError && <p className="logout-error" role="alert">{logoutError}</p>}
      </div>
    </aside>
    <div className="workspace-main"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}>{open ? <X size={20} /> : <Menu size={20} />}</button><span>Workspace</span><span className="slash">/</span><strong>{section}</strong></div>
      <div className="topbar-right"><span className="local-label"><Activity size={14} />Local demonstration</span><Link href="/expiry" className="icon-button" aria-label="View expiry alerts"><Bell size={19} /></Link><span className="role-chip">{user.role === 'OWNER' ? 'Owner' : 'Employee'}</span></div>
    </header><div className="page-content">{children}<footer className="page-footer"><span>Pharmacy Management System</span><span>SE421 · Al-Hamdaniyah, Mosul</span></footer></div></div>
  </div>;
}
