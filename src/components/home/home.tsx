import { AboutSection } from "../site/about-section";
import { ApiSection } from "../site/api-section";
import { BlogSection } from "../site/blog-section";
import { ContactSection } from "../site/contact-section";
import { IntroSection } from "../site/intro-section";
import { ObservabilitySection } from "../site/observability-section";
import { ProjectsSection } from "../site/projects-section";
import { SiteFooter } from "../site/site-footer";
import { SiteNav } from "../site/site-nav";

// Modo site: o mesmo conteúdo da cidade do jogo, em seções. A ordem segue SITE_SECTIONS.
export function HomePage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <IntroSection />
        <AboutSection />
        <ProjectsSection />
        <ObservabilitySection />
        <BlogSection />
        <ApiSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
