"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useEffect, useMemo, useState } from "react";

export function ModeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (theme === "dark" || theme === "light") {
      setResolvedTheme(theme);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolvedTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);

  const nextTheme = useMemo(() => (resolvedTheme === "dark" ? "light" : "dark"), [resolvedTheme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      className={`relative rounded-full h-8 w-8 ${className ?? ""}`}
    >
      {resolvedTheme === "dark" ? (
        <Moon
          className="h-[1.2rem] w-[1.2rem] transition-transform duration-200"
          fill="currentColor"
          stroke="currentColor"
        />
      ) : (
        <Sun
          className="h-[1.2rem] w-[1.2rem] transition-transform duration-200"
          fill="currentColor"
          stroke="currentColor"
        />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
