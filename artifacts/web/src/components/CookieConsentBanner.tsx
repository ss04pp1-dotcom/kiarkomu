"use client";
import { useState, useEffect } from "react";
import { grantTrackingConsent, declineTrackingConsent, consentAnswered } from "@/lib/tracking";
import { Cookie, X } from "lucide-react";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!consentAnswered()) setVisible(true);
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    grantTrackingConsent();
    setVisible(false);
  };

  const handleDecline = () => {
    declineTrackingConsent();
    setVisible(false);
  };

  // Bug fix #5: X button previously called handleDecline(), permanently writing
  // "false" to localStorage so the banner never appeared again. Now it just
  // closes the banner without recording any decision — the banner will reappear
  // on the next page load until the user makes an actual choice.
  const handleDismiss = () => {
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-[#F0185A]/10 rounded-xl flex items-center justify-center">
            <Cookie className="w-5 h-5 text-[#F0185A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">We use cookies</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              We use cookies and tracking to personalise ads and improve your experience. By accepting, you agree to our{" "}
              <a href="/privacy" className="underline hover:text-[#F0185A]" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="px-5 py-2 text-xs font-semibold bg-[#F0185A] hover:bg-[#c8124a] text-white rounded-lg transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
