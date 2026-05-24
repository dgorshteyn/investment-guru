import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, tier, is_admin, created_at")
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1">{user!.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Display name
              </dt>
              <dd className="mt-1 text-muted-foreground">{profile?.display_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tier
              </dt>
              <dd className="mt-1 capitalize">{profile?.tier ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Member since
              </dt>
              <dd className="mt-1 text-muted-foreground">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
