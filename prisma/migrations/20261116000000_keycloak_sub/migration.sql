ALTER TABLE "User" ADD COLUMN "keycloakSub" TEXT;

CREATE UNIQUE INDEX "User_keycloakSub_key" ON "User"("keycloakSub");
