import React, { useRef, useState, useEffect } from "react";
import { API_URL } from "@/lib/api-url";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Layers, ToggleLeft, ToggleRight, Eye, ImageIcon, Upload, X, Loader2 } from "lucide-react";

interface PromoCard {
  id: string;
  enabled: boolean;
  emoji: string;
  imageUrl?: string;
  title: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
}

const DEFAULT_CARDS: PromoCard[] = [
  {
    id: "cart-win",
    enabled: true,
    emoji: "🏆",
    title: "Add to Cart & Win",
    subtitle: "Win up to ৳5000",
    accentColor: "#E91E63",
    bgColor: "#FFF0F5",
  },
  {
    id: "free-delivery",
    enabled: true,
    emoji: "🚚",
    title: "FREE DELIVERY",
    subtitle: "On orders above ৳500",
    accentColor: "#4CAF50",
    bgColor: "#F1F8E9",
  },
  {
    id: "cartup-picks",
    enabled: true,
    emoji: "⭐",
    title: "CARTUP PICKS",
    subtitle: "Curated for you",
    accentColor: "#1565C0",
    bgColor: "#E3F2FD",
  },
  {
    id: "flash-sale",
    enabled: true,
    emoji: "⚡",
    title: "FLASH SALE",
    subtitle: "Limited time deals",
    accentColor: "#FF6F00",
    bgColor: "#FFF8E1",
  },
];

function CardPreview({ card }: { card: PromoCard }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2 w-44 shadow-sm border"
      style={{ backgroundColor: card.bgColor, opacity: card.enabled ? 1 : 0.4 }}
    >
      {card.imageUrl ? (
        <img
          src={card.imageUrl}
          alt={card.title}
          className="w-10 h-10 object-contain rounded"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="text-3xl">{card.emoji}</div>
      )}
      <div className="font-bold text-sm leading-tight" style={{ color: card.accentColor }}>
        {card.title}
      </div>
      <div className="text-xs text-gray-500">{card.subtitle}</div>
      {!card.enabled && (
        <div className="text-xs font-semibold text-gray-400 bg-gray-100 rounded px-2 py-0.5 w-fit">
          Hidden
        </div>
      )}
    </div>
  );
}


export default function PromoCards() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [cards, setCards] = useState<PromoCard[]>(DEFAULT_CARDS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleImageUpload = async (cardId: string, file: File) => {
    setUploadingId(cardId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("shohure_admin_token");
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error ?? "Upload failed", variant: "destructive" });
        return;
      }
      const { url } = await res.json();
      update(cardId, { imageUrl: url });
      toast({ title: "Image uploaded", description: "Click Save All to apply." });
    } catch {
      toast({ title: "Upload failed — check your connection", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  useEffect(() => {
    if (settings) {
      const raw = (settings as any).promoCardsJson;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setCards(parsed);
            return;
          }
        } catch (parseErr) {
          console.warn("Failed to parse promo cards JSON:", parseErr);
        }
      }
      setCards(DEFAULT_CARDS);
    }
  }, [settings]);

  const update = (id: string, patch: Partial<PromoCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleSave = () => {
    updateSettings.mutate(
      { data: { promoCardsJson: JSON.stringify(cards) } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
          toast({ title: "Promo cards saved ✓", description: "Changes will appear in the mobile app." });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Loading promo cards...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Layers className="h-7 w-7 text-blue-600" /> Promo Cards
        </h2>
        <Button onClick={handleSave} disabled={updateSettings.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {updateSettings.isPending ? "Saving..." : "Save All"}
        </Button>
      </div>

      <p className="text-sm text-gray-500">
        These 4 cards appear on the mobile home screen, overlapping the hero banner. Toggle visibility and edit content for each card.
      </p>

      {/* Preview row */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">Live Preview</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {cards.map((card) => (
            <CardPreview key={card.id} card={card} />
          ))}
        </div>
      </div>

      {/* Card editors */}
      <div className="space-y-3">
        {cards.map((card) => {
          const isOpen = expandedId === card.id;
          return (
            <div
              key={card.id}
              className="rounded-xl border bg-white shadow-sm overflow-hidden"
            >
              {/* Card row header */}
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(isOpen ? null : card.id)}
              >
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt="" className="w-8 h-8 object-contain rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <span className="text-2xl">{card.emoji}</span>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{card.title}</p>
                  <p className="text-xs text-gray-400">{card.subtitle}</p>
                </div>
                <button
                  className="p-1 rounded-md hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    update(card.id, { enabled: !card.enabled });
                  }}
                  title={card.enabled ? "Disable card" : "Enable card"}
                >
                  {card.enabled ? (
                    <ToggleRight className="h-6 w-6 text-green-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-400" />
                  )}
                </button>
                <span className="text-gray-400 text-sm">{isOpen ? "▲" : "▼"}</span>
              </div>

              {/* Expanded editor */}
              {isOpen && (
                <div className="border-t px-5 py-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" /> Card Image
                      <span className="text-gray-400 font-normal normal-case ml-1">(overrides emoji when set)</span>
                    </label>
                    {/* Image preview + remove */}
                    {card.imageUrl && (
                      <div className="flex items-center gap-3 mb-2 p-2 bg-white rounded-lg border">
                        <img src={card.imageUrl} alt="" className="w-12 h-12 object-contain rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        <span className="text-xs text-gray-500 flex-1 truncate">{card.imageUrl}</span>
                        <button onClick={() => update(card.id, { imageUrl: undefined })} className="text-red-400 hover:text-red-600 p-1 rounded">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {/* Upload button + URL input */}
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[card.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(card.id, file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingId === card.id}
                        onClick={() => fileInputRefs.current[card.id]?.click()}
                        className="shrink-0 gap-1.5"
                      >
                        {uploadingId === card.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {uploadingId === card.id ? "Uploading…" : "Upload"}
                      </Button>
                      <Input
                        value={card.imageUrl ?? ""}
                        onChange={(e) => update(card.id, { imageUrl: e.target.value || undefined })}
                        placeholder="Or paste image URL (PNG, JPG, WebP)"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Upload a file or paste a URL. Leave blank to use emoji instead.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Emoji <span className="text-gray-400 font-normal normal-case">(fallback)</span></label>
                    <Input
                      value={card.emoji}
                      onChange={(e) => update(card.id, { emoji: e.target.value })}
                      placeholder="🏆"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
                    <Input
                      value={card.title}
                      onChange={(e) => update(card.id, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Subtitle</label>
                    <Input
                      value={card.subtitle}
                      onChange={(e) => update(card.id, { subtitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={card.accentColor}
                        onChange={(e) => update(card.id, { accentColor: e.target.value })}
                        className="h-10 w-14 cursor-pointer rounded border"
                      />
                      <Input
                        value={card.accentColor}
                        onChange={(e) => update(card.id, { accentColor: e.target.value })}
                        placeholder="#E91E63"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={card.bgColor}
                        onChange={(e) => update(card.id, { bgColor: e.target.value })}
                        className="h-10 w-14 cursor-pointer rounded border"
                      />
                      <Input
                        value={card.bgColor}
                        onChange={(e) => update(card.id, { bgColor: e.target.value })}
                        placeholder="#FFF0F5"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-gray-400 mt-1">
                      {card.id === "flash-sale"
                        ? "⚡ The Flash Sale card shows a live countdown timer if an active flash sale exists."
                        : "Changes apply on next mobile app refresh."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
