import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function calculateHandValue(hand: any[], wildRank: string | null) {
  return hand.reduce((total, card) => {
    if (card.rank === 'Joker' || card.rank === wildRank) return total;
    return total + card.value;
  }, 0);
}
