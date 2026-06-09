import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number) {
  return `৳${price.toLocaleString("en-BD")}`;
}

export function formatDiscount(original: number, sale: number) {
  return Math.round(((original - sale) / original) * 100);
}
