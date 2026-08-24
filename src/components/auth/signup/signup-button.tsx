"use client";

import Link from "next/link";
import { Button } from "../../ui/button";
import { useProfile } from "@/src/hooks/use-profile";

export function AuthButtons() {
  const { data: user, isLoading } = useProfile();

  if (isLoading) {
    return null; // ou um Skeleton
  }

  if (user) {
    return (
      <p className="font-medium">
        Olá, {user.name}
      </p>
    );
  }

  return (
    <div className="flex gap-2">
      <Button asChild>
        <Link href="/signup">
          Criar conta
        </Link>
      </Button>

      <Button asChild>
        <Link href="/login">
          Entrar
        </Link>
      </Button>
    </div>
  );
}