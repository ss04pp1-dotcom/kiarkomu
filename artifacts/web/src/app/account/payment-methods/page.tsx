"use client";

export default function PaymentMethodsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Payment Methods</h2>
      </div>

      <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl mb-5">
        <p className="text-sm font-semibold text-blue-800 mb-1">How payments work</p>
        <p className="text-sm text-blue-700">
          Payment methods are selected at checkout for each order. We support bKash, Nagad,
          Rocket, Cash on Delivery, and Card payments. No payment details are stored on your account.
        </p>
      </div>

      <div className="p-5 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
        <p className="text-sm text-gray-500 mb-3">Accepted payment methods</p>
        <div className="flex justify-center gap-3 text-2xl flex-wrap">
          {[
            { icon: "📱", label: "bKash" },
            { icon: "💰", label: "Nagad" },
            { icon: "🚀", label: "Rocket" },
            { icon: "💳", label: "Card" },
            { icon: "🚚", label: "Cash on Delivery" },
          ].map((method) => (
            <div key={method.label} className="flex flex-col items-center gap-1">
              <span className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 text-2xl">
                {method.icon}
              </span>
              <span className="text-xs text-gray-400">{method.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
