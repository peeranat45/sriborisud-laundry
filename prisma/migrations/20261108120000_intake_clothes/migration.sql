-- ═══════════════════════════════════════════════════════════════
--  รับผ้าเข้า · ClothesType + Piece
--  ---------------------------------------------------------------
--  SQL นี้ไม่ได้เขียนมือ · generate ด้วย
--    npx prisma migrate diff \
--      --from-schema-datamodel <schema เดิม> \
--      --to-schema-datamodel  prisma/schema.prisma \
--      --script
--  job "migrations" ใน CI จะตรวจซ้ำว่าไฟล์นี้ตรงกับ schema จริง
-- ═══════════════════════════════════════════════════════════════

-- CreateTable
CREATE TABLE "ClothesType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "defaultPriceSatang" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClothesType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piece" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "clothesTypeId" TEXT NOT NULL,
    "pieceNo" TEXT NOT NULL,
    "priceSatang" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClothesType_active_sortOrder_idx" ON "ClothesType"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ClothesType_name_service_key" ON "ClothesType"("name", "service");

-- CreateIndex
CREATE INDEX "Piece_clothesTypeId_idx" ON "Piece"("clothesTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Piece_billId_pieceNo_key" ON "Piece"("billId", "pieceNo");

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_clothesTypeId_fkey" FOREIGN KEY ("clothesTypeId") REFERENCES "ClothesType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
