import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DefaultStartLocationForm } from "@/components/settings/DefaultStartLocationForm";
import { RunGenerationButton } from "@/components/settings/RunGenerationButton";
import { getDefaultStartLocation } from "@/lib/services/settings";
import { PRICE_PER_500ML, PRICE_PER_LITRE, DELIVERY_FEE } from "@/lib/pricing";

function isConfigured(value: string | undefined, placeholders: string[] = ["placeholder", "your-", "[PROJECT-REF]"]) {
  if (!value) return false;
  return !placeholders.some((p) => p.length > 0 && value.toLowerCase().includes(p.toLowerCase()));
}

export default async function SettingsPage() {
  const startLocation = await getDefaultStartLocation();

  const integrations = [
    { name: "Google Maps (browser)", configured: isConfigured(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) },
    { name: "Google Maps (server / routing)", configured: isConfigured(process.env.GOOGLE_MAPS_SERVER_API_KEY) },
    { name: "WhatsApp Cloud API", configured: isConfigured(process.env.WHATSAPP_ACCESS_TOKEN) },
    { name: "Supabase Auth", configured: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL, ["placeholder.supabase.co", "[PROJECT-REF]"]) },
  ];

  return (
    <div>
      <PageHeader title="Settings" description="Default delivery start location and business config." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Default delivery start location</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-ink-muted">
              Used as the depot/farm/store starting point for route optimization unless overridden on
              the Routes page for a specific run.
            </p>
            <DefaultStartLocationForm initial={startLocation} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">500 ml</span>
                <span className="font-medium text-ink">₹{PRICE_PER_500ML}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">1 litre</span>
                <span className="font-medium text-ink">₹{PRICE_PER_LITRE}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Delivery fee</span>
                <span className="font-medium text-ink">₹{DELIVERY_FEE}</span>
              </div>
              <p className="pt-2 text-xs text-ink-faint">
                Set in lib/pricing.ts — change and redeploy to update prices.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-ink-muted">
                Runs automatically on Vercel Cron (see docs/deployment.md), or trigger today&rsquo;s
                generation manually here.
              </p>
              <RunGenerationButton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {integrations.map((i) => (
                <div key={i.name} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{i.name}</span>
                  <Badge tone={i.configured ? "delivered" : "pending"}>
                    {i.configured ? "Configured" : "Not configured"}
                  </Badge>
                </div>
              ))}
              <p className="pt-2 text-xs text-ink-faint">
                See docs/google-maps-setup.md and docs/whatsapp-setup.md for how to configure these.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
