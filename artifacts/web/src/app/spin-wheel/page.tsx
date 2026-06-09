"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Coins, Gift, Clock, ChevronRight, Loader2, Star } from "lucide-react";
import {
  useGetSpinStatus, useSpinWheel, useGetCoinBalance,
  getGetSpinStatusQueryKey, getGetCoinBalanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const PRIZES = [
  { label: "50 Coins", color: "#F0185A", coins: 50 },
  { label: "10 Coins", color: "#F59E0B", coins: 10 },
  { label: "100 Coins", color: "#10B981", coins: 100 },
  { label: "20 Coins", color: "#3B82F6", coins: 20 },
  { label: "200 Coins", color: "#8B5CF6", coins: 200 },
  { label: "5 Coins", color: "#EC4899", coins: 5 },
  { label: "75 Coins", color: "#EF4444", coins: 75 },
  { label: "30 Coins", color: "#14B8A6", coins: 30 },
];

const SEGMENT_COUNT = PRIZES.length;
const ANGLE_PER_SEGMENT = 360 / SEGMENT_COUNT;

function formatCountdown(nextSpinAt: string) {
  const diff = new Date(nextSpinAt).getTime() - Date.now();
  if (diff <= 0) return "Available now!";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export default function SpinWheelPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ prize: string; coinsWon: number; discountCode?: string | null } | null>(null);
  const [countdown, setCountdown] = useState("");
  const wheelRef = useRef<HTMLDivElement>(null);

  const { data: spinStatus, isLoading: statusLoading } = useGetSpinStatus({
    query: { queryKey: getGetSpinStatusQueryKey(), enabled: isAuthenticated },
  });
  const { data: coinBalance } = useGetCoinBalance({
    query: { queryKey: getGetCoinBalanceQueryKey(), enabled: isAuthenticated },
  });
  const spinMutation = useSpinWheel();

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      router.push("/login?returnTo=/spin-wheel");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!spinStatus?.canSpin && spinStatus?.nextSpinAt) {
      const interval = setInterval(() => {
        setCountdown(formatCountdown(spinStatus.nextSpinAt!));
      }, 1000);
      setCountdown(formatCountdown(spinStatus.nextSpinAt));
      return () => clearInterval(interval);
    }
  }, [spinStatus]);

  const handleSpin = async () => {
    if (!spinStatus?.canSpin || spinning) return;
    setSpinning(true);
    setResult(null);
    try {
      const res = await spinMutation.mutateAsync();
      const extraSpins = 5 + Math.floor(Math.random() * 5);
      const prizeIndex = PRIZES.findIndex(p => p.coins === res.coinsWon) ?? 0;
      const targetAngle = 360 * extraSpins + (SEGMENT_COUNT - prizeIndex) * ANGLE_PER_SEGMENT - ANGLE_PER_SEGMENT / 2;
      setRotation(prev => prev + targetAngle);
      setTimeout(() => {
        setSpinning(false);
        setResult(res);
        queryClient.invalidateQueries({ queryKey: getGetSpinStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCoinBalanceQueryKey() });
      }, 4500);
    } catch {
      setSpinning(false);
    }
  };

  if (authLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#F0185A] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#F0185A]">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/account/referrals" className="hover:text-[#F0185A]">Rewards</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-800 font-medium">Spin Wheel</span>
      </nav>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Daily Spin Wheel</h1>
        <p className="text-sm text-gray-500">Spin once daily to win coins and discounts!</p>
      </div>

      {coinBalance && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-amber-700">Current Balance</p>
              <p className="font-bold text-amber-900 text-lg">{coinBalance.balance} Coins</p>
            </div>
          </div>
          <Link href="/account/referrals" className="text-xs text-amber-700 hover:underline flex items-center gap-1">
            View History <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 p-8 flex flex-col items-center">
        <div className="relative mb-8">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-gray-900" />
          </div>
          <div
            ref={wheelRef}
            className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-gray-900 shadow-2xl"
            style={{
              transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {PRIZES.map((prize, i) => {
              const angle = i * ANGLE_PER_SEGMENT;
              return (
                <div
                  key={i}
                  className="absolute inset-0 flex items-center justify-center origin-center"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `conic-gradient(${prize.color} 0deg, ${prize.color} ${ANGLE_PER_SEGMENT}deg, transparent ${ANGLE_PER_SEGMENT}deg)`,
                    }}
                  />
                  <span
                    className="absolute text-xs font-bold text-white drop-shadow"
                    style={{
                      transform: `rotate(${ANGLE_PER_SEGMENT / 2}deg) translateY(-80px)`,
                    }}
                  >
                    {prize.label}
                  </span>
                </div>
              );
            })}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-white rounded-full border-4 border-gray-900 flex items-center justify-center shadow-inner">
                <Star className="w-5 h-5 text-[#F0185A]" />
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="w-full mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl text-center">
            <p className="text-lg font-bold text-green-700">🎉 You won {result.prize}!</p>
            <p className="text-sm text-green-600">+{result.coinsWon} coins added to your balance</p>
            {result.discountCode && (
              <p className="text-sm text-green-700 font-medium mt-1">
                Discount Code: <span className="font-bold tracking-wider">{result.discountCode}</span>
              </p>
            )}
          </div>
        )}

        {spinStatus?.canSpin ? (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="px-10 py-3.5 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-pink-300 text-white font-bold rounded-2xl text-lg transition-colors flex items-center gap-2 shadow-lg"
          >
            {spinning ? <><Loader2 className="w-5 h-5 animate-spin" /> Spinning...</> : "🎡 SPIN NOW"}
          </button>
        ) : (
          <div className="text-center">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Next spin available in:</span>
            </div>
            <p className="text-2xl font-bold text-[#F0185A] font-mono">{countdown}</p>
            <p className="text-xs text-gray-400 mt-2">Come back tomorrow for your daily spin!</p>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-3 text-sm">How It Works</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2"><span className="text-[#F0185A] font-bold flex-shrink-0">1.</span> Spin once every 24 hours for free</div>
          <div className="flex items-start gap-2"><span className="text-[#F0185A] font-bold flex-shrink-0">2.</span> Win coins and use them at checkout</div>
          <div className="flex items-start gap-2"><span className="text-[#F0185A] font-bold flex-shrink-0">3.</span> Earn more coins by referring friends</div>
          <div className="flex items-start gap-2"><span className="text-[#F0185A] font-bold flex-shrink-0">4.</span> <Link href="/account/referrals" className="text-[#F0185A] hover:underline">View your coins and referrals →</Link></div>
        </div>
      </div>
    </div>
  );
}
