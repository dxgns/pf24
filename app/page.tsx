import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FeatureCard from "@/components/FeatureCard";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <Navbar />
      <Hero />

      <section id="features" className="px-6 py-28">
        <div className="section-container">
          <h2 className="mb-14 text-center text-4xl font-extrabold">
            Herramientas de PF24 Español
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              title="Planes de Vuelo"
              text="Gestión completa de planes IFR, VFR, YFR y ZFR."
            />

            <FeatureCard
              title="ATIS y METAR"
              text="Información meteorológica y operacional actualizada."
            />

            <FeatureCard
              title="ATC Online"
              text="Posiciones ATC activas y operaciones en tiempo real."
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}