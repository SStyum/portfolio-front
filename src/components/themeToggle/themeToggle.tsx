"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/src/hooks/use-mounted";
import { Button } from "../ui/button";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const mounted = useMounted();
    const dark = !mounted || resolvedTheme === "dark";

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
            onClick={() => setTheme(dark ? "light" : "dark")}
        >
            {dark ? <Sun /> : <Moon />}
        </Button>
    );
}
