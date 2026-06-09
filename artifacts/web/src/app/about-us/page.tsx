import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Users, Package, Star, Globe } from "lucide-react";

const stats = [
  { icon: Users, value: "10M+", label: "Happy Customers" },
  { icon: Package, value: "50K+", label: "Products" },
  { icon: Star, value: "500+", label: "Brands" },
  { icon: Globe, value: "100%", label: "Authentic" },
];

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">About Shohure</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-12">
        <div>
          <span className="text-sm font-semibold text-[#F0185A] bg-pink-50 px-3 py-1 rounded-full">Our Story</span>
          <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-4">Bangladesh&apos;s Most Trusted Online Shop</h1>
          <p className="text-gray-500 leading-relaxed mb-4">
            Shohure was founded in 2019 with a simple mission: to make quality products accessible to everyone across Bangladesh. We started as a small electronics shop in Dhaka and have since grown into a full-scale e-commerce platform serving millions of customers nationwide.
          </p>
          <p className="text-gray-500 leading-relaxed">
            Today, Shohure offers over 50,000 products across Electronics, Fashion, Home & Living, Beauty, Sports and more, all sourced from verified brands and sellers to ensure 100% authenticity.
          </p>
        </div>
        <div className="relative h-72 rounded-2xl overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80"
            alt="About Shohure"
            fill
            className="object-cover"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
              <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Icon className="w-6 h-6 text-[#F0185A]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-400 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-[#F0185A] to-rose-400 rounded-2xl p-8 text-white text-center mb-8">
        <h2 className="text-2xl font-bold mb-3">Our Mission</h2>
        <p className="text-pink-100 leading-relaxed max-w-2xl mx-auto">
          To empower every Bangladeshi with access to authentic, affordable products through a seamless, secure, and trusted e-commerce experience — delivered to their doorstep, anywhere in Bangladesh.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Customer First", desc: "Every decision we make is driven by what's best for our customers.", icon: "❤️" },
          { title: "100% Authentic", desc: "We work only with verified brands and authorized sellers.", icon: "✅" },
          { title: "Fast Delivery", desc: "Same-day delivery in Dhaka and next-day across Bangladesh.", icon: "🚀" },
        ].map((v, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <div className="text-4xl mb-3">{v.icon}</div>
            <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{v.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
