'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Pencil, Pill, Plus, Search } from 'lucide-react';
import type { BatchRecord, MedicineRecord } from '@pharmacy/shared';
import { useAuth } from '@/components/auth-provider';
import { Empty, ErrorNotice, Loading, Modal, PageHeader, StatusBadge, SubmitButton } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { calendarDate, money } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

function MedicineForm({ medicine, saved, close }: { medicine?: MedicineRecord; saved: () => void; close: () => void }) {
  const { session } = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget);
    const body = { name: String(form.get('name')), brand: String(form.get('brand') ?? '') || null,
      barcode: String(form.get('barcode') ?? '') || null, description: String(form.get('description') ?? '') || null,
      currentSellingPrice: String(form.get('currentSellingPrice')) };
    try { await api(medicine ? `/medicines/${medicine.medicineId}` : '/medicines', { method: medicine ? 'PATCH' : 'POST', body }); saved(); close(); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <Modal title={medicine ? 'Edit medicine' : 'Add a medicine'} close={close}><form className="form-body" onSubmit={submit}><ErrorNotice message={error} />
    <label>Medicine name<input name="name" required minLength={2} maxLength={160} defaultValue={medicine?.name} placeholder="e.g. Paracetamol 500 mg" autoFocus /></label>
    <div className="form-grid"><label>Brand <input name="brand" maxLength={120} defaultValue={medicine?.brand ?? ''} placeholder="Optional" /></label><label>Barcode<input name="barcode" maxLength={80} defaultValue={medicine?.barcode ?? ''} placeholder="Optional" /></label></div>
    <label>Current selling price ({session?.settings.currency})<input name="currentSellingPrice" required inputMode="decimal" pattern="(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?" defaultValue={medicine?.currentSellingPrice} placeholder="0.00" /><span className="form-hint">Price per whole unit, with up to four decimal places.</span></label>
    <label>Description<textarea name="description" maxLength={2000} defaultValue={medicine?.description ?? ''} placeholder="Additional medicine information (optional)" /></label>
    <div className="form-actions"><button className="button" type="button" onClick={close}>Cancel</button><SubmitButton busy={busy}>{medicine ? 'Save changes' : 'Add medicine'}</SubmitButton></div>
  </form></Modal>;
}

export function MedicinesPage() {
  const { session } = useAuth(); const [search, setSearch] = useState(''); const [editing, setEditing] = useState<MedicineRecord | 'new' | null>(null);
  const records = useResource<MedicineRecord[]>(`/medicines?search=${encodeURIComponent(search)}`);
  return <><PageHeader title="Medicine catalog" description="A single, organized home for your medicine information." action={<button className="button primary" onClick={() => setEditing('new')}><Plus size={16} />Add medicine</button>} />
    <ErrorNotice message={records.error} /><section className="card"><div className="toolbar"><div className="search-field"><Search size={17} /><input aria-label="Search medicines" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} placeholder="Search by name, brand or barcode…" /></div><span className="record-count">{records.data?.length ?? 0} medicines</span></div>
      {records.loading ? <Loading /> : !records.data?.length ? <Empty title={search ? 'No medicines match your search' : 'Build your medicine catalog'} description="Add a medicine to begin organizing your pharmacy inventory." /> : <div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Barcode</th><th>Selling price</th><th>Actions</th></tr></thead><tbody>{records.data.map(medicine => <tr key={medicine.medicineId}>
        <td><div className="medicine-cell"><span className="medicine-icon"><Pill size={17} /></span><div><Link className="table-primary" href={`/medicines/${medicine.medicineId}`}>{medicine.name}</Link><p className="table-secondary">{medicine.brand || 'No brand recorded'}</p></div></div></td><td>{medicine.barcode || <span className="muted">Not recorded</span>}</td><td className="table-primary">{money(medicine.currentSellingPrice, session?.settings.currency)}</td>
        <td><div className="row-actions"><Link className="button small" href={`/medicines/${medicine.medicineId}`}>Details <ArrowUpRight size={12} /></Link><button className="icon-button" aria-label={`Edit ${medicine.name}`} onClick={() => setEditing(medicine)}><Pencil size={15} /></button></div></td></tr>)}</tbody></table></div>}
    </section>{editing && <MedicineForm medicine={editing === 'new' ? undefined : editing} saved={records.refresh} close={() => setEditing(null)} />}</>;
}

export function MedicineDetails({ medicineId }: { medicineId: string }) {
  const { session } = useAuth(); const record = useResource<MedicineRecord>(`/medicines/${medicineId}`); const batches = useResource<BatchRecord[]>(`/batches?medicineId=${medicineId}`);
  const [editing, setEditing] = useState(false); const medicine = record.data;
  return <><Link href="/medicines" className="back-link"><ArrowLeft size={14} />Back to medicines</Link><ErrorNotice message={record.error || batches.error} />{record.loading ? <Loading /> : medicine && <>
    <PageHeader title="Medicine details" description="Catalog information and the stock batches linked to this medicine." action={<button className="button primary" onClick={() => setEditing(true)}><Pencil size={15} />Edit medicine</button>} />
    <section className="card"><div className="details-hero"><span className="medicine-icon large"><Pill size={28} /></span><div><h2>{medicine.name}</h2><p className="muted">{medicine.brand || 'No brand recorded'}</p></div></div><dl className="details-grid"><div><dt>MEDICINE ID</dt><dd>#{medicine.medicineId}</dd></div><div><dt>BARCODE</dt><dd>{medicine.barcode || 'Not recorded'}</dd></div><div><dt>CURRENT SELLING PRICE</dt><dd>{money(medicine.currentSellingPrice, session?.settings.currency)}</dd></div></dl>{medicine.description && <p className="details-description">{medicine.description}</p>}</section>
    <section className="card sale-history"><div className="card-heading"><div><h2>Stock batches</h2><p>Expiry dates and quantities are tracked independently for each batch.</p></div><Link href="/inventory" className="text-link">Manage inventory <ArrowUpRight size={14} /></Link></div>
      {!batches.data?.length ? <Empty title="No batches recorded" description="Add a batch from the inventory page to record stock for this medicine." /> : <div className="table-wrap"><table><thead><tr><th>Batch</th><th>Quantity</th><th>Expiry</th><th>Status</th>{session?.user.role === 'OWNER' && <th>Purchase price</th>}</tr></thead><tbody>{batches.data.map(batch => <tr key={batch.batchId}><td>#{batch.batchId}</td><td>{batch.quantity} units</td><td>{calendarDate(batch.expiryDate)}</td><td><StatusBadge status={batch.status} /></td>{session?.user.role === 'OWNER' && <td>{batch.supplierPurchasePrice == null ? 'Not recorded' : money(batch.supplierPurchasePrice, session.settings.currency)}</td>}</tr>)}</tbody></table></div>}
    </section>{editing && <MedicineForm medicine={medicine} saved={() => { record.refresh(); batches.refresh(); }} close={() => setEditing(false)} />}
  </>}</>;
}
