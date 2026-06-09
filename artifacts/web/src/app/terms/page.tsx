export const runtime = "edge";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800">Terms of Service</span>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: January 2025</p>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 space-y-6 text-sm text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using Shohure, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">2. Use of Service</h2>
          <p>You may use Shohure for lawful purposes only. You agree not to misuse our services, attempt to gain unauthorised access, or engage in any activity that disrupts the platform.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">3. Account Responsibility</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials. You are liable for all activities that occur under your account.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">4. Orders & Payments</h2>
          <p>All orders are subject to product availability. We reserve the right to cancel orders at our discretion. Prices are listed in Bangladeshi Taka (BDT) and may change without notice.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">5. Returns & Refunds</h2>
          <p>Our return and refund policy allows returns within 7 days of delivery for eligible items. Please contact our support team to initiate a return.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">6. Limitation of Liability</h2>
          <p>Shohure is not liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">7. Contact</h2>
          <p>For questions about these terms, please <Link href="/contact-us" className="text-[#F0185A] hover:underline">contact us</Link>.</p>
        </section>
      </div>
    </div>
  );
}
