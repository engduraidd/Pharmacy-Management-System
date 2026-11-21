export const APPLICATION_NAME = 'Pharmacy Management System';

/** Process liveness only; this contract does not assert database readiness. */
export interface HealthResponse {
  status: 'ok';
  application: typeof APPLICATION_NAME;
}

export type Role = 'OWNER' | 'EMPLOYEE';
export interface UserProfile { userId: number; fullName: string; username: string; role: Role }
export interface AppSettings { currency: string; timeZone: string; expiryAlertDays: number }
export interface SessionInfo { user: UserProfile; settings: AppSettings }
export interface MedicineRecord {
  medicineId: number; name: string; brand: string | null; description: string | null;
  barcode: string | null; currentSellingPrice: string;
}
export interface BatchRecord {
  batchId: number; medicineId: number; quantity: number; expiryDate: string;
  supplierPurchasePrice?: string | null; status: 'EXPIRED' | 'EXPIRING' | 'VALID'; medicine: MedicineRecord;
}
export interface QuotedItem { batchId: number; medicineId: number; name: string; quantity: number; unitSellingPrice: string; subtotal: string }
export interface SaleQuote { items: QuotedItem[]; totalAmount: string }
export interface SaleRecord {
  saleId: number; userId: number; dateTime: string; totalAmount: string; user: { fullName: string };
  items: { saleItemId: number; batchId: number; quantity: number; unitSellingPrice: string; subtotal: string;
    batch: { medicine: { name: string; brand: string | null } } }[];
}
export interface DashboardData {
  medicines: number; unitsOnHand: number; expiredBatches: number; expiringBatches: number; sales: number;
  recentSales: { saleId: number; dateTime: string; totalAmount: string; user: { fullName: string }; _count: { items: number } }[];
}
export interface ReportData { generatedAt: string; alertDays?: number; batches: BatchRecord[] }
