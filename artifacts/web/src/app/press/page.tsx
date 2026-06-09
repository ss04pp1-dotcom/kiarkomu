export const runtime = "edge";
import Link from "next/link";
import { ChevronRight, Newspaper } from "lucide-react";

export default function PressPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800">Press</span>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Press & Media</h1>
      <p className="text-gray-500 mb-10">News and media resources for journalists and press enquiries.</p>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Press Enquiries</h2>
        <p className="text-gray-500 text-sm mb-4">For media enquiries, interviews, or press kit requests, please contact our team.</p>
        <Link href="/contact-us" className="inline-block px-6 py-2.5 bg-[#F0185A] text-white rounded-lg text-sm font-medium hover:bg-[#c8124a] transition-colors">
          Contact Press Team
        </Link>
      </div>
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
        <Newspaper className="w-12 h-12 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Press Kit Coming Soon</h2>
        <p className="text-gray-400 text-sm">Logos, brand guidelines and fact sheets will be available here.</p>
      </div>
    </div>
  );
}
