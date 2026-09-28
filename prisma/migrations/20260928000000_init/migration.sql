-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'SUPPLIER_REQUESTED', 'OPTIONS_RECEIVED', 'QUOTE_SENT', 'CUSTOMER_INTERESTED', 'PAYMENT_PENDING', 'BOOKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Destination" AS ENUM ('MAKKAH', 'MADINAH', 'JEDDAH', 'RIYADH', 'OTHER');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('PKR', 'SAR');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('PER_NIGHT', 'TOTAL');

-- CreateEnum
CREATE TYPE "MarkupType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID_TO_SUPPLIER', 'PARTIAL', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('EXPECTED', 'RECEIVED', 'VOID');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestCounter" (
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RequestCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "AccommodationRequest" (
    "id" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "rooms" INTEGER NOT NULL,
    "budgetType" "BudgetType",
    "budgetAmount" DECIMAL(14,2),
    "budgetCurrency" "Currency",
    "preferences" TEXT[],
    "preferredLocation" TEXT,
    "requirements" TEXT,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "assignedToId" UUID,
    "supplierId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestDestination" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "destination" "Destination" NOT NULL,
    "otherName" TEXT,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,

    CONSTRAINT "RequestDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelOption" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "hotelName" TEXT NOT NULL,
    "destination" "Destination" NOT NULL,
    "roomType" TEXT NOT NULL,
    "stars" INTEGER,
    "distance" TEXT,
    "mealPlan" TEXT,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "features" TEXT[],
    "cancellationTerms" TEXT,
    "availabilityNotes" TEXT,
    "internalNotes" TEXT,
    "currency" "Currency" NOT NULL,
    "supplierPrice" DECIMAL(14,2) NOT NULL,
    "taxesFees" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "markupType" "MarkupType" NOT NULL,
    "markupValue" DECIMAL(14,2) NOT NULL,
    "customerPrice" DECIMAL(14,2) NOT NULL,
    "expectedCommission" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteOption" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "hotelOptionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "finalPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "QuoteOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInterest" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierReference" TEXT,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "currency" "Currency" NOT NULL,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "supplierCost" DECIMAL(14,2) NOT NULL,
    "expectedCommission" DECIMAL(14,2) NOT NULL,
    "actualCommission" DECIMAL(14,2),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'EXPECTED',
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "actorId" UUID,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_expiresAt_idx" ON "AdminSession"("adminId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_whatsapp_key" ON "Customer"("whatsapp");

-- CreateIndex
CREATE UNIQUE INDEX "AccommodationRequest_requestNumber_key" ON "AccommodationRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "AccommodationRequest_status_createdAt_idx" ON "AccommodationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccommodationRequest_customerId_createdAt_idx" ON "AccommodationRequest"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "AccommodationRequest_supplierId_idx" ON "AccommodationRequest"("supplierId");

-- CreateIndex
CREATE INDEX "RequestDestination_destination_checkIn_idx" ON "RequestDestination"("destination", "checkIn");

-- CreateIndex
CREATE INDEX "RequestDestination_requestId_idx" ON "RequestDestination"("requestId");

-- CreateIndex
CREATE INDEX "HotelOption_requestId_createdAt_idx" ON "HotelOption"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_tokenHash_key" ON "Quote"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_shareToken_key" ON "Quote"("shareToken");

-- CreateIndex
CREATE INDEX "Quote_requestId_createdAt_idx" ON "Quote"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteOption_quoteId_hotelOptionId_key" ON "QuoteOption"("quoteId", "hotelOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteOption_quoteId_position_key" ON "QuoteOption"("quoteId", "position");

-- CreateIndex
CREATE INDEX "CustomerInterest_quoteId_createdAt_idx" ON "CustomerInterest"("quoteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_supplierId_idx" ON "Booking"("supplierId");

-- CreateIndex
CREATE INDEX "Commission_status_createdAt_idx" ON "Commission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_requestId_createdAt_idx" ON "AdminNote"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_requestId_createdAt_idx" ON "ActivityLog"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationRequest" ADD CONSTRAINT "AccommodationRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationRequest" ADD CONSTRAINT "AccommodationRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationRequest" ADD CONSTRAINT "AccommodationRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestDestination" ADD CONSTRAINT "RequestDestination_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccommodationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelOption" ADD CONSTRAINT "HotelOption_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccommodationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelOption" ADD CONSTRAINT "HotelOption_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccommodationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteOption" ADD CONSTRAINT "QuoteOption_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteOption" ADD CONSTRAINT "QuoteOption_hotelOptionId_fkey" FOREIGN KEY ("hotelOptionId") REFERENCES "HotelOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInterest" ADD CONSTRAINT "CustomerInterest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInterest" ADD CONSTRAINT "CustomerInterest_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "HotelOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInterest" ADD CONSTRAINT "CustomerInterest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccommodationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "HotelOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccommodationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AccommodationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
