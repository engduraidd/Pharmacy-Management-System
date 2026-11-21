'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle, X } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow ?? 'PHARMACY WORKSPACE'}</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>;
}
export function ErrorNotice({ message }: { message: string }) { return message ? <div className="notice danger" role="alert"><AlertCircle size={18} /><span>{message}</span></div> : null; }
export function Loading() { return <div className="loading" role="status"><LoaderCircle className="spin" size={22} /> Loading your workspace…</div>; }
export function Empty({ title = 'Nothing here yet', description = 'Records will appear here when you add them.' }: { title?: string; description?: string }) {
  return <div className="empty"><span className="empty-icon"><Inbox size={25} /></span><h3>{title}</h3><p>{description}</p></div>;
}
export function StatusBadge({ status }: { status: 'EXPIRED' | 'EXPIRING' | 'VALID' }) {
  return <span className={`badge ${status === 'EXPIRED' ? 'red' : status === 'EXPIRING' ? 'amber' : 'green'}`}><i />{status === 'EXPIRED' ? 'Expired' : status === 'EXPIRING' ? 'Expiring soon' : 'In date'}</span>;
}
export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div>{children}
  </dialog>;
}
export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button className="button primary" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={16} />}{busy ? 'Saving…' : children}</button>;
}
