'use client';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarClock, CheckCircle2, Package, Pill, Plus, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { BatchRecord, DashboardData } from '@pharmacy/shared';
import { useAuth } from '@/components/auth-provider';
import { Empty, ErrorNotice, Loading, PageHeader, StatusBadge } from '@/components/ui';
import { useResource } from '@/lib/use-resource';
import { calendarDate, money, timestamp } from '@/lib/format';

export function DashboardPage() {
  const { session } = useAuth(); const overview = useResource<DashboardData>('/dashboard'); const alerts = useResource<BatchRecord[]>('/expiry-alerts');
  const data = overview.data; const currency = session?.settings.currency;
  const cards = data ? [
    { label: 'Medicines', value: data.medicines, caption: 'In your medicine catalog', icon: Pill, tone: '' },
    { label: 'Units on hand', value: data.unitsOnHand, caption: 'Across all inventory batches', icon: Package, tone: '' },
    { label: 'Expiring soon', value: data.expiringBatches, caption: `Within ${session?.settings.expiryAlertDays} days`, icon: CalendarClock, tone: 'amber' },
    { label: 'Expired batches', value: data.expiredBatches, caption: 'Blocked from sale', icon: TriangleAlert, tone: 'red' },
  ] : [];
  return <><PageHeader eyebrow="A CLEARER VIEW OF YOUR PHARMACY" title="Pharmacy overview" description={`Welcome back, ${session?.user.fullName ?? 'pharmacy team'}. Here is where things stand.`} action={<Link className="button primary" href="/sales"><Plus size={16} />Record a sale</Link>} />
    <ErrorNotice message={overview.error || alerts.error} />{overview.loading ? <Loading /> : data && <>
      <div className="stats-grid">{cards.map(card => <div className="card stat-card" key={card.label}><div className="stat-top"><span>{card.label}</span><span className={`stat-icon ${card.tone}`}><card.icon size={18} /></span></div><p className="stat-number">{card.value.toLocaleString()}</p><p className="stat-caption">{card.tone === '' && <CheckCircle2 size={11} />}{card.caption}</p></div>)}</div>
      <div className="overview-banner"><span className="banner-symbol"><ShieldCheck size={25} /></span><div className="banner-copy"><h3>A little attention today. Safer care tomorrow.</h3><p>{data.expiredBatches + data.expiringBatches > 0 ? `${data.expiredBatches + data.expiringBatches} batches need expiry attention. Review them before your next sale.` : 'No expiry alerts for stocked batches. Your inventory is up to date.'}</p></div><Link className="button soft" href="/expiry">Review alerts <ArrowRight size={14} /></Link></div>
      <div className="dashboard-columns"><section className="card"><div className="card-heading"><div><h2>Recent sales</h2><p>{data.sales} completed {session?.user.role === 'EMPLOYEE' ? 'by you' : 'in the pharmacy'}</p></div><Link className="text-link" href="/sales">View all <ArrowUpRight size={14} /></Link></div>
        {data.recentSales.length ? <div className="table-wrap"><table><thead><tr><th>Sale</th><th>Recorded</th><th>Total</th></tr></thead><tbody>{data.recentSales.map(sale => <tr key={sale.saleId}><td><span className="table-primary">#{String(sale.saleId).padStart(4, '0')}</span><p className="table-secondary">{sale._count.items} line items</p></td><td>{timestamp(sale.dateTime, session?.settings.timeZone)}<p className="table-secondary">{sale.user.fullName}</p></td><td className="table-primary">{money(sale.totalAmount, currency)}</td></tr>)}</tbody></table></div> : <Empty title="Your first sale starts here" description="Record a sale and its saved details will appear in this overview." />}
      </section><section className="card"><div className="card-heading"><div><h2>Expiry watch</h2><p>Stock that needs your attention</p></div><Link className="text-link" href="/expiry">View all <ArrowUpRight size={14} /></Link></div>
        {alerts.data?.length ? <div className="alert-list">{alerts.data.slice(0, 4).map(batch => <Link href="/expiry" key={batch.batchId} className="alert-item"><span className="medicine-icon"><Pill size={16} /></span><div className="alert-copy"><strong>{batch.medicine.name}</strong><p>Batch #{batch.batchId} · {calendarDate(batch.expiryDate)}</p></div><StatusBadge status={batch.status} /></Link>)}</div> : <Empty title="Nothing to flag" description="Expiry alerts will appear here when a stocked batch needs attention." />}
      </section></div>
    </>}</>;
}
