-- All application access runs through the role-checked Next.js server.
-- No browser Data API policies are granted. PostgreSQL owner access remains intact.
ALTER TABLE public."Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Address" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WhatsappConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WhatsappMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SubscriptionSkip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Route" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RouteStop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Setting" ENABLE ROW LEVEL SECURITY;
