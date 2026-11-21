'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Eye, EyeOff, Pill, ShieldCheck } from 'lucide-react';
import type { SessionInfo } from '@pharmacy/shared';
import { useAuth } from '@/components/auth-provider';
import { ErrorNotice, SubmitButton } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

export default function LoginPage() {
  const { session, setSession } = useAuth(); const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [show, setShow] = useState(false);
  useEffect(() => { if (session) router.replace('/dashboard'); }, [session, router]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget);
    try { setSession(await api<SessionInfo>('/auth/login', { method: 'POST', body: { username: form.get('username'), password: form.get('password') } })); router.replace('/dashboard'); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <main className="login-layout"><section className="login-story"><div className="brand"><span className="brand-mark"><Pill size={26} /></span><span>PharmaDesk<small>PHARMACY MANAGEMENT</small></span></div>
    <div className="login-story-body"><span className="login-tag">BUILT FOR EVERYDAY CARE</span><h1>A clearer view.<br />A safer pharmacy.</h1><p>Your medicines, stock and daily sales.<br />Thoughtfully organized in one workspace.</p>
      <div className="login-benefits">{['Know what is on your shelves', 'Catch expiry dates before a sale', 'Keep private prices protected'].map(text => <div key={text}><Check size={16} />{text}</div>)}</div>
      <div className="login-art" aria-hidden="true"><div className="art-cross">+</div><div className="art-pill" /><div className="art-ring" /></div>
    </div><div className="login-story-footer">Al-Hamdaniyah, Mosul, Iraq<span>SE421 PROJECT</span></div></section>
    <section className="login-panel"><div className="login-card"><span className="login-shield"><ShieldCheck size={28} /></span><p className="eyebrow">YOUR PHARMACY WORKSPACE</p><h2>Welcome back</h2><p className="muted">Sign in to continue to Pharmacy Management System.</p><ErrorNotice message={error} />
      <form onSubmit={login}><label>Username<input name="username" autoComplete="username" placeholder="Enter your username" required maxLength={80} autoFocus /></label>
        <label>Password<div className="password-field"><input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required maxLength={256} /><button type="button" className="icon-button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <SubmitButton busy={busy}>Sign in <ArrowRight size={18} /></SubmitButton></form><p className="login-help"><ShieldCheck size={15} /> Access is limited to authorized pharmacy staff.</p>
    </div><p className="login-bottom">Organized stock. Protected information. Better daily work.</p></section></main>;
}
