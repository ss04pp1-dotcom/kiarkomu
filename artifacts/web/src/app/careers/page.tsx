export const runtime = "edge";
import Link from "next/link";
import { ChevronRight, Briefcase } from "lucide-react";

export default function CareersPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800">Careers</span>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Join Our Team</h1>
      <p className="text-gray-500 mb-10">Help us build the future of e-commerce in Bangladesh.</p>
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
        <Briefcase className="w-12 h-12 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No Open Positions Right Now</h2>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">We don't have any open roles at the moment, but we're always growing. Check back soon or reach out to us directly.</p>
        <Link href="/contact-us" className="inline-block mt-6 px-6 py-2.5 bg-[#F0185A] text-white rounded-lg text-sm font-medium hover:bg-[#c8124a] transition-colors">
          Contact Us
        </Link>
      </div>
    </div>
  );
}
