interface AnimatedLogoProps {
  size?: "default" | "small";
  variant?: "light" | "dark";
}

export function AnimatedLogo({ size = "default" }: AnimatedLogoProps) {
  const height = size === "default" ? 48 : 30;

  return (
    <img
      src="/everyskill-logo-new.png"
      alt="EverySkill"
      height={height}
      style={{ height, width: "auto" }}
    />
  );
}
