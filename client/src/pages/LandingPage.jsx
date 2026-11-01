import PublicNavbar from '../components/layout/PublicNavbar.jsx';
import PublicFooter from '../components/layout/PublicFooter.jsx';
import Hero from '../components/landing/Hero.jsx';
import ToolsShowcase from '../components/landing/ToolsShowcase.jsx';
import Pricing from '../components/landing/Pricing.jsx';
import Testimonials from '../components/landing/Testimonials.jsx';
import HowItWorks from '../components/landing/HowItWorks.jsx';
import FAQ from '../components/landing/FAQ.jsx';
import CTA from '../components/landing/CTA.jsx';

/** The public marketing landing page, showcasing all AI tools with high visual appeal. */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      <PublicNavbar />
      <main>
        <Hero />
        <ToolsShowcase />
        <Pricing />
        <Testimonials />
        <HowItWorks />
        <FAQ />
        <CTA />
      </main>
      <PublicFooter />
    </div>
  );
}
