-- CreateTable
CREATE TABLE "DomainName" (
    "DomainNameId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "HostName" TEXT NOT NULL,
    "Type" VARCHAR(15) NOT NULL,

    CONSTRAINT "DomainName_pkey" PRIMARY KEY ("DomainNameId")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "TenantId" VARCHAR(36) NOT NULL,
    "Name" TEXT NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "LineImgUrl" TEXT,
    "LineChannelAccessToken" TEXT,
    "LineChannelSecret" TEXT,
    "SystemExpiredDate" TIMESTAMP(3) NOT NULL,
    "Remark" TEXT,
    "CreatedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("TenantId")
);

-- CreateTable
CREATE TABLE "Admin" (
    "AdminId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "ImageUrl" TEXT,
    "Name" TEXT,
    "Username" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "MobileNo" VARCHAR(50) NOT NULL,
    "LineId" TEXT,
    "LineUserId" TEXT,
    "Email" TEXT NOT NULL,
    "Rank" VARCHAR(15),
    "LatestIpAddress" VARCHAR(45) NOT NULL,
    "LatestLogin" TIMESTAMP(3),
    "CreatedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT NOT NULL DEFAULT 'auto',
    "UpdatedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedByUsername" TEXT,
    "DeletedTime" TIMESTAMP(3),
    "DeletedByUsername" TEXT,
    "IsOnline" BOOLEAN,
    "LatestOnline" TIMESTAMP(3),
    "PasswordHash" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("AdminId")
);

-- CreateTable
CREATE TABLE "Customer" (
    "CustomerId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Role" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "ImageUrl" TEXT,
    "Name" TEXT,
    "Username" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "MobileNo" VARCHAR(50) NOT NULL,
    "LineId" TEXT,
    "LineUserId" TEXT,
    "LinePinVerify" BOOLEAN,
    "PinLine" VARCHAR(4),
    "Email" TEXT,
    "LatestIpAddress" VARCHAR(45) NOT NULL,
    "LatestLogin" TIMESTAMP(3),
    "CreatedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT NOT NULL DEFAULT 'auto',
    "UpdatedTime" TIMESTAMP(3),
    "UpdatedByUsername" TEXT,
    "DeletedTime" TIMESTAMP(3),
    "DeletedByUsername" TEXT,
    "IsOnline" BOOLEAN,
    "LatestOnline" TIMESTAMP(3),
    "PasswordHash" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("CustomerId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "NotificationId" VARCHAR(36) NOT NULL,
    "CustomerId" VARCHAR(36) NOT NULL,
    "Title" TEXT NOT NULL,
    "Message" TEXT NOT NULL,
    "IsRead" BOOLEAN NOT NULL DEFAULT false,
    "CreatedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("NotificationId")
);

-- CreateTable
CREATE TABLE "Setting" (
    "SettingConfigId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "Key" TEXT NOT NULL,
    "Value" TEXT NOT NULL,
    "Category" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("SettingConfigId")
);

-- CreateTable
CREATE TABLE "RefreshTokens" (
    "RefreshTokenId" VARCHAR(36) NOT NULL,
    "HashedToken" TEXT NOT NULL,
    "Revoked" BOOLEAN NOT NULL DEFAULT false,
    "CreatedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedTime" TIMESTAMP(3),
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "CustomerId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,

    CONSTRAINT "RefreshTokens_pkey" PRIMARY KEY ("RefreshTokenId")
);

-- CreateTable
CREATE TABLE "RefreshTokensAdmin" (
    "RefreshTokenId" VARCHAR(36) NOT NULL,
    "HashedToken" TEXT NOT NULL,
    "Revoked" BOOLEAN NOT NULL DEFAULT false,
    "CreatedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedTime" TIMESTAMP(3),
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "AdminId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,

    CONSTRAINT "RefreshTokensAdmin_pkey" PRIMARY KEY ("RefreshTokenId")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "VehicleId" VARCHAR(36) NOT NULL,
    "No" SERIAL NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL DEFAULT 'active',
    "LicensePlatePrefix" TEXT NOT NULL,
    "LicensePlateSuffix" TEXT NOT NULL,
    "LicensePlateProvince" TEXT NOT NULL,
    "VehicleTypeId" VARCHAR(36),
    "VehicleCharacteristic" TEXT NOT NULL,
    "VehicleBrandId" VARCHAR(36),
    "Model" TEXT NOT NULL,
    "Generation" TEXT NOT NULL,
    "Color" TEXT NOT NULL,
    "ChassisNumber" TEXT NOT NULL,
    "EngineNumber" TEXT NOT NULL,
    "EngineBrand" TEXT NOT NULL,
    "FuelTypeId" VARCHAR(36),
    "TankSize" INTEGER NOT NULL,
    "FuelConsumption" INTEGER NOT NULL,
    "CylinderCount" INTEGER NOT NULL,
    "Cylinder" INTEGER NOT NULL,
    "VehicleSize" TEXT NOT NULL,
    "CargoSize" TEXT NOT NULL,
    "GasSerialNumber" TEXT NOT NULL,
    "VehicleWeight" INTEGER NOT NULL,
    "CargoWeight" INTEGER NOT NULL,
    "WheelCount" INTEGER NOT NULL,
    "SeatCount" INTEGER NOT NULL,
    "RegistrationDate" TIMESTAMP(3),
    "StartDate" TIMESTAMP(3),
    "Age" TEXT NOT NULL,
    "Ownership" TEXT NOT NULL,
    "LineNotifyToken" TEXT,
    "VehicleOwnerId" VARCHAR(36),
    "VehicleDepartmentId" VARCHAR(36),
    "VehicleDriverId" VARCHAR(36),
    "VehicleStatusId" VARCHAR(36),
    "InstallmentPeriods" INTEGER,
    "InstallmentAmount" DECIMAL(10,2),
    "Note" TEXT,
    "Img" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("VehicleId")
);

-- CreateTable
CREATE TABLE "FuelType" (
    "TenantId" VARCHAR(36) NOT NULL,
    "FuelTypeId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "FuelType_pkey" PRIMARY KEY ("FuelTypeId")
);

-- CreateTable
CREATE TABLE "VehicleType" (
    "TenantId" VARCHAR(36) NOT NULL,
    "VehicleTypeId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("VehicleTypeId")
);

-- CreateTable
CREATE TABLE "VehicleBrand" (
    "TenantId" VARCHAR(36) NOT NULL,
    "VehicleBrandId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "VehicleBrand_pkey" PRIMARY KEY ("VehicleBrandId")
);

-- CreateTable
CREATE TABLE "VehicleOwner" (
    "TenantId" VARCHAR(36) NOT NULL,
    "VehicleOwnerId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "VehicleOwner_pkey" PRIMARY KEY ("VehicleOwnerId")
);

-- CreateTable
CREATE TABLE "VehicleDepartment" (
    "TenantId" VARCHAR(36) NOT NULL,
    "VehicleDepartmentId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "VehicleDepartment_pkey" PRIMARY KEY ("VehicleDepartmentId")
);

-- CreateTable
CREATE TABLE "VehicleDriver" (
    "TenantId" VARCHAR(36) NOT NULL,
    "VehicleDriverId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Name" TEXT NOT NULL,
    "MobileNo" VARCHAR(50),
    "LicenseNo" VARCHAR(50),
    "ImageUrl" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "LineUserId" TEXT,

    CONSTRAINT "VehicleDriver_pkey" PRIMARY KEY ("VehicleDriverId")
);

-- CreateTable
CREATE TABLE "DriverJob" (
    "DriverJobId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "JobNo" INTEGER,
    "VehicleDriverId" VARCHAR(36),
    "VehicleId" VARCHAR(36),
    "VehicleNo" TEXT,
    "Origin" TEXT NOT NULL,
    "Destination" TEXT NOT NULL,
    "ScheduledAt" TIMESTAMP(3),
    "Note" TEXT,
    "Status" VARCHAR(15) NOT NULL DEFAULT 'pending',
    "RespondedAt" TIMESTAMP(3),
    "CreatedByUsername" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverJob_pkey" PRIMARY KEY ("DriverJobId")
);

-- CreateTable
CREATE TABLE "LineCommand" (
    "LineCommandId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "LineUserId" TEXT NOT NULL,
    "Role" VARCHAR(15) NOT NULL,
    "RawText" TEXT NOT NULL,
    "ParsedAction" TEXT,
    "ResultStatus" VARCHAR(15) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineCommand_pkey" PRIMARY KEY ("LineCommandId")
);

-- CreateTable
CREATE TABLE "VehicleStatus" (
    "TenantId" VARCHAR(36) NOT NULL,
    "VehicleStatusId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "VehicleStatus_pkey" PRIMARY KEY ("VehicleStatusId")
);

-- CreateTable
CREATE TABLE "Tax" (
    "TaxId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Year" INTEGER NOT NULL,
    "EndDate" TIMESTAMP(3) NOT NULL,
    "TotalPremium" DECIMAL(10,2) NOT NULL,
    "InsuranceCompany" TEXT NOT NULL,
    "BrokerName" TEXT NOT NULL,
    "File" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "Tax_pkey" PRIMARY KEY ("TaxId")
);

-- CreateTable
CREATE TABLE "CompulsoryMotorInsuranceVehicle" (
    "CompulsoryMotorInsuranceVehicleId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Year" INTEGER NOT NULL,
    "EndDate" TIMESTAMP(3) NOT NULL,
    "TotalPremium" DECIMAL(10,2) NOT NULL,
    "InsuranceCompany" TEXT NOT NULL,
    "BrokerName" TEXT NOT NULL,
    "File" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "CompulsoryMotorInsuranceVehicle_pkey" PRIMARY KEY ("CompulsoryMotorInsuranceVehicleId")
);

-- CreateTable
CREATE TABLE "InsurancePolicyVehicle" (
    "InsurancePolicyVehicleId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Year" INTEGER NOT NULL,
    "Type" TEXT NOT NULL,
    "InsuranceCompany" TEXT NOT NULL,
    "BrokerName" TEXT NOT NULL,
    "StartDate" TIMESTAMP(3) NOT NULL,
    "EndDate" TIMESTAMP(3) NOT NULL,
    "TotalPremium" DECIMAL(10,2) NOT NULL,
    "PolicyFile" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "InsurancePolicyVehicle_pkey" PRIMARY KEY ("InsurancePolicyVehicleId")
);

-- CreateTable
CREATE TABLE "AttachFileVehicle" (
    "AttachFileVehicleId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "FileName" TEXT NOT NULL,
    "Description" TEXT NOT NULL,
    "Url" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "AttachFileVehicle_pkey" PRIMARY KEY ("AttachFileVehicleId")
);

-- CreateTable
CREATE TABLE "CarTires" (
    "CarTiresId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "ChangeDate" TIMESTAMP(3) NOT NULL,
    "Position" TEXT NOT NULL,
    "Brand" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "CarTires_pkey" PRIMARY KEY ("CarTiresId")
);

-- CreateTable
CREATE TABLE "AccidentVehicle" (
    "AccidentVehicleId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Date" TIMESTAMP(3) NOT NULL,
    "Time" TEXT NOT NULL,
    "Party" TEXT NOT NULL,
    "LicensePlate" TEXT NOT NULL,
    "DriverName" TEXT NOT NULL,
    "Opponent" TEXT NOT NULL,
    "Files" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "AccidentVehicle_pkey" PRIMARY KEY ("AccidentVehicleId")
);

-- CreateTable
CREATE TABLE "RepairVehicle" (
    "RepairVehicleId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "RepairDate" TIMESTAMP(3) NOT NULL,
    "LicensePlate" TEXT NOT NULL,
    "RepairShop" TEXT NOT NULL,
    "Description" TEXT,
    "ReceiveDate" TIMESTAMP(3) NOT NULL,
    "InsurancePay" DECIMAL(10,2) NOT NULL,
    "CompanyPay" DECIMAL(10,2) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "RepairVehicle_pkey" PRIMARY KEY ("RepairVehicleId")
);

-- CreateTable
CREATE TABLE "GasolineCost" (
    "GasolineCostId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Item" TEXT NOT NULL,
    "TaxInvoiceNumber" VARCHAR(100),
    "Liters" INTEGER NOT NULL,
    "Amount" DECIMAL(10,2) NOT NULL,
    "OdometerStart" INTEGER NOT NULL,
    "OdometerEnd" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "DateTime" TIMESTAMP(3) NOT NULL,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "GasolineCost_pkey" PRIMARY KEY ("GasolineCostId")
);

-- CreateTable
CREATE TABLE "DrainTheOilVehicle" (
    "DrainTheOilVehicleId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Date" TIMESTAMP(3) NOT NULL,
    "DueDate" TIMESTAMP(3),
    "Odometer" INTEGER NOT NULL DEFAULT 0,
    "TextAlert" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "DrainTheOilVehicle_pkey" PRIMARY KEY ("DrainTheOilVehicleId")
);

-- CreateTable
CREATE TABLE "InstallmentsVehicle" (
    "InstallmentsVehicleId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "InstallmentNumber" INTEGER NOT NULL,
    "DueDate" TIMESTAMP(3) NOT NULL,
    "Amount" DECIMAL(10,2) NOT NULL,
    "DatePay" TIMESTAMP(3),
    "PaymentEvidence" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "InstallmentsVehicle_pkey" PRIMARY KEY ("InstallmentsVehicleId")
);

-- CreateTable
CREATE TABLE "ImageVehicle" (
    "ImageVehicleId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Url" TEXT NOT NULL,
    "Title" TEXT NOT NULL,
    "Description" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36) NOT NULL,

    CONSTRAINT "ImageVehicle_pkey" PRIMARY KEY ("ImageVehicleId")
);

-- CreateTable
CREATE TABLE "LineWebhook" (
    "LineWebhookId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "Body" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineWebhook_pkey" PRIMARY KEY ("LineWebhookId")
);

-- CreateTable
CREATE TABLE "IncomeVehicle" (
    "IncomeVehicleId" VARCHAR(36) NOT NULL,
    "CustomerName" TEXT,
    "Description" TEXT NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,
    "VehicleId" VARCHAR(36),
    "TenantId" VARCHAR(36),
    "SourceLabel" TEXT,
    "ReceiveDate" TIMESTAMP(3),
    "DateTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Time" TEXT NOT NULL,
    "WorkOrderNumber" VARCHAR(50) NOT NULL,
    "InvoiceNumber" VARCHAR(50) NOT NULL,
    "AmountReceive" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "VehicleDriverId" VARCHAR(36),
    "PaymentStatusId" VARCHAR(36),

    CONSTRAINT "IncomeVehicle_pkey" PRIMARY KEY ("IncomeVehicleId")
);

-- CreateTable
CREATE TABLE "PaymentStatus" (
    "TenantId" VARCHAR(36) NOT NULL,
    "PaymentStatusId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(15) NOT NULL,
    "Name" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "PaymentStatus_pkey" PRIMARY KEY ("PaymentStatusId")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "ImportLogId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "FileName" TEXT,
    "FileRows" INTEGER NOT NULL DEFAULT 0,
    "FileSum" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "CreatedRows" INTEGER NOT NULL DEFAULT 0,
    "CreatedSum" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "DupRows" INTEGER NOT NULL DEFAULT 0,
    "DupSum" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "ExistRows" INTEGER NOT NULL DEFAULT 0,
    "ExistSum" DECIMAL(16,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("ImportLogId")
);

-- CreateTable
CREATE TABLE "FuelBill" (
    "id" SERIAL NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "employeeName" TEXT,
    "imageUrl" TEXT,
    "imageHash" TEXT,
    "receiptNo" TEXT,
    "station" TEXT,
    "billDate" TEXT,
    "billTime" TEXT,
    "fuelType" TEXT,
    "liters" DECIMAL(16,2),
    "pricePerLiter" DECIMAL(16,2),
    "total" DECIMAL(16,2),
    "plate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "suspectReasons" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DebtVersion" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DebtVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtRecord" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "docNo" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "date" TEXT,
    "customer" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "dueDate" TEXT,
    "branch" TEXT NOT NULL,
    "value" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "vat" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "depositRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "salesperson" TEXT NOT NULL,

    CONSTRAINT "DebtRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainName_TenantId_idx" ON "DomainName"("TenantId");

-- CreateIndex
CREATE INDEX "DomainName_HostName_idx" ON "DomainName"("HostName");

-- CreateIndex
CREATE INDEX "Tenant_TenantId_idx" ON "Tenant"("TenantId");

-- CreateIndex
CREATE INDEX "Admin_TenantId_idx" ON "Admin"("TenantId");

-- CreateIndex
CREATE INDEX "Admin_AdminId_idx" ON "Admin"("AdminId");

-- CreateIndex
CREATE INDEX "Customer_TenantId_idx" ON "Customer"("TenantId");

-- CreateIndex
CREATE INDEX "Customer_CustomerId_idx" ON "Customer"("CustomerId");

-- CreateIndex
CREATE INDEX "Notification_CustomerId_idx" ON "Notification"("CustomerId");

-- CreateIndex
CREATE INDEX "Setting_TenantId_idx" ON "Setting"("TenantId");

-- CreateIndex
CREATE INDEX "Setting_SettingConfigId_idx" ON "Setting"("SettingConfigId");

-- CreateIndex
CREATE INDEX "RefreshTokens_CustomerId_TenantId_idx" ON "RefreshTokens"("CustomerId", "TenantId");

-- CreateIndex
CREATE INDEX "RefreshTokens_RefreshTokenId_idx" ON "RefreshTokens"("RefreshTokenId");

-- CreateIndex
CREATE INDEX "RefreshTokensAdmin_AdminId_TenantId_idx" ON "RefreshTokensAdmin"("AdminId", "TenantId");

-- CreateIndex
CREATE INDEX "RefreshTokensAdmin_RefreshTokenId_idx" ON "RefreshTokensAdmin"("RefreshTokenId");

-- CreateIndex
CREATE INDEX "Vehicle_TenantId_idx" ON "Vehicle"("TenantId");

-- CreateIndex
CREATE INDEX "Vehicle_VehicleId_idx" ON "Vehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "FuelType_TenantId_idx" ON "FuelType"("TenantId");

-- CreateIndex
CREATE INDEX "FuelType_FuelTypeId_idx" ON "FuelType"("FuelTypeId");

-- CreateIndex
CREATE INDEX "VehicleType_TenantId_idx" ON "VehicleType"("TenantId");

-- CreateIndex
CREATE INDEX "VehicleType_VehicleTypeId_idx" ON "VehicleType"("VehicleTypeId");

-- CreateIndex
CREATE INDEX "VehicleBrand_TenantId_idx" ON "VehicleBrand"("TenantId");

-- CreateIndex
CREATE INDEX "VehicleBrand_VehicleBrandId_idx" ON "VehicleBrand"("VehicleBrandId");

-- CreateIndex
CREATE INDEX "VehicleOwner_TenantId_idx" ON "VehicleOwner"("TenantId");

-- CreateIndex
CREATE INDEX "VehicleOwner_VehicleOwnerId_idx" ON "VehicleOwner"("VehicleOwnerId");

-- CreateIndex
CREATE INDEX "VehicleDepartment_TenantId_idx" ON "VehicleDepartment"("TenantId");

-- CreateIndex
CREATE INDEX "VehicleDepartment_VehicleDepartmentId_idx" ON "VehicleDepartment"("VehicleDepartmentId");

-- CreateIndex
CREATE INDEX "VehicleDriver_TenantId_idx" ON "VehicleDriver"("TenantId");

-- CreateIndex
CREATE INDEX "VehicleDriver_VehicleDriverId_idx" ON "VehicleDriver"("VehicleDriverId");

-- CreateIndex
CREATE INDEX "DriverJob_TenantId_idx" ON "DriverJob"("TenantId");

-- CreateIndex
CREATE INDEX "DriverJob_VehicleDriverId_idx" ON "DriverJob"("VehicleDriverId");

-- CreateIndex
CREATE INDEX "DriverJob_Status_idx" ON "DriverJob"("Status");

-- CreateIndex
CREATE INDEX "DriverJob_TenantId_JobNo_idx" ON "DriverJob"("TenantId", "JobNo");

-- CreateIndex
CREATE INDEX "LineCommand_TenantId_idx" ON "LineCommand"("TenantId");

-- CreateIndex
CREATE INDEX "LineCommand_LineUserId_idx" ON "LineCommand"("LineUserId");

-- CreateIndex
CREATE INDEX "VehicleStatus_TenantId_idx" ON "VehicleStatus"("TenantId");

-- CreateIndex
CREATE INDEX "VehicleStatus_VehicleStatusId_idx" ON "VehicleStatus"("VehicleStatusId");

-- CreateIndex
CREATE INDEX "Tax_VehicleId_idx" ON "Tax"("VehicleId");

-- CreateIndex
CREATE INDEX "Tax_TaxId_idx" ON "Tax"("TaxId");

-- CreateIndex
CREATE INDEX "CompulsoryMotorInsuranceVehicle_VehicleId_idx" ON "CompulsoryMotorInsuranceVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "CompulsoryMotorInsuranceVehicle_CompulsoryMotorInsuranceVeh_idx" ON "CompulsoryMotorInsuranceVehicle"("CompulsoryMotorInsuranceVehicleId");

-- CreateIndex
CREATE INDEX "InsurancePolicyVehicle_VehicleId_idx" ON "InsurancePolicyVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "InsurancePolicyVehicle_InsurancePolicyVehicleId_idx" ON "InsurancePolicyVehicle"("InsurancePolicyVehicleId");

-- CreateIndex
CREATE INDEX "AttachFileVehicle_VehicleId_idx" ON "AttachFileVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "AttachFileVehicle_AttachFileVehicleId_idx" ON "AttachFileVehicle"("AttachFileVehicleId");

-- CreateIndex
CREATE INDEX "CarTires_VehicleId_idx" ON "CarTires"("VehicleId");

-- CreateIndex
CREATE INDEX "CarTires_CarTiresId_idx" ON "CarTires"("CarTiresId");

-- CreateIndex
CREATE INDEX "AccidentVehicle_VehicleId_idx" ON "AccidentVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "AccidentVehicle_AccidentVehicleId_idx" ON "AccidentVehicle"("AccidentVehicleId");

-- CreateIndex
CREATE INDEX "RepairVehicle_VehicleId_idx" ON "RepairVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "RepairVehicle_RepairVehicleId_idx" ON "RepairVehicle"("RepairVehicleId");

-- CreateIndex
CREATE INDEX "GasolineCost_VehicleId_idx" ON "GasolineCost"("VehicleId");

-- CreateIndex
CREATE INDEX "GasolineCost_GasolineCostId_idx" ON "GasolineCost"("GasolineCostId");

-- CreateIndex
CREATE INDEX "DrainTheOilVehicle_VehicleId_idx" ON "DrainTheOilVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "DrainTheOilVehicle_DrainTheOilVehicleId_idx" ON "DrainTheOilVehicle"("DrainTheOilVehicleId");

-- CreateIndex
CREATE INDEX "InstallmentsVehicle_VehicleId_idx" ON "InstallmentsVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "InstallmentsVehicle_InstallmentsVehicleId_idx" ON "InstallmentsVehicle"("InstallmentsVehicleId");

-- CreateIndex
CREATE INDEX "ImageVehicle_VehicleId_idx" ON "ImageVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "ImageVehicle_ImageVehicleId_idx" ON "ImageVehicle"("ImageVehicleId");

-- CreateIndex
CREATE INDEX "LineWebhook_LineWebhookId_idx" ON "LineWebhook"("LineWebhookId");

-- CreateIndex
CREATE INDEX "LineWebhook_TenantId_idx" ON "LineWebhook"("TenantId");

-- CreateIndex
CREATE INDEX "IncomeVehicle_VehicleId_idx" ON "IncomeVehicle"("VehicleId");

-- CreateIndex
CREATE INDEX "IncomeVehicle_IncomeVehicleId_idx" ON "IncomeVehicle"("IncomeVehicleId");

-- CreateIndex
CREATE INDEX "IncomeVehicle_TenantId_idx" ON "IncomeVehicle"("TenantId");

-- CreateIndex
CREATE INDEX "PaymentStatus_TenantId_idx" ON "PaymentStatus"("TenantId");

-- CreateIndex
CREATE INDEX "PaymentStatus_PaymentStatusId_idx" ON "PaymentStatus"("PaymentStatusId");

-- CreateIndex
CREATE INDEX "ImportLog_TenantId_idx" ON "ImportLog"("TenantId");

-- CreateIndex
CREATE INDEX "FuelBill_lineUserId_idx" ON "FuelBill"("lineUserId");

-- CreateIndex
CREATE INDEX "FuelBill_imageHash_idx" ON "FuelBill"("imageHash");

-- CreateIndex
CREATE INDEX "FuelBill_receiptNo_idx" ON "FuelBill"("receiptNo");

-- CreateIndex
CREATE INDEX "DebtVersion_isCurrent_idx" ON "DebtVersion"("isCurrent");

-- CreateIndex
CREATE INDEX "DebtRecord_versionId_idx" ON "DebtRecord"("versionId");

-- CreateIndex
CREATE INDEX "DebtRecord_docNo_idx" ON "DebtRecord"("docNo");

-- AddForeignKey
ALTER TABLE "DomainName" ADD CONSTRAINT "DomainName_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("TenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("TenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("TenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customer"("CustomerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("TenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshTokens" ADD CONSTRAINT "RefreshTokens_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customer"("CustomerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshTokens" ADD CONSTRAINT "RefreshTokens_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("TenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshTokensAdmin" ADD CONSTRAINT "RefreshTokensAdmin_AdminId_fkey" FOREIGN KEY ("AdminId") REFERENCES "Admin"("AdminId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshTokensAdmin" ADD CONSTRAINT "RefreshTokensAdmin_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("TenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("TenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_VehicleTypeId_fkey" FOREIGN KEY ("VehicleTypeId") REFERENCES "VehicleType"("VehicleTypeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_VehicleBrandId_fkey" FOREIGN KEY ("VehicleBrandId") REFERENCES "VehicleBrand"("VehicleBrandId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_FuelTypeId_fkey" FOREIGN KEY ("FuelTypeId") REFERENCES "FuelType"("FuelTypeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_VehicleOwnerId_fkey" FOREIGN KEY ("VehicleOwnerId") REFERENCES "VehicleOwner"("VehicleOwnerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_VehicleDepartmentId_fkey" FOREIGN KEY ("VehicleDepartmentId") REFERENCES "VehicleDepartment"("VehicleDepartmentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_VehicleDriverId_fkey" FOREIGN KEY ("VehicleDriverId") REFERENCES "VehicleDriver"("VehicleDriverId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_VehicleStatusId_fkey" FOREIGN KEY ("VehicleStatusId") REFERENCES "VehicleStatus"("VehicleStatusId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverJob" ADD CONSTRAINT "DriverJob_VehicleDriverId_fkey" FOREIGN KEY ("VehicleDriverId") REFERENCES "VehicleDriver"("VehicleDriverId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tax" ADD CONSTRAINT "Tax_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompulsoryMotorInsuranceVehicle" ADD CONSTRAINT "CompulsoryMotorInsuranceVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicyVehicle" ADD CONSTRAINT "InsurancePolicyVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachFileVehicle" ADD CONSTRAINT "AttachFileVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarTires" ADD CONSTRAINT "CarTires_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccidentVehicle" ADD CONSTRAINT "AccidentVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairVehicle" ADD CONSTRAINT "RepairVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasolineCost" ADD CONSTRAINT "GasolineCost_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrainTheOilVehicle" ADD CONSTRAINT "DrainTheOilVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentsVehicle" ADD CONSTRAINT "InstallmentsVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageVehicle" ADD CONSTRAINT "ImageVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeVehicle" ADD CONSTRAINT "IncomeVehicle_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeVehicle" ADD CONSTRAINT "IncomeVehicle_VehicleDriverId_fkey" FOREIGN KEY ("VehicleDriverId") REFERENCES "VehicleDriver"("VehicleDriverId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeVehicle" ADD CONSTRAINT "IncomeVehicle_PaymentStatusId_fkey" FOREIGN KEY ("PaymentStatusId") REFERENCES "PaymentStatus"("PaymentStatusId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtRecord" ADD CONSTRAINT "DebtRecord_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DebtVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
