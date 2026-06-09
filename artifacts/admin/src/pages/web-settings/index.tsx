import { useState, useEffect } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Globe, Megaphone, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WebSettings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setAnnouncementText((settings as any).webAnnouncementText ?? "");
      setAnnouncementActive((settings as any).webAnnouncementActive !== false);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        data: {
          webAnnouncementText: announcementText.trim() || null,
          webAnnouncementActive: announcementActive,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      setDirty(false);
      toast({ title: "Web settings saved", description: "The announcement ticker has been updated." });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Globe className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Web Settings</h1>
          <p className="text-sm text-gray-500">Configure the web storefront announcement ticker</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Megaphone className="w-5 h-5 text-gray-500" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">Announcement Ticker</p>
              <p className="text-xs text-gray-400 mt-0.5">Scrolling news bar shown on the home page</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setAnnouncementActive(v => !v); setDirty(true); }}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            {announcementActive ? (
              <><ToggleRight className="w-8 h-8 text-green-500" /><span className="text-green-600">Active</span></>
            ) : (
              <><ToggleLeft className="w-8 h-8 text-gray-300" /><span className="text-gray-400">Inactive</span></>
            )}
          </button>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Announcement Text
          </label>
          <textarea
            value={announcementText}
            onChange={e => { setAnnouncementText(e.target.value); setDirty(true); }}
            rows={3}
            placeholder="e.g. Free delivery on orders over ৳2000! Use code SAVE10 for 10% off your next order."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors resize-none"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Leave blank to hide the ticker entirely. The text will scroll continuously across the homepage.
          </p>
        </div>

        {announcementText && announcementActive && (
          <div className="bg-gradient-to-r from-pink-500 via-pink-600 to-pink-500 rounded-xl py-2.5 px-4 overflow-hidden">
            <p className="text-white text-sm font-medium truncate">
              📢 Preview: {announcementText}
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={!dirty || updateSettings.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="w-4 h-4" />
            {updateSettings.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
