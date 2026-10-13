import type { Metadata } from "next";
import { type ReactElement } from "react";

export const metadata: Metadata = {
  title: "Portfólio",
  description: "Projetos, observabilidade, blog e documentação da API: o portfólio em modo site.",
};

export default function HomeLayout({
  children
}: {
  children: React.ReactNode;
}): ReactElement {
  return <>{children}</>;
}
