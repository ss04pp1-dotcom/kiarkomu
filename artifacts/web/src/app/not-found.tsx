import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-black text-[#F0185A] mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-gray-500 mb-8">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="bg-[#F0185A] hover:bg-[#c8124a] text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            Go Home
          </Link>
          <Link href="/categories" className="border border-gray-200 text-gray-600 hover:border-[#F0185A] hover:text-[#F0185A] font-medium px-6 py-3 rounded-xl transition-colors">
            Browse Categories
          </Link>
        </div>
      </div>
    </div>
  );
}
