"use client";

import { useState } from "react";

interface StarRatingInputProps {
  name: string;
  defaultValue?: number;
  disabled?: boolean;
}

export function StarRatingInput({ name, defaultValue, disabled }: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState(defaultValue ?? 0);

  const displayValue = hovered ?? selected;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <label
            key={value}
            className="cursor-pointer"
            onMouseEnter={() => !disabled && setHovered(value)}
            onMouseLeave={() => !disabled && setHovered(null)}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={selected === value}
              onChange={() => setSelected(value)}
              disabled={disabled}
              required
              className="sr-only"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className={`h-8 w-8 transition-colors ${
                value <= displayValue
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-gray-300"
              }`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </label>
        ))}
      </div>
      <p className="text-sm text-gray-600">
        {selected > 0 ? `${selected} star${selected !== 1 ? "s" : ""}` : "Select rating"}
      </p>
    </div>
  );
}
