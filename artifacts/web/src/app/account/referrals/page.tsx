"use client";
import { useState } from "react";
import Link from "next/link";
import { usePublicConfig } from "@/lib/usePublicConfig";
import {
  Coins, Gift, Users, Copy, Check, ChevronRight,
  Loader2, TrendingUp, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import {
  useGetCoinBalance, useListCoinTransactions, useGetReferralInfo,
  getGetCoinBalanceQueryKey, getGetReferralInfoQueryKey, getListCoinTransactionsQueryKey,
} from "@workspace/api-client-react";
import type { CoinTransaction } from "@workspace/api-client-react";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const { data: publicConfig } = usePublicConfig();
  const siteName = publicConfig?.siteName || "Shohure";

  const { data: coinBalance, isLoading: balanceLoading } = useGetCoinBalance({
    query: { queryKey: getGetCoinBalanceQueryKey() },
  });
  const { data: referralInfo, isLoading: referralLoading } = useGetReferralInfo({
    query: { queryKey: getGetReferralInfoQueryKey() },
  });
  const { data: transactions = [], isLoading: txLoading } = useListCoinTransactions({
    query: { queryKey: getListCoinTransactionsQueryKey() },
  });

  const handleCopy = () => {
    if (referralInfo?.referralCode) {
      navigator.clipboard.writeText(referralInfo.referralCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (referralInfo?.referralCode && navigator.share) {
      navigator.share({
        title: `Join ${siteName}!`,
        text: `Use my referral code ${referralInfo.referralCode} on ${siteName} to get extra coins on your first order!`,
        url: `${window.location.origin}/register?ref=${referralInfo.referralCode}`,
      }).catch(() => {});
    }
  };

  const coinValueBdt = coinBalance ? ((coinBalance.balance * coinBalance.coinValue) || 0) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Rewards & Coins</h2>
          <p className="text-sm text-gray-400">Earn coins, refer friends, and save on orders</p>
        </div>
        <Link href="/spin-wheel" className="flex items-center gap-2 bg-[#F0185A] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#c8124a] transition-colors">
          🎡 Daily Spin
        </Link>
      </div>

      <div className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl p-6 text-white mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-100 text-sm mb-1">Your Coin Balance</p>
            {balanceLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-white/60" />
            ) : (
              <>
                <p className="text-4xl font-bold">{coinBalance?.balance ?? 0}</p>
                <p className="text-sm text-amber-100 mt-1">≈ ৳{coinValueBdt.toFixed(2)} value</p>
              </>
            )}
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Coins className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-xs text-amber-100">Use coins at checkout for instant discounts</p>
          <p className="text-xs text-amber-100">1 coin = ৳{coinBalance?.coinValue ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Referrals</p>
            {referralLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <p className="font-bold text-gray-900">{referralInfo?.totalReferrals ?? 0}</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Coins from Referrals</p>
            {referralLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <p className="font-bold text-gray-900">{referralInfo?.coinsEarned ?? 0}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h3 className="font-bold text-gray-900 mb-3">Your Referral Code</h3>
        {referralLoading ? (
          <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#F0185A]" /></div>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 text-lg tracking-widest text-center">
                {referralInfo?.referralCode ?? "—"}
              </div>
              <button
                onClick={handleCopy}
                className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-sm font-medium"
              >
                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
              </button>
            </div>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={handleShare}
                className="w-full py-2.5 border border-[#F0185A] text-[#F0185A] rounded-xl text-sm font-medium hover:bg-pink-50 transition-colors flex items-center justify-center gap-2"
              >
                <Gift className="w-4 h-4" /> Share with Friends
              </button>
            )}
            <p className="text-xs text-gray-400 mt-2 text-center">
              Both you and your friend earn coins when they sign up with your code!
            </p>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h3 className="font-bold text-gray-900 mb-4">Ways to Earn Coins</h3>
        <div className="space-y-3">
          {[
            { icon: "🎡", title: "Daily Spin Wheel", desc: "Spin once per day", action: "/spin-wheel", actionLabel: "Spin Now" },
            { icon: "👥", title: "Refer a Friend", desc: "Earn coins for each referral", action: null, actionLabel: null },
            { icon: "🛍️", title: "Make a Purchase", desc: "Earn coins on every order", action: "/", actionLabel: "Shop Now" },
            { icon: "⭐", title: "Write a Review", desc: "Earn coins for product reviews", action: null, actionLabel: null },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              {item.action && (
                <Link href={item.action} className="text-xs text-[#F0185A] font-medium hover:underline flex items-center gap-0.5">
                  {item.actionLabel} <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Coin History</h3>
        {txLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#F0185A]" /></div>
        ) : (transactions as CoinTransaction[]).length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No transactions yet. Start earning coins!</div>
        ) : (
          <div className="space-y-2">
            {(transactions as CoinTransaction[]).map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.amount > 0 ? "bg-green-50" : "bg-red-50"}`}>
                  {tx.amount > 0 ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                  <p className="text-xs text-gray-400">{timeAgo(tx.createdAt)}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount} coins
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
