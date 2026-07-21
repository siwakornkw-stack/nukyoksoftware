import { getMasterOptions } from "@/lib/fleet/master";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "../VehicleForm";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const m = await getMasterOptions();
  const options = {
    types: m.types.map((t) => ({ id: t.VehicleTypeId, name: t.Name })),
    brands: m.brands.map((x) => ({ id: x.VehicleBrandId, name: x.Name })),
    drivers: m.drivers.map((x) => ({ id: x.VehicleDriverId, name: x.Name })),
    fuelTypes: m.fuelTypes.map((x) => ({ id: x.FuelTypeId, name: x.Name })),
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title="เพิ่มรถ" subtitle="กรอกข้อมูลพื้นฐาน (เพิ่มรายละเอียดภายหลังได้)" />
      <VehicleForm options={options} />
    </div>
  );
}
