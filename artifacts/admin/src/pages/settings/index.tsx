import React, { useRef, useState, useEffect } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { API_URL } from "@/lib/api-url";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Settings as SettingsIcon, Palette, RefreshCw,
  Loader2, MessageCircle, CreditCard, Sliders, Upload, X, Truck, Mail, KeyRound, FileText,
  HardDrive, Database, Plus, Trash2, Lock, Globe, ToggleRight, BarChart2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const WEB_FEATURE_FLAGS: { key: string; label: string; description: string }[] = [
  { key: "showFlashSales", label: "Flash Sales Section", description: "Show time-limited flash sale deals on the homepage" },
  { key: "showRecentlyViewed", label: "Recently Viewed Products", description: "Show recently viewed items section on product and home pages" },
  { key: "showPromoCards", label: "Feature Highlight Cards", description: 'Show the \"Free Delivery\", \"Authentic\", \"Easy Returns\", \"Best Price\" cards' },
  { key: "showCoinRewards", label: "Loyalty Coins", description: "Show coin balance in the header and coin earning notifications" },
  { key: "showProductReviews", label: "Product Reviews", description: "Allow customers to see and submit reviews on product pages" },
  { key: "showWishlist", label: "Wishlist", description: "Enable the wishlist feature so customers can save products" },
  { key: "showReferrals", label: "Referral Programme", description: "Show the referral section and allow earning via referrals" },
  { key: "showSpinWheel", label: "Spin-the-Wheel Game", description: "Enable the spin-wheel lucky draw game for customers" },
];

const COLOR_PRESETS = [
  { label: "Rose Pink",    value: "#E91E63" },
  { label: "Deep Purple",  value: "#7C3AED" },
  { label: "Ocean Blue",   value: "#2563EB" },
  { label: "Emerald",      value: "#059669" },
  { label: "Amber",        value: "#D97706" },
  { label: "Ruby Red",     value: "#DC2626" },
  { label: "Teal",         value: "#0D9488" },
  { label: "Indigo",       value: "#4F46E5" },
];

function SectionSave({ label, onClick, loading }: { label?: string; onClick: () => void; loading: boolean }) {
  return (
    <div className="pt-2 flex justify-end border-t">
      <Button type="button" size="sm" onClick={onClick} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
        {loading ? "Saving…" : (label ?? "Save")}
      </Button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full overflow-hidden transition-colors ${checked ? "bg-green-500" : "bg-gray-300"}`}
    >
      <span className={`absolute top-1 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function LogoUpload({
  label, logoUrl, onUploaded, token,
}: { label: string; logoUrl: string; onUploaded: (url: string) => void; token: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onUploaded(data.url);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <div className="relative">
          <img src={logoUrl} alt={label} className="w-12 h-12 rounded-lg object-contain border bg-white shadow-sm" />
          <button
            type="button"
            onClick={() => onUploaded("")}
            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ) : (
        <div className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400 text-xs text-center">
          Logo
        </div>
      )}
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
          {uploading ? "Uploading…" : `Upload ${label} Logo`}
        </Button>
        <p className="text-xs text-gray-400 mt-0.5">PNG or SVG recommended</p>
      </div>
    </div>
  );
}

type MfsKey = "bkash" | "nagad" | "rocket";

const MFS_META: Record<MfsKey, { label: string; color: string; placeholder: string }> = {
  bkash:  { label: "bKash",  color: "#E91E63", placeholder: "01XXXXXXXXX" },
  nagad:  { label: "Nagad",  color: "#F97316", placeholder: "01XXXXXXXXX" },
  rocket: { label: "Rocket", color: "#8B5CF6", placeholder: "01XXXXXXXXX" },
};

interface MfsState {
  number: string;
  enabled: boolean;
  logoUrl: string;
  numberLabel: string;
  txnLabel: string;
}

export default function Settings() {
  const { data: rawSettings, isLoading } = useGetSettings();
  const settings = rawSettings as any;
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("shohure_admin_token") ?? "";

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [smtpTestState, setSmtpTestState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [smtpTestMessage, setSmtpTestMessage] = useState("");
  const [carrybeeStores, setCarrybeeStores] = useState<Array<{ id: string; name: string; is_active: boolean }> | null>(null);
  const [fetchingStores, setFetchingStores] = useState(false);

  async function sendSmtpTest() {
    setSmtpTestState("sending");
    setSmtpTestMessage("");
    try {
      const res = await fetch(`${API_URL}/api/settings/smtp/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setSmtpTestState("ok");
      setSmtpTestMessage(data.message);
    } catch (err: any) {
      setSmtpTestState("error");
      setSmtpTestMessage(err.message || "Send failed. Check your SMTP settings.");
    }
  }

  const fetchCarrybeeStores = async () => {
    setFetchingStores(true);
    setCarrybeeStores(null);
    try {
      const res = await fetch(`${API_URL}/api/carrybee/stores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCarrybeeStores(data.stores ?? []);
    } catch (err: any) {
      toast({ title: err.message ?? "Could not fetch stores", variant: "destructive" });
    } finally {
      setFetchingStores(false);
    }
  };

  const [courier, setCourier] = useState({
    steadfastEnabled: false,
    carrybeeEnabled: false,
    courierAutoSubmit: false,
    activeCourier: "steadfast" as "steadfast" | "carrybee",
    carrybeeMode: "sandbox" as "sandbox" | "production",
    carrybeeClientId: "",
    carrybeeClientSecret: "",
    carrybeeClientContext: "",
    carrybeeStoreId: "",
  });

  const [smtp, setSmtp] = useState({ smtpEmail: "", smtpPassword: "", smtpHost: "", smtpPort: "", smtpSecure: false });
  const [google, setGoogle] = useState({ googleClientId: "", googleClientSecret: "", googleAndroidClientId: "", googleIosClientId: "" });
  const [general, setGeneral] = useState({ siteName: "", enableFreeDelivery: true, freeDeliveryThreshold: "", coinValue: "", welcomeCouponCode: "" });
  const [whatsapp, setWhatsapp] = useState({ whatsappNumber: "" });
  const [legal, setLegal] = useState({ privacyPolicyUrl: "", termsOfServiceUrl: "" });
  const [notificationRetentionDays, setNotificationRetentionDays] = useState(7);
  const [mfs, setMfs] = useState<Record<MfsKey, MfsState>>({
    bkash:  { number: "", enabled: true, logoUrl: "", numberLabel: "bKash Number",  txnLabel: "Transaction ID (TrxID)" },
    nagad:  { number: "", enabled: true, logoUrl: "", numberLabel: "Nagad Number",  txnLabel: "Transaction ID (TrxID)" },
    rocket: { number: "", enabled: true, logoUrl: "", numberLabel: "Rocket Number", txnLabel: "Transaction ID (TrxID)" },
  });
  const [codEnabled, setCodEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [payDeliveryChargeEnabled, setPayDeliveryChargeEnabled] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#E91E63");
  const [colorInput, setColorInput] = useState("#E91E63");
  const [payment, setPayment] = useState({ sslcommerzStoreId: "", sslcommerzStorePassword: "", sslcommerzSandbox: true });
  const [tracking, setTracking] = useState({ facebookPixelId: "", googleTagId: "" });

  type StorageProvider = "local" | "supabase" | "aws_s3";
  const CONFIG_JWT_KEY = "shohure_admin_config_jwt";
  const [configJwt, setConfigJwt] = useState<string | null>(() => localStorage.getItem(CONFIG_JWT_KEY));
  const [configLoginEmail, setConfigLoginEmail] = useState("");
  const [configLoginPassword, setConfigLoginPassword] = useState("");
  const [configLoginError, setConfigLoginError] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState<string | null>(null);
  const [configApiBaseUrl, setConfigApiBaseUrl] = useState("");
  const [storageProvider, setStorageProvider] = useState<StorageProvider>("local");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseServiceKey, setSupabaseServiceKey] = useState("");
  const [supabaseBucket, setSupabaseBucket] = useState("images");
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("");
  const [awsBucket, setAwsBucket] = useState("");
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [newFlagKey, setNewFlagKey] = useState("");

  const fetchMobileConfig = React.useCallback(async (token: string) => {
    setConfigLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/config/admin`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) {
        const d = await res.json();
        setConfigApiBaseUrl(d.apiBaseUrl ?? "");
        setStorageProvider(d.storageProvider ?? "local");
        setSupabaseUrl(d.supabaseUrl ?? "");
        setSupabaseBucket(d.supabaseBucket ?? "images");
        setAwsRegion(d.awsRegion ?? "");
        setAwsBucket(d.awsBucket ?? "");
        setFeatureFlags(d.featureFlags ?? {});
      }
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => { if (configJwt) fetchMobileConfig(configJwt); }, [configJwt]);

  const handleConfigLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigLoginError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: configLoginEmail, password: configLoginPassword }),
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem(CONFIG_JWT_KEY, token);
        setConfigJwt(token);
      } else {
        const err = await res.json();
        setConfigLoginError(err?.error ?? "Invalid credentials");
      }
    } catch {
      setConfigLoginError("Network error. Check the API server.");
    }
  };

  const saveMobileSection = async (section: string, payload: object) => {
    if (!configJwt) return;
    setConfigSaving(section);
    try {
      const res = await fetch(`${API_URL}/api/config/mobile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${configJwt}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({ title: "Saved successfully" });
        if (section === "storage") { setSupabaseServiceKey(""); setAwsAccessKey(""); setAwsSecretKey(""); }
      } else {
        const err = await res.json();
        toast({ title: err?.error ?? "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error saving config", variant: "destructive" });
    } finally {
      setConfigSaving(null);
    }
  };

  useEffect(() => {
    if (!settings) return;
    setSmtp({
      smtpEmail: settings.smtpEmail ?? "",
      smtpPassword: "",
      smtpHost: (settings as any).smtpHost ?? "",
      smtpPort: String((settings as any).smtpPort ?? ""),
      smtpSecure: (settings as any).smtpSecure ?? false,
    });
    setGeneral({
      siteName: settings.siteName ?? "Shohure",
      enableFreeDelivery: settings.enableFreeDelivery !== false,
      freeDeliveryThreshold: String(settings.freeDeliveryThreshold ?? 500),
      coinValue: String(settings.coinValue ?? 0.10),
      welcomeCouponCode: (settings as any).welcomeCouponCode ?? "",
    });
    setWhatsapp({ whatsappNumber: settings.whatsappNumber ?? "" });
    setLegal({
      privacyPolicyUrl: (settings as any).privacyPolicyUrl ?? "",
      termsOfServiceUrl: (settings as any).termsOfServiceUrl ?? "",
    });
    setNotificationRetentionDays((settings as any).notificationRetentionDays ?? 7);
    setMfs({
      bkash:  { number: settings.bkashNumber ?? "", enabled: settings.bkashEnabled !== false, logoUrl: settings.bkashLogoUrl ?? "", numberLabel: settings.bkashNumberLabel ?? "bKash Number",  txnLabel: settings.bkashTxnLabel ?? "Transaction ID (TrxID)" },
      nagad:  { number: settings.nagadNumber ?? "", enabled: settings.nagadEnabled !== false, logoUrl: settings.nagadLogoUrl ?? "", numberLabel: settings.nagadNumberLabel ?? "Nagad Number",  txnLabel: settings.nagadTxnLabel ?? "Transaction ID (TrxID)" },
      rocket: { number: settings.rocketNumber ?? "", enabled: settings.rocketEnabled !== false, logoUrl: settings.rocketLogoUrl ?? "", numberLabel: settings.rocketNumberLabel ?? "Rocket Number", txnLabel: settings.rocketTxnLabel ?? "Transaction ID (TrxID)" },
    });
    setCodEnabled(settings.codEnabled !== false);
    setCardEnabled((settings as any).cardEnabled !== false);
    setPayDeliveryChargeEnabled(!!(settings as any).payDeliveryChargeEnabled);
    const color = settings.primaryColor ?? "#E91E63";
    setPrimaryColor(color);
    setColorInput(color);
    setGoogle({
      googleClientId: (settings as any).googleClientId ?? "",
      googleClientSecret: "",
      googleAndroidClientId: (settings as any).googleAndroidClientId ?? "",
      googleIosClientId: (settings as any).googleIosClientId ?? "",
    });
    setPayment({
      sslcommerzStoreId: settings.sslcommerzStoreId ?? "",
      sslcommerzStorePassword: settings.sslcommerzStorePassword ?? "",
      sslcommerzSandbox: settings.sslcommerzSandbox ?? true,
    });
    setTracking({
      facebookPixelId: (settings as any).facebookPixelId ?? "",
      googleTagId: (settings as any).googleTagId ?? "",
    });
    setCourier({
      steadfastEnabled: settings.steadfastEnabled ?? false,
      carrybeeEnabled: settings.carrybeeEnabled ?? false,
      courierAutoSubmit: settings.courierAutoSubmit ?? false,
      activeCourier: (settings.activeCourier as any) ?? "steadfast",
      carrybeeMode: (settings.carrybeeMode as any) ?? "sandbox",
      carrybeeClientId: settings.carrybeeClientId ?? "",
      carrybeeClientSecret: "",
      carrybeeClientContext: settings.carrybeeClientContext ?? "",
      carrybeeStoreId: settings.carrybeeStoreId ?? "",
    });
  }, [settings]);

  function saveSection(section: string, data: any) {
    setSavingSection(section);
    updateSettings.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast({ title: "Saved successfully!" });
          setSavingSection(null);
        },
        onError: () => {
          toast({ title: "Failed to save", variant: "destructive" });
          setSavingSection(null);
        },
      }
    );
  }

  const applyColor = (color: string) => { setPrimaryColor(color); setColorInput(color); };
  const setMfsField = (key: MfsKey, field: keyof MfsState, val: any) =>
    setMfs(f => ({ ...f, [key]: { ...f[key], [field]: val } }));

  if (isLoading) return <div className="flex h-full items-center justify-center text-gray-500">Loading settings…</div>;

  return (
    <div className="space-y-6 max-w-2xl w-full">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
        <SettingsIcon className="h-7 w-7" /> Settings
      </h2>

      {/* ── General ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="h-5 w-5 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-800">General</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
          <Input placeholder="Shohure" value={general.siteName} onChange={e => setGeneral(f => ({ ...f, siteName: e.target.value }))} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
          <div>
            <p className="text-sm font-medium text-gray-700">Free Delivery</p>
            <p className="text-xs text-gray-500 mt-0.5">Show free delivery offer to customers</p>
          </div>
          <Toggle checked={general.enableFreeDelivery} onChange={v => setGeneral(f => ({ ...f, enableFreeDelivery: v }))} />
        </div>
        {general.enableFreeDelivery && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Free Delivery Threshold (৳)</label>
            <Input type="number" placeholder="500" value={general.freeDeliveryThreshold} onChange={e => setGeneral(f => ({ ...f, freeDeliveryThreshold: e.target.value }))} />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Coin Value (৳ per coin)</label>
          <Input type="number" placeholder="0.10" value={general.coinValue} onChange={e => setGeneral(f => ({ ...f, coinValue: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Coupon Code</label>
          <Input placeholder="e.g. WELCOME10" value={general.welcomeCouponCode} onChange={e => setGeneral(f => ({ ...f, welcomeCouponCode: e.target.value }))} />
          <p className="text-xs text-gray-500 mt-1">Shown in the welcome notification when a new customer registers. Leave empty to omit any coupon mention.</p>
        </div>
        <SectionSave
          label="Save General"
          loading={savingSection === "general"}
          onClick={() => saveSection("general", {
            siteName: general.siteName,
            enableFreeDelivery: general.enableFreeDelivery,
            freeDeliveryThreshold: parseFloat(general.freeDeliveryThreshold) || 0,
            coinValue: parseFloat(general.coinValue) || 0,
            welcomeCouponCode: general.welcomeCouponCode.trim() || null,
          })}
        />
      </div>

      {/* ── Web Settings ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-5 w-5 text-green-500" />
          <h3 className="text-base font-semibold text-gray-800">Web Settings</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-1">
          Control which features and sections are visible on the website storefront. Changes take effect immediately after saving.
        </p>

        {!configJwt ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold flex items-center gap-1.5"><Lock className="h-4 w-4" /> Config access required</p>
            <p className="text-xs mt-1">
              To manage website feature toggles, scroll down to <strong>Mobile App Config</strong> and log in with your admin credentials first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider pb-1">
              <ToggleRight className="h-3.5 w-3.5" /> Feature Toggles
            </div>
            {WEB_FEATURE_FLAGS.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <Toggle
                  checked={featureFlags[key] !== false}
                  onChange={v => setFeatureFlags(f => ({ ...f, [key]: v }))}
                />
              </div>
            ))}
            <SectionSave
              label="Save Web Settings"
              loading={configSaving === "flags"}
              onClick={() => saveMobileSection("flags", { featureFlags })}
            />
          </div>
        )}
      </div>

      {/* ── Tracking & Analytics ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="h-5 w-5 text-purple-500" />
          <h3 className="text-base font-semibold text-gray-800">Tracking &amp; Analytics</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-1">
          Connect Facebook Pixel and Google Tag (GA4 / Google Ads) for retargeting and conversion tracking. IDs are served publicly to the storefront.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Pixel ID</label>
          <Input
            placeholder="e.g. 1234567890123456"
            value={tracking.facebookPixelId}
            onChange={e => setTracking(f => ({ ...f, facebookPixelId: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-0.5">Found in Meta Events Manager → Data Sources → Pixel → Settings.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Tag ID</label>
          <Input
            placeholder="e.g. G-XXXXXXXXXX or AW-XXXXXXXXXX"
            value={tracking.googleTagId}
            onChange={e => setTracking(f => ({ ...f, googleTagId: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-0.5">GA4 Measurement ID or Google Ads Conversion ID from Google Tag Manager / Analytics.</p>
        </div>
        <SectionSave
          label="Save Tracking IDs"
          loading={savingSection === "tracking"}
          onClick={() => saveSection("tracking", {
            facebookPixelId: tracking.facebookPixelId.trim() || null,
            googleTagId: tracking.googleTagId.trim() || null,
          })}
        />
      </div>

      {/* ── Email / SMTP ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-5 w-5 text-blue-500" />
          <h3 className="text-base font-semibold text-gray-800">Email — Brevo SMTP</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-1">
          Used for sending verification codes and password reset emails via{" "}
          <a href="https://brevo.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Brevo</a>.
          Get your SMTP credentials at <strong>Brevo → SMTP &amp; API → SMTP</strong>.
        </p>

        <div className="flex items-center gap-2 p-3 rounded-lg border bg-gray-50">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${settings?.smtpEmail ? "bg-green-500" : "bg-gray-300"}`} />
          <span className="text-sm text-gray-600">
            {settings?.smtpEmail
              ? <><span className="font-medium text-gray-800">Configured</span> — sending from <span className="font-mono text-xs">{settings.smtpEmail}</span></>
              : <span className="text-gray-400">Not configured — email features are disabled</span>}
          </span>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Brevo setup guide</p>
          <p>For Brevo: Use Host: <span className="font-mono">smtp-relay.brevo.com</span>, Port: <span className="font-mono">587</span>, uncheck TLS, and use your Brevo SMTP Key as the password.</p>
          <p className="text-blue-600 mt-0.5">Get your SMTP key at <strong>Brevo → SMTP &amp; API → SMTP → Generate a new SMTP key</strong>.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brevo Login Email</label>
          <Input
            type="email"
            placeholder="your-brevo-account@email.com"
            value={smtp.smtpEmail}
            onChange={e => setSmtp(f => ({ ...f, smtpEmail: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-0.5">The email address you use to log in to Brevo.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brevo SMTP API Key <span className="text-gray-400 font-normal text-xs">(stored encrypted)</span></label>
          <Input
            type="password"
            placeholder="Leave blank to keep existing key"
            value={smtp.smtpPassword}
            onChange={e => setSmtp(f => ({ ...f, smtpPassword: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-0.5">
            Found at <span className="font-mono">Brevo → SMTP &amp; API → SMTP → Generate a new SMTP key</span>.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <SectionSave
            label="Save Email Settings"
            loading={savingSection === "smtp"}
            onClick={() => {
              setSmtpTestState("idle");
              setSmtpTestMessage("");
              saveSection("smtp", {
                smtpEmail: smtp.smtpEmail || null,
                smtpHost: "smtp-relay.brevo.com",
                smtpPort: 587,
                smtpSecure: false,
                ...(smtp.smtpPassword ? { smtpPassword: smtp.smtpPassword } : {}),
              });
            }}
          />
          <button
            type="button"
            disabled={smtpTestState === "sending" || !settings?.smtpEmail}
            onClick={sendSmtpTest}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {smtpTestState === "sending" ? (
              <>
                <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Sending test…
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Test Email
              </>
            )}
          </button>
          {smtpTestState === "ok" && (
            <p className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {smtpTestMessage}
            </p>
          )}
          {smtpTestState === "error" && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {smtpTestMessage}
            </p>
          )}
        </div>
      </div>

      {/* ── Google Sign-In ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-5 w-5 text-blue-500" />
          <h3 className="text-base font-semibold text-gray-800">Google Sign-In</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-1">
          Used by the mobile app so customers can sign in with their Google account. Get these from{" "}
          <strong>console.cloud.google.com → APIs &amp; Services → Credentials</strong>.
        </p>

        <div className="flex items-center gap-2 p-3 rounded-lg border bg-gray-50">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${(settings as any)?.googleConfigured ? "bg-green-500" : "bg-gray-300"}`} />
          <span className="text-sm text-gray-600">
            {(settings as any)?.googleConfigured
              ? <span className="font-medium text-gray-800">Configured — Google Sign-In is active</span>
              : <span className="text-gray-400">Not configured — Google Sign-In is disabled</span>}
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Web Client ID</label>
          <Input
            placeholder="xxxxxx.apps.googleusercontent.com"
            value={google.googleClientId}
            onChange={e => setGoogle(f => ({ ...f, googleClientId: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-0.5">The OAuth 2.0 Web Client ID from your Google Cloud project.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Android Client ID <span className="text-gray-400 font-normal">(optional)</span></label>
          <Input
            placeholder="xxxxxx.apps.googleusercontent.com"
            value={google.googleAndroidClientId}
            onChange={e => setGoogle(f => ({ ...f, googleAndroidClientId: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">iOS Client ID <span className="text-gray-400 font-normal">(optional)</span></label>
          <Input
            placeholder="xxxxxx.apps.googleusercontent.com"
            value={google.googleIosClientId}
            onChange={e => setGoogle(f => ({ ...f, googleIosClientId: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-0.5">Required for native Google Sign-In on iOS devices.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret <span className="text-red-400 font-normal text-xs">(stored encrypted)</span></label>
          <Input
            type="password"
            placeholder="Leave blank to keep existing secret"
            value={google.googleClientSecret}
            onChange={e => setGoogle(f => ({ ...f, googleClientSecret: e.target.value }))}
          />
        </div>
        <SectionSave
          label="Save Google Sign-In"
          loading={savingSection === "google"}
          onClick={() => saveSection("google", {
            googleClientId: google.googleClientId || null,
            googleAndroidClientId: google.googleAndroidClientId || null,
            googleIosClientId: google.googleIosClientId || null,
            ...(google.googleClientSecret ? { googleClientSecret: google.googleClientSecret } : {}),
          })}
        />
      </div>

      {/* ── WhatsApp ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <h3 className="text-base font-semibold text-gray-800">WhatsApp Support</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-1">
          Enter the WhatsApp number customers can contact. Include the country code (e.g. <strong>8801XXXXXXXXX</strong> for Bangladesh).
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
          <Input type="tel" placeholder="8801XXXXXXXXX" value={whatsapp.whatsappNumber} onChange={e => setWhatsapp({ whatsappNumber: e.target.value })} />
        </div>
        <SectionSave
          label="Save WhatsApp"
          loading={savingSection === "whatsapp"}
          onClick={() => saveSection("whatsapp", { whatsappNumber: whatsapp.whatsappNumber || null })}
        />
      </div>

      {/* ── Legal URLs ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-800">Legal URLs</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-1">
          These links open in the mobile app when customers tap Privacy Policy or Terms of Service. Leave blank to use the default shohure.com URLs.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Privacy Policy URL</label>
          <Input
            type="url"
            placeholder="https://shohure.com/privacy"
            value={legal.privacyPolicyUrl}
            onChange={e => setLegal(f => ({ ...f, privacyPolicyUrl: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Terms of Service URL</label>
          <Input
            type="url"
            placeholder="https://shohure.com/terms"
            value={legal.termsOfServiceUrl}
            onChange={e => setLegal(f => ({ ...f, termsOfServiceUrl: e.target.value }))}
          />
        </div>
        <SectionSave
          label="Save Legal URLs"
          loading={savingSection === "legal"}
          onClick={() => saveSection("legal", {
            privacyPolicyUrl: legal.privacyPolicyUrl || null,
            termsOfServiceUrl: legal.termsOfServiceUrl || null,
          })}
        />
      </div>

      {/* ── Cleanup & Retention ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-semibold text-gray-900">Cleanup & Retention</span>
        </div>
        <p className="text-sm text-gray-500 -mt-4">Old notifications and chat messages are automatically deleted on a 24-hour schedule. Set how many days to keep them.</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Retain notifications &amp; messages for (days)</label>
          <Input
            type="number"
            min={1}
            max={365}
            value={notificationRetentionDays === 0 ? "" : notificationRetentionDays}
            onChange={e => {
              const raw = e.target.value;
              if (raw === "") { setNotificationRetentionDays(0); return; }
              const n = parseInt(raw, 10);
              if (!isNaN(n)) setNotificationRetentionDays(n);
            }}
            onBlur={() => setNotificationRetentionDays(d => (d < 1 ? 7 : d))}
            className="w-40"
          />
          <p className="text-xs text-gray-400 mt-1">Default: 7 days. Minimum: 1 day.</p>
        </div>
        <SectionSave
          label="Save Retention"
          loading={savingSection === "retention"}
          onClick={() => saveSection("retention", { notificationRetentionDays })}
        />
      </div>

      {/* ── Payment Methods ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-5 w-5 text-pink-500" />
          <h3 className="text-base font-semibold text-gray-800">Payment Methods</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-3">
          Enable or disable each payment option in the checkout. Upload logos, set numbers, and customize labels shown to customers.
        </p>

        {/* COD */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">COD</span>
              <span className="font-semibold text-gray-800">Cash on Delivery</span>
            </div>
            <Toggle checked={codEnabled} onChange={setCodEnabled} />
          </div>
        </div>

        {/* Card / Bank */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">💳</span>
              <div>
                <span className="font-semibold text-gray-800">Card / Bank Transfer</span>
                <p className="text-xs text-gray-400">SSLCommerz online payment</p>
              </div>
            </div>
            <Toggle checked={cardEnabled} onChange={setCardEnabled} />
          </div>
        </div>

        {/* Pay Delivery Charge (Partial Payment) */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-8 h-8 shrink-0 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs">🚚</span>
              <div className="min-w-0">
                <span className="font-semibold text-gray-800 block">Pay Delivery Charge (Partial Payment)</span>
                <p className="text-xs text-gray-400">Customer pays only the delivery fee upfront via MFS; rest is COD</p>
              </div>
            </div>
            <div className="shrink-0">
              <Toggle checked={payDeliveryChargeEnabled} onChange={setPayDeliveryChargeEnabled} />
            </div>
          </div>
        </div>

        {/* bKash / Nagad / Rocket */}
        {(["bkash", "nagad", "rocket"] as MfsKey[]).map(key => {
          const meta = MFS_META[key];
          const state = mfs[key];
          return (
            <div key={key} className="rounded-lg border p-4 space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {state.logoUrl ? (
                    <img src={state.logoUrl} alt={meta.label} className="w-8 h-8 rounded-full object-contain border bg-white" />
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: meta.color }}>
                      {meta.label[0]}
                    </span>
                  )}
                  <span className="font-semibold text-gray-800">{meta.label}</span>
                </div>
                <Toggle checked={state.enabled} onChange={v => setMfsField(key, "enabled", v)} />
              </div>

              {state.enabled && (
                <>
                  {/* Logo upload */}
                  <LogoUpload
                    label={meta.label}
                    logoUrl={state.logoUrl}
                    onUploaded={url => setMfsField(key, "logoUrl", url)}
                    token={token ?? ""}
                  />

                  {/* Number */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Number</label>
                    <Input
                      type="tel"
                      placeholder={meta.placeholder}
                      value={state.number}
                      onChange={e => setMfsField(key, "number", e.target.value)}
                    />
                  </div>

                  {/* Number label */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Number Label</label>
                    <Input
                      placeholder={`e.g. "${meta.label} Number" or "Personal Number"`}
                      value={state.numberLabel}
                      onChange={e => setMfsField(key, "numberLabel", e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Shown below the number on the payment screen</p>
                  </div>

                  {/* Transaction ID label */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Transaction ID Field Label</label>
                    <Input
                      placeholder="e.g. Transaction ID (TrxID)"
                      value={state.txnLabel}
                      onChange={e => setMfsField(key, "txnLabel", e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Label for the transaction ID input on the submit page</p>
                  </div>
                </>
              )}
            </div>
          );
        })}

        <SectionSave
          label="Save Payment Methods"
          loading={savingSection === "payment_methods"}
          onClick={() => saveSection("payment_methods", {
            codEnabled,
            cardEnabled,
            payDeliveryChargeEnabled,
            bkashEnabled: mfs.bkash.enabled,
            bkashNumber: mfs.bkash.number || null,
            bkashLogoUrl: mfs.bkash.logoUrl || null,
            bkashNumberLabel: mfs.bkash.numberLabel,
            bkashTxnLabel: mfs.bkash.txnLabel,
            nagadEnabled: mfs.nagad.enabled,
            nagadNumber: mfs.nagad.number || null,
            nagadLogoUrl: mfs.nagad.logoUrl || null,
            nagadNumberLabel: mfs.nagad.numberLabel,
            nagadTxnLabel: mfs.nagad.txnLabel,
            rocketEnabled: mfs.rocket.enabled,
            rocketNumber: mfs.rocket.number || null,
            rocketLogoUrl: mfs.rocket.logoUrl || null,
            rocketNumberLabel: mfs.rocket.numberLabel,
            rocketTxnLabel: mfs.rocket.txnLabel,
          })}
        />
      </div>

      {/* ── App Colour ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="h-5 w-5 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-800">App Colour Theme</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-2">
          Applied as the primary colour across the mobile app — buttons, tabs, banners, and accents update for all users.
        </p>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
          <div className="w-12 h-12 rounded-xl shadow-md flex-shrink-0" style={{ backgroundColor: primaryColor }} />
          <div>
            <p className="text-sm font-semibold text-gray-800">Current colour</p>
            <p className="text-xs text-gray-500 font-mono">{primaryColor.toUpperCase()}</p>
          </div>
          <div className="ml-auto">
            <div className="w-10 h-10 rounded-full shadow-inner cursor-pointer border-2 border-white ring-2 ring-gray-200 overflow-hidden" style={{ backgroundColor: primaryColor }}>
              <input type="color" value={primaryColor} onChange={e => applyColor(e.target.value)} className="opacity-0 w-full h-full cursor-pointer" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            value={colorInput}
            onChange={e => setColorInput(e.target.value)}
            onBlur={() => { if (/^#[0-9A-Fa-f]{6}$/.test(colorInput)) applyColor(colorInput); }}
            placeholder="#E91E63"
            className="font-mono w-36"
            maxLength={7}
          />
          <span className="text-sm text-gray-400">Hex colour code</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => applyColor("#E91E63")}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Quick Presets</p>
          <div className="flex flex-wrap gap-3">
            {COLOR_PRESETS.map(p => (
              <button key={p.value} type="button" title={p.label} onClick={() => applyColor(p.value)} className="group flex flex-col items-center gap-1">
                <div
                  className="w-9 h-9 rounded-full shadow transition-transform group-hover:scale-110"
                  style={{ backgroundColor: p.value, outline: primaryColor === p.value ? `3px solid ${p.value}` : "none", outlineOffset: "2px" }}
                />
                <span className="text-[10px] text-gray-500 whitespace-nowrap">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
        <SectionSave
          label="Save Theme"
          loading={savingSection === "theme"}
          onClick={() => saveSection("theme", { primaryColor })}
        />
      </div>

      {/* ── SSLCommerz ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-5 w-5 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-800">SSLCommerz Payment</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store ID</label>
          <Input placeholder="your_store_id" value={payment.sslcommerzStoreId} onChange={e => setPayment(f => ({ ...f, sslcommerzStoreId: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store Password</label>
          <Input type="password" placeholder="••••••••" value={payment.sslcommerzStorePassword} onChange={e => setPayment(f => ({ ...f, sslcommerzStorePassword: e.target.value }))} />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="sandbox"
            checked={payment.sslcommerzSandbox}
            onChange={e => setPayment(f => ({ ...f, sslcommerzSandbox: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="sandbox" className="text-sm text-gray-700">Use Sandbox (test mode)</label>
        </div>
        <SectionSave
          label="Save SSLCommerz"
          loading={savingSection === "payment"}
          onClick={() => saveSection("payment", {
            sslcommerzStoreId: payment.sslcommerzStoreId || undefined,
            sslcommerzStorePassword: payment.sslcommerzStorePassword || undefined,
            sslcommerzSandbox: payment.sslcommerzSandbox,
          })}
        />
      </div>

      {/* ── Courier Services ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Truck className="h-5 w-5 text-indigo-500" />
          <h3 className="text-base font-semibold text-gray-800">Courier Services</h3>
        </div>
        <p className="text-sm text-gray-500 -mt-2">
          Enable courier integrations for home delivery orders. When auto-submit is on, orders are sent to the active courier automatically when confirmed.
        </p>

        {/* Steadfast */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Steadfast</p>
              <p className="text-xs text-gray-500 mt-0.5">Uses STEADFAST_API_KEY and STEADFAST_API_SECRET from environment.</p>
            </div>
            <Toggle checked={courier.steadfastEnabled} onChange={v => setCourier(f => ({ ...f, steadfastEnabled: v, activeCourier: v ? "steadfast" : f.activeCourier }))} />
          </div>
        </div>

        {/* Carrybee */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Carrybee</p>
              <p className="text-xs text-gray-500 mt-0.5">Carrybee courier API integration.</p>
            </div>
            <Toggle checked={courier.carrybeeEnabled} onChange={v => setCourier(f => ({ ...f, carrybeeEnabled: v, activeCourier: v ? "carrybee" : f.activeCourier }))} />
          </div>

          {courier.carrybeeEnabled && (
            <>
              <div className="flex items-center gap-3">
                <input type="radio" id="cbSandbox" name="cbMode" checked={courier.carrybeeMode === "sandbox"} onChange={() => setCourier(f => ({ ...f, carrybeeMode: "sandbox" }))} className="h-4 w-4" />
                <label htmlFor="cbSandbox" className="text-sm text-gray-700">Sandbox (test)</label>
                <input type="radio" id="cbProd" name="cbMode" checked={courier.carrybeeMode === "production"} onChange={() => setCourier(f => ({ ...f, carrybeeMode: "production" }))} className="h-4 w-4 ml-4" />
                <label htmlFor="cbProd" className="text-sm text-gray-700">Production</label>
              </div>

              {courier.carrybeeMode === "production" && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Production Credentials</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
                    <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={courier.carrybeeClientId} onChange={e => setCourier(f => ({ ...f, carrybeeClientId: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
                    <Input type="password" placeholder="••••••••••••••••" value={courier.carrybeeClientSecret} onChange={e => setCourier(f => ({ ...f, carrybeeClientSecret: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client Context</label>
                    <Input placeholder="Client context string" value={courier.carrybeeClientContext} onChange={e => setCourier(f => ({ ...f, carrybeeClientContext: e.target.value }))} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Carrybee Store ID</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Your Carrybee store ID"
                    value={courier.carrybeeStoreId}
                    onChange={e => setCourier(f => ({ ...f, carrybeeStoreId: e.target.value }))}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchCarrybeeStores}
                    disabled={fetchingStores}
                    className="shrink-0 text-xs"
                  >
                    {fetchingStores
                      ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Fetching…</>
                      : <><RefreshCw className="h-3 w-3 mr-1" />Fetch Stores</>
                    }
                  </Button>
                </div>

                {carrybeeStores !== null && (
                  <div className="rounded-lg border bg-gray-50 divide-y">
                    {carrybeeStores.length === 0 ? (
                      <p className="text-xs text-gray-500 p-3">No stores found. Make sure your credentials are saved and correct.</p>
                    ) : (
                      carrybeeStores.map(store => (
                        <button
                          key={store.id}
                          type="button"
                          onClick={() => {
                            setCourier(f => ({ ...f, carrybeeStoreId: store.id }));
                            setCarrybeeStores(null);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white transition-colors ${courier.carrybeeStoreId === store.id ? "bg-orange-50" : ""}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">{store.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{store.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${store.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                              {store.is_active ? "Active" : "Inactive"}
                            </span>
                            {courier.carrybeeStoreId === store.id && (
                              <span className="text-xs text-orange-500 font-semibold">Selected</span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-400">Save your credentials first, then click "Fetch Stores" to pick from your Carrybee account.</p>
              </div>
            </>
          )}
        </div>

        {/* Active courier + auto-submit */}
        {(courier.steadfastEnabled || courier.carrybeeEnabled) && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Active Courier</label>
              <div className="flex gap-3">
                {courier.steadfastEnabled && (
                  <button type="button" onClick={() => setCourier(f => ({ ...f, activeCourier: "steadfast" }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${courier.activeCourier === "steadfast" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
                    Steadfast
                  </button>
                )}
                {courier.carrybeeEnabled && (
                  <button type="button" onClick={() => setCourier(f => ({ ...f, activeCourier: "carrybee" }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${courier.activeCourier === "carrybee" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
                    Carrybee
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">This courier will be used for auto-submission.</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-700">Auto-submit to Courier</p>
                <p className="text-xs text-gray-500 mt-0.5">Automatically send home delivery orders to the active courier when an admin confirms them.</p>
              </div>
              <Toggle checked={courier.courierAutoSubmit} onChange={v => setCourier(f => ({ ...f, courierAutoSubmit: v }))} />
            </div>
          </div>
        )}

        <SectionSave
          label="Save Courier Settings"
          loading={savingSection === "courier"}
          onClick={() => saveSection("courier", {
            steadfastEnabled: courier.steadfastEnabled,
            carrybeeEnabled: courier.carrybeeEnabled,
            courierAutoSubmit: courier.courierAutoSubmit,
            activeCourier: courier.activeCourier,
            carrybeeMode: courier.carrybeeMode,
            carrybeeClientId: courier.carrybeeClientId || null,
            ...(courier.carrybeeClientSecret ? { carrybeeClientSecret: courier.carrybeeClientSecret } : {}),
            carrybeeClientContext: courier.carrybeeClientContext || null,
            carrybeeStoreId: courier.carrybeeStoreId || null,
          })}
        />
      </div>

      {/* ── Mobile App Config ── */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-800">Mobile App Config</h3>
          </div>
          {configJwt && (
            <button
              type="button"
              onClick={() => { localStorage.removeItem(CONFIG_JWT_KEY); setConfigJwt(null); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 -mt-1">
          Dynamic mobile app configuration: API endpoint, image storage provider, and feature flags. Requires separate config credentials.
        </p>

        {!configJwt ? (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <p className="text-xs text-gray-500">Enter the config credentials (set via <code className="bg-gray-200 px-1 rounded">ADMIN_EMAIL</code> / <code className="bg-gray-200 px-1 rounded">ADMIN_PASSWORD</code> env vars).</p>
            {configLoginError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{configLoginError}</div>
            )}
            <form onSubmit={handleConfigLogin} className="space-y-3">
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={configLoginEmail} onChange={e => setConfigLoginEmail(e.target.value)} required className="h-8 text-sm mt-0.5" />
              </div>
              <div>
                <Label className="text-xs">Password</Label>
                <Input type="password" value={configLoginPassword} onChange={e => setConfigLoginPassword(e.target.value)} required className="h-8 text-sm mt-0.5" />
              </div>
              <Button type="submit" size="sm" className="w-full">Unlock Mobile Config</Button>
            </form>
          </div>
        ) : configLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading config…
          </div>
        ) : (
          <div className="space-y-6">
            {/* API Base URL */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">API &amp; Network</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                <Input
                  value={configApiBaseUrl}
                  onChange={e => setConfigApiBaseUrl(e.target.value)}
                  placeholder="https://your-api.onrender.com"
                />
                <p className="text-xs text-gray-400 mt-0.5">The mobile app uses this URL for all API calls in production builds.</p>
              </div>
              <div className="pt-2 flex justify-end border-t">
                <Button size="sm" disabled={configSaving === "api"} onClick={() => saveMobileSection("api", { apiBaseUrl: configApiBaseUrl })}>
                  {configSaving === "api" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  {configSaving === "api" ? "Saving…" : "Save API URL"}
                </Button>
              </div>
            </div>

            {/* Storage */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Image Storage</h4>
              </div>
              <p className="text-xs text-gray-400">Where uploaded images are stored. Supabase and AWS S3 survive redeploys; Local disk does not.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Provider</label>
                <select
                  value={storageProvider}
                  onChange={e => setStorageProvider(e.target.value as StorageProvider)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="local">Local Disk (temporary – lost on redeploy)</option>
                  <option value="supabase">Supabase Storage (recommended)</option>
                  <option value="aws_s3">AWS S3</option>
                </select>
              </div>

              {storageProvider === "local" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-yellow-800">
                  <p className="font-semibold mb-1">Warning: Local disk storage</p>
                  <p>Files are saved on the server's disk and will be lost when the server redeploys. Switch to Supabase for production.</p>
                </div>
              )}

              {storageProvider === "supabase" && (
                <div className="space-y-3 border border-blue-100 bg-blue-50/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Supabase Settings</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project URL</label>
                    <Input value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://xxxx.supabase.co" className="text-sm h-8" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Service Role Key <span className="text-red-500">(stored encrypted)</span></label>
                    <Input type="password" value={supabaseServiceKey} onChange={e => setSupabaseServiceKey(e.target.value)} placeholder="Leave blank to keep existing" className="text-sm h-8" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bucket Name</label>
                    <Input value={supabaseBucket} onChange={e => setSupabaseBucket(e.target.value)} placeholder="images" className="text-sm h-8" />
                  </div>
                </div>
              )}

              {storageProvider === "aws_s3" && (
                <div className="space-y-3 border border-orange-100 bg-orange-50/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="h-3.5 w-3.5 text-orange-600" />
                    <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider">AWS S3 Settings</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Access Key ID <span className="text-red-500">(stored encrypted)</span></label>
                    <Input type="password" value={awsAccessKey} onChange={e => setAwsAccessKey(e.target.value)} placeholder="Leave blank to keep existing" className="text-sm h-8" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Secret Access Key <span className="text-red-500">(stored encrypted)</span></label>
                    <Input type="password" value={awsSecretKey} onChange={e => setAwsSecretKey(e.target.value)} placeholder="Leave blank to keep existing" className="text-sm h-8" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
                    <Input value={awsRegion} onChange={e => setAwsRegion(e.target.value)} placeholder="ap-southeast-1" className="text-sm h-8" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bucket Name</label>
                    <Input value={awsBucket} onChange={e => setAwsBucket(e.target.value)} placeholder="my-shohure-bucket" className="text-sm h-8" />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end border-t">
                <Button size="sm" disabled={configSaving === "storage"} onClick={() => saveMobileSection("storage", {
                  storageProvider,
                  supabaseUrl: supabaseUrl || undefined,
                  ...(supabaseServiceKey ? { supabaseServiceKey } : {}),
                  supabaseBucket: supabaseBucket || undefined,
                  ...(awsAccessKey ? { awsAccessKey } : {}),
                  ...(awsSecretKey ? { awsSecretKey } : {}),
                  awsRegion: awsRegion || undefined,
                  awsBucket: awsBucket || undefined,
                })}>
                  {configSaving === "storage" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  {configSaving === "storage" ? "Saving…" : "Save Storage"}
                </Button>
              </div>
            </div>

            {/* Feature Flags */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Feature Flags</h4>
              <p className="text-xs text-gray-400">Toggle features in the mobile app without a code release. Changes take effect on next app launch.</p>
              <div className="space-y-2">
                {Object.entries(featureFlags).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg">
                    <span className="font-mono text-sm text-gray-700">{key}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${value ? "text-green-600" : "text-gray-400"}`}>{value ? "ON" : "OFF"}</span>
                      <Switch
                        checked={value}
                        onCheckedChange={v => setFeatureFlags(prev => ({ ...prev, [key]: v }))}
                      />
                      <Button variant="ghost" size="sm" onClick={() => setFeatureFlags(prev => { const { [key]: _, ...rest } = prev; return rest; })} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {Object.keys(featureFlags).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3">No feature flags yet. Add one below.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newFlagKey}
                  onChange={e => setNewFlagKey(e.target.value)}
                  placeholder="flagName (camelCase)"
                  onKeyDown={e => { if (e.key === "Enter") { const k = newFlagKey.trim(); if (k) { setFeatureFlags(prev => ({ ...prev, [k]: false })); setNewFlagKey(""); } } }}
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => { const k = newFlagKey.trim(); if (k) { setFeatureFlags(prev => ({ ...prev, [k]: false })); setNewFlagKey(""); } }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              <div className="pt-2 flex justify-end border-t">
                <Button size="sm" disabled={configSaving === "flags"} onClick={() => saveMobileSection("flags", { featureFlags })}>
                  {configSaving === "flags" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  {configSaving === "flags" ? "Saving…" : "Save Flags"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
