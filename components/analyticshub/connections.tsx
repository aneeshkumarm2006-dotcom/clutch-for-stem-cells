"use client";

/**
 * Connection cards — shared by Settings and the first-run wizard. Every save is
 * a live validation call server-side; failures surface the provider's own
 * message. Collapsible how-to hints explain each credential.
 */
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ApiError, apiGet, apiPost } from "@/components/analyticshub/api";
import { useHub } from "@/components/analyticshub/context";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/analyticshub/shell-ui";
import type { SourceId, SourceStatus } from "@/lib/analyticshub/types";
import { cn } from "@/lib/utils";

/* ── Shared bits ──────────────────────────────────────────────────────────── */

function useSrcStatus() {
  const { status } = useHub();
  return (s: SourceId): SourceStatus | undefined =>
    status?.sources.find((x) => x.source === s)?.status;
}

const BADGE: Record<SourceStatus, [string, string]> = {
  ok: ["Connected", "bg-success-bg text-success-fg"],
  reconnect_needed: ["Reconnect needed", "bg-warning-bg text-warning-fg"],
  error: ["Error", "bg-danger-bg text-danger-fg"],
  not_connected: ["Not connected", "bg-surface-alt text-text-muted"],
};

function StatusBadge({ status }: { status?: SourceStatus }) {
  const [label, cls] = BADGE[status ?? "not_connected"];
  return (
    <span
      className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", cls)}
    >
      {label}
    </span>
  );
}

function SettingCard({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-text-primary">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
          )}
        </div>
        {badge}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function HowTo({
  label = "How to set this up",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-text-link"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {label}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-surface-alt p-3 text-xs leading-relaxed text-text-secondary">
          {children}
        </div>
      )}
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mt-2 text-sm text-danger">{error}</p>;
}

/* ── Google (GA4 + Search Console) ────────────────────────────────────────── */

interface GoogleOptions {
  properties: { id: string; name: string; account: string }[];
  sites: { siteUrl: string; permissionLevel: string }[];
  selected: { ga4PropertyId?: string; gscSiteUrl?: string };
}

export function GoogleCard() {
  const { status, reloadStatus } = useHub();
  const src = useSrcStatus();
  const oauthAvailable = status?.googleOAuthAvailable ?? false;
  const combined: SourceStatus =
    src("ga4") === "ok" || src("gsc") === "ok"
      ? "ok"
      : src("ga4") === "reconnect_needed" || src("gsc") === "reconnect_needed"
        ? "reconnect_needed"
        : "not_connected";

  const [tab, setTab] = useState<"oauth" | "sa">(oauthAvailable ? "oauth" : "sa");
  const [opts, setOpts] = useState<GoogleOptions | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [ga4Sel, setGa4Sel] = useState("");
  const [siteSel, setSiteSel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Service-account fields.
  const [saKey, setSaKey] = useState("");
  const [saProp, setSaProp] = useState("");
  const [saSite, setSaSite] = useState("");

  const loadOptions = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const o = await apiGet<GoogleOptions>("google/options");
      setOpts(o);
      setConnected(true);
      setGa4Sel(o.selected.ga4PropertyId ?? "");
      setSiteSel(o.selected.gscSiteUrl ?? "");
    } catch (err) {
      setConnected(false);
      if (err instanceof ApiError && err.code !== "bad_request") {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  async function saveSelection() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("google/select", {
        ga4PropertyId: ga4Sel || undefined,
        gscSiteUrl: siteSel || undefined,
      });
      await reloadStatus();
      toast.success("Google sources saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveServiceAccount() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("google/service-account", {
        key: saKey,
        ga4PropertyId: saProp || undefined,
        gscSiteUrl: saSite || undefined,
      });
      await reloadStatus();
      await loadOptions();
      toast.success("Service account connected.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Validation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiPost("google/disconnect");
      setConnected(false);
      setOpts(null);
      await reloadStatus();
      toast.success("Google disconnected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard
      title="Google: Analytics + Search Console"
      description="One connection powers both GA4 and Search Console."
      badge={<StatusBadge status={combined} />}
    >
      {oauthAvailable && (
        <div className="mb-4 inline-flex rounded-lg border border-border bg-surface-alt p-0.5 text-xs">
          {(["oauth", "sa"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                tab === t
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary",
              )}
            >
              {t === "oauth" ? "Sign in with Google" : "Service account"}
            </button>
          ))}
        </div>
      )}

      {tab === "oauth" && oauthAvailable ? (
        connected ? (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>GA4 property</label>
              <select
                value={ga4Sel}
                onChange={(e) => setGa4Sel(e.target.value)}
                className={`mt-1 ${inputClass}`}
              >
                <option value="">None</option>
                {opts?.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Search Console site</label>
              <select
                value={siteSel}
                onChange={(e) => setSiteSel(e.target.value)}
                className={`mt-1 ${inputClass}`}
              >
                <option value="">None</option>
                {opts?.sites.map((s) => (
                  <option key={s.siteUrl} value={s.siteUrl}>
                    {s.siteUrl}
                  </option>
                ))}
              </select>
            </div>
            <ErrorLine error={error} />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveSelection}
                disabled={busy}
                className={btnPrimary}
              >
                Save selection
              </button>
              <a href="/api/analyticshub/oauth/google/start" className={btnGhost}>
                Re-authorize
              </a>
              <button onClick={disconnect} disabled={busy} className={btnDanger}>
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div>
            <a
              href="/api/analyticshub/oauth/google/start"
              className={btnPrimary}
            >
              Sign in with Google
            </a>
            <ErrorLine error={error} />
            <HowTo>
              Grants read-only access to GA4 (analytics.readonly) and Search
              Console (webmasters.readonly). You&apos;ll pick the exact property
              and site after signing in. Nothing is written to your accounts.
            </HowTo>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {!oauthAvailable && (
            <p className="rounded-lg bg-surface-alt px-3 py-2 text-xs text-text-secondary">
              Google sign-in isn&apos;t configured on this deployment. Use a
              service-account key instead.
            </p>
          )}
          <div>
            <label className={labelClass}>Service-account key (JSON)</label>
            <textarea
              value={saKey}
              onChange={(e) => setSaKey(e.target.value)}
              rows={4}
              placeholder='{ "type": "service_account", "client_email": "...", "private_key": "..." }'
              className={`mt-1 font-mono text-xs ${inputClass}`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>GA4 property ID</label>
              <input
                value={saProp}
                onChange={(e) => setSaProp(e.target.value)}
                placeholder="123456789"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>Search Console site URL</label>
              <input
                value={saSite}
                onChange={(e) => setSaSite(e.target.value)}
                placeholder="sc-domain:example.com"
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>
          <ErrorLine error={error} />
          <button
            onClick={saveServiceAccount}
            disabled={busy || !saKey}
            className={btnPrimary}
          >
            Validate &amp; save
          </button>
          <HowTo>
            Create a service account in Google Cloud, enable the GA4 Data + Admin
            and Search Console APIs, download its JSON key, then add its
            client_email as a viewer in GA4 Admin and as a user in Search
            Console. Paste the whole JSON above.
          </HowTo>
        </div>
      )}
    </SettingCard>
  );
}

/* ── Meta ─────────────────────────────────────────────────────────────────── */

export function MetaCard() {
  const { status, reloadStatus } = useHub();
  const src = useSrcStatus();
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [account, setAccount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = src("meta") === "ok";
  const label = status?.sources.find((s) => s.source === "meta")?.label;

  async function loadAccounts() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ accounts: { id: string; name: string }[] }>(
        "meta/accounts",
        { token },
      );
      setAccounts(res.accounts);
      if (res.accounts[0]) setAccount(res.accounts[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Validation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("meta/select", { token, adAccountId: account });
      await reloadStatus();
      setAccounts([]);
      setToken("");
      toast.success("Meta Ads connected.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiPost("meta/disconnect");
      await reloadStatus();
      toast.success("Meta disconnected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard
      title="Meta Ads"
      description="Optional. Spend, impressions, clicks, results, ROAS."
      badge={<StatusBadge status={src("meta")} />}
    >
      {connected ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-text-secondary">
            Account: <span className="font-medium text-text-primary">{label}</span>
          </span>
          <button onClick={disconnect} disabled={busy} className={btnDanger}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Long-lived access token</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAAG..."
              className={`mt-1 ${inputClass}`}
            />
          </div>
          {accounts.length > 0 && (
            <div>
              <label className={labelClass}>Ad account</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className={`mt-1 ${inputClass}`}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.id})
                  </option>
                ))}
              </select>
            </div>
          )}
          <ErrorLine error={error} />
          <div className="flex gap-2">
            {accounts.length === 0 ? (
              <button
                onClick={loadAccounts}
                disabled={busy || !token}
                className={btnPrimary}
              >
                Validate token
              </button>
            ) : (
              <button
                onClick={save}
                disabled={busy || !account}
                className={btnPrimary}
              >
                Save
              </button>
            )}
          </div>
          <HowTo>
            In Meta Business Settings, create a system user with the
            <span className="font-medium"> ads_read</span> permission, generate a
            long-lived token, and paste it here. We&apos;ll list its ad accounts
            for you to pick one.
          </HowTo>
        </div>
      )}
    </SettingCard>
  );
}

/* ── Google Ads ───────────────────────────────────────────────────────────── */

export function GadsCard() {
  const { reloadStatus, status } = useHub();
  const src = useSrcStatus();
  const [f, setF] = useState({
    developerToken: "",
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    customerId: "",
    loginCustomerId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = src("gads") === "ok";
  const label = status?.sources.find((s) => s.source === "gads")?.label;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("gads/save", f);
      await reloadStatus();
      toast.success("Google Ads connected.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Validation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiPost("gads/disconnect");
      await reloadStatus();
      toast.success("Google Ads disconnected.");
    } finally {
      setBusy(false);
    }
  }

  const fields: [keyof typeof f, string, string][] = [
    ["developerToken", "Developer token", ""],
    ["clientId", "OAuth client ID", ""],
    ["clientSecret", "OAuth client secret", ""],
    ["refreshToken", "Refresh token", ""],
    ["customerId", "Customer ID", "1234567890"],
    ["loginCustomerId", "Login customer ID (MCC, optional)", "optional"],
  ];

  return (
    <SettingCard
      title="Google Ads"
      description="Advanced &amp; optional. Cost, clicks, conversions."
      badge={<StatusBadge status={src("gads")} />}
    >
      {connected ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-text-secondary">
            Customer:{" "}
            <span className="font-medium text-text-primary">{label}</span>
          </span>
          <button onClick={disconnect} disabled={busy} className={btnDanger}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([key, lbl, ph]) => (
              <div key={key}>
                <label className={labelClass}>{lbl}</label>
                <input
                  value={f[key]}
                  onChange={set(key)}
                  placeholder={ph}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            ))}
          </div>
          <ErrorLine error={error} />
          <button
            onClick={save}
            disabled={
              busy ||
              !f.developerToken ||
              !f.clientId ||
              !f.clientSecret ||
              !f.refreshToken ||
              !f.customerId
            }
            className={btnPrimary}
          >
            Validate &amp; save
          </button>
          <HowTo>
            <p>
              Get an approved developer token from your Google Ads manager
              account, create an OAuth client (Desktop or Web) in Google Cloud
              with the adwords scope, and generate a refresh token via the OAuth
              playground. The customer ID is the 10-digit account number
              (dashes stripped). Set the MCC login-customer-id only if you access
              via a manager account.
            </p>
            <a
              href="https://developers.google.com/google-ads/api/docs/first-call/overview"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-medium text-text-link"
            >
              Google Ads API guide <ExternalLink className="h-3 w-3" />
            </a>
          </HowTo>
        </div>
      )}
    </SettingCard>
  );
}

/** The three external connection cards, in wizard/settings order. */
export function ConnectionCards() {
  return (
    <div className="space-y-4">
      <GoogleCard />
      <MetaCard />
      <GadsCard />
    </div>
  );
}

/* ── Project identity ─────────────────────────────────────────────────────── */

export function ProjectCard() {
  const { status, reloadStatus } = useHub();
  const [name, setName] = useState(status?.project.name ?? "");
  const [primary, setPrimary] = useState(status?.project.primary ?? "#0e80cc");
  const [accent, setAccent] = useState(status?.project.accent ?? "#e2f0fb");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("project", { name, primary, accent });
      await reloadStatus();
      toast.success("Project updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard title="Project" description="Name and brand colors.">
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Primary" value={primary} onChange={setPrimary} />
          <ColorField label="Accent" value={accent} onChange={setAccent} />
        </div>
        <ErrorLine error={error} />
        <button onClick={save} disabled={busy || !name} className={btnPrimary}>
          Save
        </button>
      </div>
    </SettingCard>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-surface"
          aria-label={`${label} color`}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}

/* ── Change password ──────────────────────────────────────────────────────── */

export function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost("password", { current, next });
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingCard
      title="Change password"
      description="There is no reset flow, so keep this safe."
    >
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Current password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>New password</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
        <ErrorLine error={error} />
        <button
          onClick={save}
          disabled={busy || current.length === 0 || next.length < 8}
          className={btnPrimary}
        >
          Change password
        </button>
      </div>
    </SettingCard>
  );
}
