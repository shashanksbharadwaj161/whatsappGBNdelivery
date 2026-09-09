ALTER TABLE "WhatsappConversation" ADD COLUMN "intakeState" JSONB;
ALTER TABLE "WhatsappMessage" ADD COLUMN "automationProcessedAt" TIMESTAMP(3);
ALTER TABLE "WhatsappMessage" ADD COLUMN "automationReplyTo" TEXT;
CREATE UNIQUE INDEX "WhatsappMessage_automationReplyTo_key" ON "WhatsappMessage"("automationReplyTo");
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
