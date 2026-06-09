export const runtime = "edge";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function BlogPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800">Blog</span>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Shohure Blog</h1>
      <p className="text-gray-500 mb-10">Tips, news and updates from the Shohure team.</p>
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
        <div className="text-5xl mb-4">✍️</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Coming Soon</h2>
        <p className="text-gray-400 text-sm">We're working on exciting content. Check back soon!</p>
        <Link href="/" className="inline-block mt-6 px-6 py-2.5 bg-[#F0185A] text-white rounded-lg text-sm font-medium hover:bg-[#c8124a] transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
