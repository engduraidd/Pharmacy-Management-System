import { MedicineDetails } from '@/features/medicines';
export default async function MedicineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MedicineDetails medicineId={id} />;
}
