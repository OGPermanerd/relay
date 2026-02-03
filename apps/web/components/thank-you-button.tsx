"use client";

import { useState } from "react";

interface ThankYouButtonProps {
  userId: string;
  userName: string;
}

export function ThankYouButton({ userId: _userId, userName }: ThankYouButtonProps) {
  const [hasThanked, setHasThanked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleThankYou = () => {
    if (hasThanked) return;

    setIsAnimating(true);
    setHasThanked(true);

    // Reset animation state after animation completes
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <button
      type="button"
      onClick={handleThankYou}
      disabled={hasThanked}
      className={`
        flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
        ${
          hasThanked
            ? "bg-green-100 text-green-700 cursor-default"
            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
        }
        ${isAnimating ? "scale-110" : "scale-100"}
      `}
    >
      <span className={`transition-transform ${isAnimating ? "animate-bounce" : ""}`}>
        {hasThanked ? "🙏" : "👏"}
      </span>
      <span>{hasThanked ? `Thanks sent to ${userName.split(" ")[0]}!` : "Say Thanks"}</span>
    </button>
  );
}
