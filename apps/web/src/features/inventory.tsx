'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CalendarClock, LockKeyhole, Package, Pill, Plus, Search, TriangleAlert } from 'lucide-react';
import type { BatchRecord, MedicineRecord, ReportData } from '@pharmacy/shared';
import { useAuth } from '@/components/auth-provider';
import { Empty, ErrorNotice, Loading, Modal, PageHeader, StatusBadge, SubmitButton } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { calendarDate, money, timestamp } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

export function BatchTable({ batches, showCosts = false, recordCost }: { batches: BatchRecord[]; showCosts?: boolean; recordCost?: (batch: BatchRecord) => void }) {
  const { session } = useAuth();
  return <div className="table-wrap"><table><thead><tr><th>Medicine / batch</th><th>On hand</th><th>Expiry date</th><th>Status</th>{showCosts && <th>Purchase price · private</th>}</tr></thead><tbody>{batches.map(batch => <tr key={batch.batchId}>
    <td><div className="medicine-cell"><span className="medicine-icon"><Pill size={16} /></span><div><Link href={`/medicines/${batch.medicineId}`} className="table-primary">{batch.medicine.name}</Link><p className="table-secondary">Batch #{batch.batchId} · {batch.medicine.brand || 'No brand'}</p></div></div></td>
    <td><span className="table-primary">{batch.quantity.toLocaleString()}</span><span className="table-secondary"> units</span></td><td>{calendarDate(batch.expiryDate)}</td><td><StatusBadge status={batch.status} /></td>
    {showCosts && <td>{batch.supplierPurchasePrice == null ? recordCost ? <button className="button small" onClick={() => recordCost(batch)}>Record cost</button> : <span className="muted">Not recorded</span> : <span className="table-primary">{money(batch.supplierPurchasePrice, session?.settings.currency)}</span>}</td>}
  </tr>)}</tbody></table></div>;
}

function BatchForm({ saved, close }: { saved: () => void; close: () => void }) {
  const { session } = useAuth(); const owner = session?.user.role === 'OWNER'; const medicines = useResource<MedicineRecord[]>('/medicines');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget);
    const body = { medicineId: Number(form.get('medicineId')), quantity: Number(form.get('quantity')), expiryDate: String(form.get('expiryDate')),
      ...(owner ? { supplierPurchasePrice: String(form.get('supplierPurchasePrice')) } : {}) };
    try { await api('/batches', { method: 'POST', body }); saved(); close(); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <Modal title="Add a stock batch" close={close}><form className="form-body" onSubmit={submit}><ErrorNotice message={error || medicines.error} />
    <label>Medicine<select name="medicineId" required defaultValue=""><option value="" disabled>Select a medicine</option>{medicines.data?.map(medicine => <option value={medicine.medicineId} key={medicine.medicineId}>{medicine.name}</option>)}</select>{!medicines.loading && !medicines.data?.length && <span className="form-hint">Add a medicine to the catalog first.</span>}</label>
    <div className="form-grid"><label>Quantity (whole units)<input name="quantity" type="number" min={1} max={1_000_000} required step={1} placeholder="e.g. 30" /></label><label>Expiry date<input type="date" name="expiryDate" required /></label></div>
    {owner ? <label>Supplier purchase price ({session.settings.currency})<input name="supplierPurchasePrice" required inputMode="decimal" pattern="(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?" placeholder="0.00" /><span className="form-hint">Private to the owner. This value is never sent to employee accounts.</span></label> : <div className="notice"><LockKeyhole size={17} /><span>Purchase costs are recorded privately by the owner. You can record quantity and expiry information here.</span></div>}
    <p className="form-hint">Each batch keeps its own expiry date. Expired stock is retained for tracking and blocked from sales.</p><div className="form-actions"><button className="button" type="button" onClick={close}>Cancel</button><SubmitButton busy={busy}>Add batch</SubmitButton></div>
  </form></Modal>;
}

function RecordCost({ batch, saved, close }: { batch: BatchRecord; saved: () => void; close: () => void }) {
  const { session } = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const value = String(new FormData(event.currentTarget).get('price'));
    try { await api(`/batches/${batch.batchId}/purchase-price`, { method: 'PATCH', body: { supplierPurchasePrice: value } }); saved(); close(); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <Modal title={`Record purchase cost · batch #${batch.batchId}`} close={close}><form className="form-body" onSubmit={submit}><ErrorNotice message={error} /><p className="muted">{batch.medicine.name}</p><label>Supplier purchase price ({session?.settings.currency})<input name="price" required inputMode="decimal" pattern="(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?" autoFocus placeholder="0.00" /></label><div className="form-actions"><button className="button" type="button" onClick={close}>Cancel</button><SubmitButton busy={busy}>Save private cost</SubmitButton></div></form></Modal>;
}

export function InventoryPage() {
  const { session } = useAuth(); const resource = useResource<BatchRecord[]>('/batches');
  const [adding, setAdding] = useState(false); const [costBatch, setCostBatch] = useState<BatchRecord | null>(null); const [search, setSearch] = useState('');
  const batches = resource.data?.filter(batch => `${batch.medicine.name} ${batch.medicine.brand ?? ''} ${batch.batchId}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <><PageHeader title="Inventory & batches" description="Know what is on your shelves, one batch at a time." action={<button className="button primary" onClick={() => setAdding(true)}><Plus size={16} />Add stock batch</button>} />
    <ErrorNotice message={resource.error} /><section className="card"><div className="toolbar"><div className="search-field"><Search size={17} /><input aria-label="Search inventory" placeholder="Find a medicine or batch…" value={search} onChange={event => setSearch(event.target.value)} /></div><span className="record-count">{batches.length} batches</span></div>
      {resource.loading ? <Loading /> : batches.length ? <BatchTable batches={batches} showCosts={session?.user.role === 'OWNER'} recordCost={setCostBatch} /> : <Empty title="No stock batches found" description="Add a batch to start tracking quantities and expiry dates." />}
    </section>{session?.user.role === 'OWNER' && <p className="form-hint" style={{ marginTop: 14 }}><LockKeyhole size={11} /> Purchase-price information is available only in the owner workspace.</p>}
    {adding && <BatchForm saved={resource.refresh} close={() => setAdding(false)} />}{costBatch && session?.user.role === 'OWNER' && <RecordCost batch={costBatch} saved={resource.refresh} close={() => setCostBatch(null)} />}</>;
}

export function ExpiryPage() {
  const { session } = useAuth(); const resource = useResource<BatchRecord[]>('/expiry-alerts'); const [tab, setTab] = useState('ALL');
  const batches = resource.data ?? []; const filtered = batches.filter(batch => tab === 'ALL' || batch.status === tab);
  return <><PageHeader title="Expiry alerts" description={`Keep a closer eye on stock approaching its expiry date. Alert window: ${session?.settings.expiryAlertDays} days.`} />
    <ErrorNotice message={resource.error} /><div className="expiry-summary"><div className="card"><span className="stat-icon red"><TriangleAlert size={22} /></span><div><strong>{batches.filter(batch => batch.status === 'EXPIRED').length}</strong><p>Expired · blocked from sale</p></div></div><div className="card"><span className="stat-icon amber"><CalendarClock size={22} /></span><div><strong>{batches.filter(batch => batch.status === 'EXPIRING').length}</strong><p>Approaching expiry</p></div></div></div>
    <div className="notice warning"><TriangleAlert size={17} /><span>Batches expiring today or earlier cannot be sold. These records remain visible so your team can manage them safely.</span></div>
    <section className="card"><div className="toolbar"><div className="tabs">{[['ALL', 'All alerts'], ['EXPIRED', 'Expired'], ['EXPIRING', 'Expiring soon']].map(([value, label]) => <button key={value} className={`tab ${tab === value ? 'active' : ''}`} onClick={() => setTab(value!)}>{label}</button>)}</div><span className="record-count">{filtered.length} batches</span></div>
      {resource.loading ? <Loading /> : filtered.length ? <BatchTable batches={filtered} /> : <Empty title="No alerts in this view" description="Only stocked batches that have expired or are approaching expiry are shown here." />}
    </section></>;
}

export function ReportsPage() {
  const { session } = useAuth(); const owner = session?.user.role === 'OWNER'; const [report, setReport] = useState('stock');
  const resource = useResource<ReportData>(owner ? `/reports/${report}` : null);
  if (!owner) return <><PageHeader title="Reports" description="Owner-only pharmacy reports." /><ErrorNotice message="Your account does not have access to reports." /></>;
  return <><PageHeader title="Pharmacy reports" description="A clear record of the stock and expiry information stored in your pharmacy." action={<button className="button no-print" onClick={() => window.print()}><ClipboardIcon />Print report</button>} />
    <ErrorNotice message={resource.error} /><section className="card"><div className="toolbar"><div className="tabs no-print"><button className={`tab ${report === 'stock' ? 'active' : ''}`} onClick={() => setReport('stock')}>Stock report</button><button className={`tab ${report === 'expiry' ? 'active' : ''}`} onClick={() => setReport('expiry')}>Expiry report</button></div><span className="record-count">{resource.data ? `Generated ${timestamp(resource.data.generatedAt, session.settings.timeZone)}` : 'Loading report…'}</span></div>
      <div className="card-heading"><div className="report-intro"><span className="medicine-icon">{report === 'stock' ? <Package size={19} /> : <CalendarClock size={19} />}</span><div><h2>{report === 'stock' ? 'Stock report' : 'Expiry report'}</h2><p>{resource.data?.batches.length ?? 0} recorded batches · Owner access</p></div></div><LockKeyhole size={16} color="#8da793" /></div>
      {resource.loading ? <Loading /> : resource.data?.batches.length ? <BatchTable batches={resource.data.batches} showCosts /> : <Empty title="No records for this report" description="The report will update when relevant batches are saved." />}
    </section></>;
}
function ClipboardIcon() { return <Package size={15} />; }
