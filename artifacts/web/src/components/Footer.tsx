"use client";
import Link from "next/link";
import { Facebook, Twitter, Instagram, Youtube, MapPin, Phone, Mail } from "lucide-react";
import { usePublicConfig } from "@/lib/usePublicConfig";

export default function Footer() {
  const { data: appSettings } = usePublicConfig();
  const siteName = appSettings?.siteName || "Shohure";

  return (
    <footer className="bg-gray-900 text-gray-300 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#F0185A] rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">{siteName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-xl font-bold text-white">{siteName}</span>
            </div>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              Bangladesh&apos;s trusted e-commerce platform offering a wide range of products from electronics to fashion, with fast delivery across the country.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#F0185A] flex-shrink-0" />
                <span>123 Gulshan Avenue, Dhaka-1212</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#F0185A] flex-shrink-0" />
                <span>16167 (Customer Support)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#F0185A] flex-shrink-0" />
                <span>support@shohure.com.bd</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {["About Us", "Contact Us", "Help & Support", "Blog", "Careers", "Press"].map(item => (
                <li key={item}>
                  <Link href={`/${item.toLowerCase().replace(/ /g, "-")}`} className="hover:text-[#F0185A] transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Customer Service</h4>
            <ul className="space-y-2 text-sm">
              {["Track Order", "Returns & Refunds", "Payment Issues", "Account & Security", "Seller Support", "FAQs"].map(item => (
                <li key={item}>
                  <Link href="/help-support" className="hover:text-[#F0185A] transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">My Account</h4>
            <ul className="space-y-2 text-sm">
              {["My Profile", "My Orders", "My Wishlist", "My Addresses", "Payment Methods", "Notifications"].map(item => (
                <li key={item}>
                  <Link href="/account" className="hover:text-[#F0185A] transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h5 className="text-white text-sm font-medium mb-3">Payment Methods</h5>
              <div className="flex gap-2">
                {["bKash", "Nagad", "Rocket", "Visa", "MasterCard"].map(method => (
                  <span key={method} className="px-2.5 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-700">
                    {method}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h5 className="text-white text-sm font-medium mb-3 md:text-right">Follow Us</h5>
              <div className="flex gap-3">
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                  <Link key={i} href="#" className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-[#F0185A] transition-colors">
                    <Icon className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500">
            © 2025 {siteName}. All rights reserved. | Privacy Policy | Terms of Service
          </div>
        </div>
      </div>
    </footer>
  );
}
