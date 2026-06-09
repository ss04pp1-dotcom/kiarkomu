import Link from "next/link";
import { ChevronRight, Package, RotateCcw, CreditCard, Shield, MessageCircle, Mail } from "lucide-react";

const topics = [
  { icon: Package, label: "Track Order", desc: "Check your order status", href: "/order-tracking" },
  { icon: RotateCcw, label: "Returns & Refunds", desc: "Start a return or refund", href: "#" },
  { icon: CreditCard, label: "Payment Issues", desc: "Resolve payment problems", href: "#" },
  { icon: Shield, label: "Account & Security", desc: "Manage your account security", href: "#" },
  { icon: MessageCircle, label: "Contact Support", desc: "Chat with our team", href: "#" },
  { icon: Mail, label: "Other Issues", desc: "Get help with anything else", href: "#" },
];

const faqs = [
  { q: "How can I track my order?", a: "You can track your order by visiting the Order Tracking page and entering your order ID. You will also receive updates via SMS and email." },
  { q: "What is Shohure's return policy?", a: "We offer a 7-day return policy for most products. Items must be in original condition and packaging. Some categories may have different return windows." },
  { q: "How do I cancel my order?", a: "You can cancel your order from My Orders page within 1 hour of placing it. Once the order is shipped, it cannot be cancelled." },
  { q: "What payment methods are accepted?", a: "We accept bKash, Nagad, Rocket, Visa, Mastercard, and Cash on Delivery for most areas in Bangladesh." },
  { q: "Is Cash on Delivery available?", a: "Yes, Cash on Delivery is available for most areas across Bangladesh. A small COD charge may apply." },
];

export default function HelpSupportPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">Help & Support</span>
      </nav>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">How can we help you?</h1>
        <div className="max-w-md mx-auto relative">
          <input
            type="text"
            placeholder="Search for help articles..."
            className="w-full border border-gray-200 rounded-xl px-5 py-3 text-sm outline-none focus:border-[#F0185A] pr-12"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#F0185A]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-4">Popular Topics</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {topics.map((t, i) => {
          const Icon = t.icon;
          return (
            <Link key={i} href={t.href} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col items-center text-center hover:shadow-md hover:border-[#F0185A] transition-all group">
              <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-pink-100 transition-colors">
                <Icon className="w-6 h-6 text-[#F0185A]" />
              </div>
              <p className="text-sm font-semibold text-gray-800">{t.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details key={i} className="group border border-gray-100 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer font-medium text-sm text-gray-800 hover:bg-gray-50 transition-colors list-none">
                {faq.q}
                <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-3">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-pink-500 to-rose-400 rounded-2xl p-6 text-white">
          <MessageCircle className="w-8 h-8 mb-3" />
          <h3 className="font-bold text-lg mb-1">Live Chat</h3>
          <p className="text-pink-100 text-sm mb-4">Chat with our support team now. Available 24/7.</p>
          <button className="bg-white text-[#F0185A] font-semibold px-5 py-2.5 rounded-xl text-sm hover:shadow transition-shadow">
            Start Chat
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <Mail className="w-8 h-8 text-[#F0185A] mb-3" />
          <h3 className="font-bold text-lg mb-1 text-gray-900">Email Support</h3>
          <p className="text-gray-400 text-sm mb-4">Send us a message and we&apos;ll respond within 24 hours.</p>
          <Link href="/contact-us" className="bg-[#F0185A] text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-[#c8124a] transition-colors inline-block">
            Send Message
          </Link>
        </div>
      </div>
    </div>
  );
}
