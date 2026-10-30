-- =====================================================================
-- SEC-4: rotirani refresh token (httpOnly cookie + opoziv)
--
-- Nova tabela, bez izmjene postojećih tabela osim straniog ključa na
-- "User". Reverzibilno: DROP TABLE "RefreshToken" vraća prethodno stanje
-- i ne dira poslovne podatke.
--
-- Napomena: kao i baseline, ovaj SQL je pisan ručno jer Prisma CLI nije
-- mogao biti pokrenut u pripremnom okruženju. CI ga verificira kroz
-- `npx prisma migrate deploy` nad postgres:16 servisom.
-- =====================================================================

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
