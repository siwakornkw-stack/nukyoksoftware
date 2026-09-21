import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { getVehicleFormOptions } from "@/lib/fleet/master";
import { PageHeader } from "@/components/ui";
import { dec } from "@/lib/fleet/queries";
import { VehicleForm, type VehicleInit } from "../../VehicleForm";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [v, options] = await Promise.all([
    prisma.vehicle.findFirst({ where: { VehicleId: id, TenantId: DEFAULT_TENANT_ID } }),
    getVehicleFormOptions(),
  ]);
  if (!v) notFound();

  const initial: VehicleInit = {
    platePrefix: v.LicensePlatePrefix,
    plateSuffix: v.LicensePlateSuffix,
    plateProvince: v.LicensePlateProvince,
    vehicleTypeId: v.VehicleTypeId ?? "",
    vehicleBrandId: v.VehicleBrandId ?? "",
    model: v.Model,
    color: v.Color,
    vehicleOwnerId: v.VehicleOwnerId ?? "",
    vehicleDepartmentId: v.VehicleDepartmentId ?? "",
    vehicleDriverId: v.VehicleDriverId ?? "",
    vehicleStatusId: v.VehicleStatusId ?? "",
    fuelTypeId: v.FuelTypeId ?? "",
    installmentPeriods: v.InstallmentPeriods != null ? String(v.InstallmentPeriods) : "",
    installmentAmount: v.InstallmentAmount != null ? String(dec(v.InstallmentAmount)) : "",
    note: v.Note ?? "",
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="แก้ไขรถ"
        subtitle={`${v.LicensePlatePrefix} ${v.LicensePlateSuffix} ${v.LicensePlateProvince}`}
      />
      <VehicleForm options={options} vehicleId={v.VehicleId} initial={initial} />
    </div>
  );
}
