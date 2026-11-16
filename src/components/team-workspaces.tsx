import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { teamAction, teamOverview } from "@/lib/teams.functions";
import { toast } from "sonner";

export function TeamWorkspaces() {
  const getTeams = useServerFn(teamOverview);
  const act = useServerFn(teamAction);
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof teamOverview>> | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    setSignedIn(Boolean(data.user));
    if (data.user) setOverview(await getTeams());
    else setOverview(null);
  };
  useEffect(() => { void refresh().catch(e => toast.error(e.message)); }, []);
  const run = async (action: Parameters<typeof teamAction>[0]["data"]) => {
    setBusy(true);
    try {
      const result = await act({ data: action });
      if (action.action === "invite") {
        await navigator.clipboard.writeText(`${window.location.origin}/teams?invite=${result}`);
        toast.success("Invitation copied. Valid for seven days.");
      }
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update the team."); }
    finally { setBusy(false); }
  };
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("invite") ?? ""); }, []);
  const signIn = async (provider: "google" | "lovable") => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.href });
    if (result.error) toast.error(result.error.message);
    else if (!result.redirected) await refresh();
  };
  return <section className="mx-auto max-w-3xl px-6 py-10">
    <h1 className="font-display text-[32px]">Team studios</h1>
    {!signedIn ? <div className="mt-6 flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => void signIn("lovable")}><LovableMark />Continue with Lovable</Button>
      <Button variant="outline" onClick={() => void signIn("google")}><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>Continue with Google</Button>
    </div> : <>
      <div className="mt-6 flex gap-2"><Input aria-label="Team name" placeholder="Team name" value={name} onChange={e => setName(e.target.value)} maxLength={80} /><Button disabled={busy || !name.trim()} onClick={() => void run({ action: "create", name })}>Create team</Button></div>
      <div className="mt-3 flex gap-2"><Input aria-label="Invitation code" placeholder="Invitation code" value={token} onChange={e => setToken(e.target.value)} /><Button disabled={busy || !token} onClick={() => void run({ action: "accept", token })}>Join team</Button></div>
      {overview?.teams.map(team => <div key={team.id} className="mt-8 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-display text-[22px]">{team.name}</h2>{overview.members.some(m => m.team_id === team.id && m.user_id === overview.userId && m.role === "owner") && <Button variant="outline" disabled={busy} onClick={() => void run({ action: "invite", team: team.id })}>Copy invitation</Button>}</div>
        {overview.workspaces.filter(w => w.team_id === team.id).map(w => <div key={w.id} className="mt-4 flex items-center justify-between"><span>{w.name}</span><Button onClick={() => { sessionStorage.setItem("cartoonist_workspace", w.id); navigate({ to: "/sessions/new" }); }}>Start team meeting</Button></div>)}
        <ul className="mt-4 text-[13px] text-muted-foreground">{overview.members.filter(m => m.team_id === team.id).map((m, i) => <li key={m.user_id} className="flex items-center justify-between py-1"><span>{m.user_id === overview.userId ? "You" : `Member ${i + 1}`} · {m.role}</span>{m.role === "member" && overview.members.some(o => o.team_id === team.id && o.user_id === overview.userId && o.role === "owner") && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run({ action: "remove", team: team.id, user: m.user_id })}>Remove</Button>}</li>)}</ul>
      </div>)}
      <Button variant="link" className="mt-6" onClick={async () => { await supabase.auth.signOut(); setOverview(null); setSignedIn(false); }}>Sign out</Button>
    </>}
  </section>;
}
