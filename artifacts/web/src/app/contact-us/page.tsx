"use client";
import Link from "next/link";
import { ChevronRight, MapPin, Phone, Mail, Clock } from "lucide-react";
import { usePublicConfig } from "@/lib/usePublicConfig";

export default function ContactPage() {
  const { data: config } = usePublicConfig();
  const address = config?.supportAddress || "123 Gulshan Avenue, Dhaka-1212, Bangladesh";
  const phone = config?.supportPhone || "16167 (Customer Support)";
  const email = config?.supportEmail || "support@shohure.com.bd";

  const contactItems = [
    { icon: MapPin, label: "Address", lines: [address] },
    { icon: Phone, label: "Phone", lines: [phone] },
    { icon: Mail, label: "Email", lines: [email] },
    { icon: Clock, label: "Support Hours", lines: ["Sat–Thu: 9AM–8PM", "Fri: 2PM–8PM"] },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">Contact Us</span>
      </nav>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Get in Touch</h1>
        <p className="text-gray-500">We&apos;d love to hear from you. Send us a message!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Send Message</h2>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name</label>
                <input type="text" placeholder="John Doe" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
                <input type="email" placeholder="john@example.com" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
              <input type="tel" placeholder="+880 1X XXXX XXXX" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject</label>
              <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] bg-white">
                <option>Order Issue</option>
                <option>Return / Refund</option>
                <option>Payment Problem</option>
                <option>Product Inquiry</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message</label>
              <textarea
                rows={5}
                placeholder="Tell us how we can help you..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] resize-none"
              />
            </div>
            <button type="submit" className="w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] text-white font-semibold rounded-xl transition-colors">
              Send Message
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4">Contact Info</h3>
            <div className="space-y-4">
              {contactItems.map((info, i) => {
                const Icon = info.icon;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-[#F0185A]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-0.5">{info.label}</p>
                      {info.lines.map((line, j) => (
                        <p key={j} className="text-sm text-gray-700">{line}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-rose-400 rounded-2xl p-5 text-white text-center">
            <div className="text-3xl mb-2">💬</div>
            <h4 className="font-bold mb-1">Live Chat</h4>
            <p className="text-pink-100 text-xs mb-3">Get instant support from our team</p>
            <button className="bg-white text-[#F0185A] font-semibold px-5 py-2 rounded-xl text-sm hover:shadow transition-shadow w-full">
              Start Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
