interface AnimatedLogoProps {
  size?: "default" | "small";
  variant?: "light" | "dark";
}

export function AnimatedLogo({ size = "default", variant = "light" }: AnimatedLogoProps) {
  const height = size === "default" ? 48 : 30;
  const src = variant === "dark" ? "/everyskill-logo-dark.svg" : "/everyskill-logo.svg";

  return <img src={src} alt="EverySkill" height={height} style={{ height, width: "auto" }} />;
}
