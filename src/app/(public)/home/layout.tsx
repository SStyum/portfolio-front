import type { Metadata } from "next";
import { type ReactElement } from "react";

export const metadata: Metadata = {
  title: "Home | Engineering Playground",
  description: "Home Page | Playground de Engenheiros"
};

export default function AuthLayout({
  children
}: {
  children: React.ReactNode;
}): ReactElement {
  return <>{children}</>;
}