"use client";
import Link from "next/link";
import { usePublicConfig } from "@/lib/usePublicConfig";

interface PromoCard {
  id?: string | number;
  title?: string;
  subtitle?: string;
  description?: string;
  image?: string;
  bgColor?: string;
  bgFrom?: string;
  bgTo?: string;
  link?: string;
  buttonText?: string;
  badge?: string;
}

export default function PromoCards() {
  const { data: config } = usePublicConfig();
  const promoCardsJson = config?.promoCardsJson;

  if (!promoCardsJson) return null;

  let cards: PromoCard[] = [];
  try {
    const parsed = JSON.parse(promoCardsJson);
    cards = Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }

  if (cards.length === 0) return null;

  const getGradient = (card: PromoCard) => {
    if (card.bgFrom && card.bgTo) return `linear-gradient(135deg, ${card.bgFrom}, ${card.bgTo})`;
    if (card.bgColor) return card.bgColor;
    return "linear-gradient(135deg, #F0185A, #ff6b9d)";
  };

  return (
    <div className="mt-8">
      <div className={`grid gap-4 ${cards.length === 1 ? "grid-cols-1" : cards.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
        {cards.slice(0, 6).map((card, i) => (
          <div
            key={card.id ?? i}
            className="relative rounded-2xl p-6 text-white overflow-hidden flex flex-col justify-between min-h-[140px]"
            style={{ background: getGradient(card) }}
          >
            {card.image && (
              <div
                className="absolute right-4 bottom-0 w-28 h-28 opacity-20"
                style={{ backgroundImage: `url(${card.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
            )}
            <div className="relative z-10">
              {card.badge && (
                <span className="inline-block text-xs font-semibold bg-white/30 px-2 py-0.5 rounded-full mb-2">{card.badge}</span>
              )}
              {card.title && <h3 className="text-xl font-bold mb-1">{card.title}</h3>}
              {card.subtitle && <p className="text-sm text-white/80 mb-1">{card.subtitle}</p>}
              {card.description && <p className="text-xs text-white/70">{card.description}</p>}
            </div>
            {card.link && card.buttonText && (
              <div className="relative z-10 mt-4">
                <Link
                  href={card.link}
                  className="inline-block bg-white text-gray-800 text-sm font-semibold px-5 py-2 rounded-full hover:shadow-lg transition-shadow"
                >
                  {card.buttonText}
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
