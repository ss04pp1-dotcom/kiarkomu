export const runtime = "edge";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800">Privacy Policy</span>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: January 2025</p>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 space-y-6 text-sm text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">1. Information We Collect</h2>
          <p>We collect information you provide directly (name, email, phone, address) and information generated through your use of our platform (orders, browsing behaviour, device information).</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">2. How We Use Your Information</h2>
          <p>We use your information to process orders, deliver products, personalise your experience, send order updates, and improve our platform.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">3. Data Sharing</h2>
          <p>We do not sell your personal information. We may share data with delivery partners and payment processors as necessary to complete your orders.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">4. Cookies</h2>
          <p>We use cookies to maintain your session, remember your cart, and analyse platform usage. You can manage cookie preferences in your browser settings.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">5. Data Security</h2>
          <p>We implement industry-standard security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">6. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal information. Contact us to exercise these rights.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">7. Contact</h2>
          <p>For privacy-related questions, please <Link href="/contact-us" className="text-[#F0185A] hover:underline">contact us</Link>.</p>
        </section>
      </div>
    </div>
  );
}
