"use client";

interface AnimatedLogoProps {
  size?: "default" | "small";
}

export function AnimatedLogo({ size = "default" }: AnimatedLogoProps) {
  const svgSize = size === "default" ? 32 : 24;
  const textClass =
    size === "default" ? "text-xl font-bold text-gray-900" : "text-sm font-bold text-gray-900";

  return (
    <div className="flex items-center gap-1.5">
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx={10} cy={16} r={4} fill="#0ea5e9" className="animate-relay-left" />
        <circle cx={22} cy={16} r={4} fill="#6366f1" className="animate-relay-right" />
        <rect
          x={12}
          y={14}
          width={8}
          height={4}
          rx={2}
          fill="#0ea5e9"
          className="animate-relay-baton"
        />
      </svg>
      <span className={textClass}>EverySkill</span>
    </div>
  );
}
