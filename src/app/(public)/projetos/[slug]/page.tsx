import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/src/content";
import { ProjectDetail } from "@/src/components/site/project-detail";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  return project ? { title: project.name, description: project.description } : {};
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = projects.findIndex((p) => p.slug === slug);
  if (index < 0) notFound();
  return <ProjectDetail project={projects[index]} next={projects[(index + 1) % projects.length]} />;
}
