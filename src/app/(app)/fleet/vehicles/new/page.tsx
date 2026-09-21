import { getVehicleFormOptions } from "@/lib/fleet/master";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "../VehicleForm";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const options = await getVehicleFormOptions();
  return (
    <div className="max-w-3xl">
      <PageHeader title="เพิ่มรถ" subtitle="กรอกข้อมูลพื้นฐาน (เพิ่มรายละเอียดภายหลังได้)" />
      <VehicleForm options={options} />
    </div>
  );
}
