'use client';
import { useState, type FormEvent } from 'react';
import { CheckCircle2, LockKeyhole, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import type { BatchRecord, MedicineRecord, SaleQuote, SaleRecord } from '@pharmacy/shared';
import { useAuth } from '@/components/auth-provider';
import { Empty, ErrorNotice, Loading, Modal, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { calendarDate, money, timestamp } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

interface CartItem { batchId: number; quantity: number; name: string }

export function SalesPage() {
  const { session } = useAuth();
  const medicines = useResource<MedicineRecord[]>('/medicines'); const batches = useResource<BatchRecord[]>('/batches'); const history = useResource<SaleRecord[]>('/sales');
  const [medicineId, setMedicineId] = useState(''); const [batchId, setBatchId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]); const [quote, setQuote] = useState<SaleQuote | null>(null); const [requestKey, setRequestKey] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [detail, setDetail] = useState<SaleRecord | null>(null);
  const eligible = batches.data?.filter(batch => batch.medicineId === Number(medicineId) && batch.quantity > 0 && batch.status !== 'EXPIRED') ?? [];
  const currency = session?.settings.currency;
  function updateCart(items: CartItem[]) { setCart(items); setQuote(null); setRequestKey(''); setError(''); setSuccess(''); }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const selected = batches.data?.find(batch => batch.batchId === Number(batchId));
    if (!selected) return;
    updateCart([...cart, { batchId: selected.batchId, quantity: Number(form.get('quantity')), name: selected.medicine.name }]);
    event.currentTarget.reset(); setMedicineId(''); setBatchId('');
  }
  async function review() {
    setBusy(true); setError('');
    try {
      const result = await api<SaleQuote>('/sales/preview', { method: 'POST', body: { items: cart.map(({ batchId, quantity }) => ({ batchId, quantity })) } });
      setQuote(result); setRequestKey(crypto.randomUUID());
    } catch (error) { setQuote(null); setError(errorMessage(error)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!quote || !requestKey) return;
    setBusy(true); setError('');
    try {
      const sale = await api<SaleRecord>('/sales', { method: 'POST', body: { requestKey, items: quote.items.map(item => ({ batchId: item.batchId, quantity: item.quantity, expectedUnitPrice: item.unitSellingPrice })) } });
      setCart([]); setQuote(null); setRequestKey(''); setSuccess(`Sale #${String(sale.saleId).padStart(4, '0')} saved. Stock quantities have been updated.`); history.refresh(); batches.refresh(); medicines.refresh();
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <><PageHeader title="Record a sale" description="Select in-date stock, review the total, and confirm with confidence." />
    <ErrorNotice message={error || medicines.error || batches.error || history.error} />{success && <div className="notice success" role="status"><CheckCircle2 size={18} />{success}</div>}
    <div className="sale-layout"><div><section className="card"><div className="card-heading"><div><h2>Build your sale</h2><p>Add one or more medicines from the available batches.</p></div><ShoppingCart size={19} color="#86a18c" /></div>
      <form className="sale-form sale-builder" onSubmit={add}>
        <label>Medicine<select required aria-label="Select medicine" value={medicineId} onChange={event => { setMedicineId(event.target.value); setBatchId(''); }}><option value="">Select medicine</option>{medicines.data?.map(medicine => <option key={medicine.medicineId} value={medicine.medicineId}>{medicine.name}</option>)}</select></label>
        <label>Eligible batch<select required aria-label="Select eligible batch" value={batchId} onChange={event => setBatchId(event.target.value)} disabled={!medicineId}><option value="">{medicineId && eligible.length === 0 ? 'No eligible stock' : 'Select batch'}</option>{eligible.map(batch => <option key={batch.batchId} value={batch.batchId}>#{batch.batchId} · {batch.quantity} units · {calendarDate(batch.expiryDate)}</option>)}</select></label>
        <label>Quantity<input name="quantity" aria-label="Sale quantity" type="number" min={1} max={1_000_000} step={1} required defaultValue={1} /></label><button className="button primary" type="submit" disabled={busy || !batchId || cart.length >= 30}><Plus size={14} />Add</button>
      </form><div className="notice" style={{ margin: '0 24px 22px' }}><LockKeyhole size={15} /><span>Expired and empty batches are excluded. Availability is checked again before the sale is saved.</span></div>
      {!cart.length ? <Empty title="Your sale is empty" description="Choose a medicine and batch above, then add its quantity." /> : <div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Quantity</th><th>Batch</th><th /></tr></thead><tbody>{cart.map((item, index) => <tr key={`${item.batchId}-${index}`}><td className="table-primary">{item.name}</td><td>{item.quantity} units</td><td>#{item.batchId}</td><td><button className="icon-button" aria-label={`Remove ${item.name}`} disabled={busy} onClick={() => updateCart(cart.filter((_, i) => i !== index))}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>}
    </section></div><section className="card"><div className="card-heading"><div><h2>Sale summary</h2><p>Review before confirming</p></div></div><div className="sale-total">
      <div className="summary-line"><span>Cart entries</span><strong>{cart.length}</strong></div>{quote && quote.items.map(item => <div className="summary-line" key={item.batchId}><span>{item.name}<br /><small>{item.quantity} × {money(item.unitSellingPrice, currency)}</small></span><strong>{money(item.subtotal, currency)}</strong></div>)}
      <div className="summary-line"><span>Total amount</span></div><p className="total-amount">{quote ? money(quote.totalAmount, currency) : '—'}</p><p className="muted">{quote ? 'These selling prices will be preserved with the saved sale.' : 'Review the sale to calculate its total using current selling prices.'}</p>
      <button className={`button ${quote ? '' : 'primary'}`} disabled={!cart.length || busy} onClick={review}>{busy ? 'Please wait…' : quote ? 'Refresh price review' : 'Review sale total'}</button>
      {quote && <button className="button primary" disabled={busy} onClick={confirm}><CheckCircle2 size={16} />{busy ? 'Saving sale…' : 'Confirm & save sale'}</button>}
    </div></section></div>
    <section className="card sale-history"><div className="card-heading"><div><h2>{session?.user.role === 'OWNER' ? 'Sales history' : 'Your sales history'}</h2><p>Saved records with the selling prices captured at the time of sale. Latest 100 shown.</p></div></div>
      {history.loading ? <Loading /> : !history.data?.length ? <Empty title="No sales recorded yet" description="Your completed sales will appear here after confirmation." /> : <div className="table-wrap"><table><thead><tr><th>Sale</th><th>Recorded</th><th>Recorded by</th><th>Total</th><th /></tr></thead><tbody>{history.data.map(sale => <tr key={sale.saleId}><td className="table-primary">#{String(sale.saleId).padStart(4, '0')}</td><td>{timestamp(sale.dateTime, session?.settings.timeZone)}</td><td>{sale.user.fullName}</td><td className="table-primary">{money(sale.totalAmount, currency)}</td><td><button className="button small" onClick={() => setDetail(sale)}>View sale</button></td></tr>)}</tbody></table></div>}
    </section>{detail && <Modal title={`Sale #${String(detail.saleId).padStart(4, '0')}`} close={() => setDetail(null)}><div className="form-body"><p className="muted">{timestamp(detail.dateTime, session?.settings.timeZone)} · {detail.user.fullName}</p></div><div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Qty</th><th>Saved unit price</th></tr></thead><tbody>{detail.items.map(item => <tr key={item.saleItemId}><td>{item.batch.medicine.name}<p className="table-secondary">Batch #{item.batchId}</p></td><td>{item.quantity}</td><td>{money(item.unitSellingPrice, currency)}</td></tr>)}</tbody></table></div><div className="form-body"><h2>Total {money(detail.totalAmount, currency)}</h2></div></Modal>}
  </>;
}
