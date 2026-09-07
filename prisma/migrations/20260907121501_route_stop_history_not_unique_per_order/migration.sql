-- DropIndex
DROP INDEX "RouteStop_orderId_key";

-- CreateIndex
CREATE INDEX "RouteStop_orderId_idx" ON "RouteStop"("orderId");
