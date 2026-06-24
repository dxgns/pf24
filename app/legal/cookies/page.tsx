import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Cookies | PF24",
};

export default function CookiesPage() {
  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-5xl">
        <div className="panel rounded-3xl p-8 md:p-12">
          <Link
            href="/"
            className="inline-flex rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
          >
            ← Inicio
          </Link>

          <h1 className="mt-8 text-5xl font-extrabold">
            Política de Cookies
          </h1>

          <p className="mt-4 text-slate-400">
            Última actualización: Junio de 2026
          </p>

          <div className="mt-10 space-y-10 leading-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-white">1. Introducción</h2>
              <p>
                Esta Política de Cookies explica cómo PF24 utiliza
                cookies y tecnologías similares dentro de su plataforma web.
              </p>
              <p className="mt-4">
                Las cookies permiten que determinadas funciones técnicas de la
                plataforma operen correctamente, especialmente aquellas
                relacionadas con autenticación, seguridad, sesiones de usuario y
                funcionamiento interno.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">2. Qué son las cookies</h2>
              <p>
                Las cookies son pequeños archivos o identificadores que pueden
                almacenarse en el navegador del usuario cuando visita un sitio
                web. Estas permiten recordar información necesaria para el
                funcionamiento de determinadas funciones.
              </p>
              <p className="mt-4">
                También pueden existir tecnologías similares, como almacenamiento
                local del navegador, tokens de sesión o identificadores técnicos
                utilizados para mantener activa una sesión o recordar una
                preferencia.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">3. Cookies utilizadas por PF24</h2>
              <p>
                PF24 utiliza principalmente cookies estrictamente
                necesarias para el funcionamiento de la plataforma.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>Cookies de autenticación mediante Discord.</li>
                <li>Cookies necesarias para mantener la sesión iniciada.</li>
                <li>Cookies de seguridad asociadas al flujo de inicio de sesión.</li>
                <li>Cookies técnicas necesarias para el funcionamiento de NextAuth.</li>
                <li>Preferencias locales necesarias para recordar avisos o estados básicos de la interfaz.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">4. Finalidad de las cookies</h2>
              <p>Las cookies y tecnologías similares pueden utilizarse para:</p>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>Permitir el inicio de sesión mediante Discord.</li>
                <li>Mantener la sesión activa durante el uso de la plataforma.</li>
                <li>Proteger el flujo de autenticación.</li>
                <li>Verificar el estado de acceso del usuario.</li>
                <li>Recordar que el usuario ya visualizó el aviso de cookies.</li>
                <li>Mejorar la estabilidad y seguridad de la plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">5. Cookies estrictamente necesarias</h2>
              <p>
                Las cookies estrictamente necesarias permiten que PF24 funcione
                correctamente. Sin ellas, la plataforma no podría autenticar
                usuarios, mantener sesiones iniciadas, verificar permisos o
                proteger determinadas operaciones.
              </p>
              <p className="mt-4">
                Por su naturaleza técnica y funcional, estas cookies no requieren
                un mecanismo de rechazo dentro de la plataforma, ya que su
                desactivación impediría el uso normal de los servicios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">6. Cookies de análisis, publicidad o marketing</h2>
              <p>
                Actualmente PF24 no utiliza cookies con fines de
                publicidad, marketing, seguimiento comercial, elaboración de
                perfiles publicitarios ni medición analítica avanzada mediante
                herramientas externas.
              </p>
              <p className="mt-4">
                Si en el futuro se incorporan herramientas de análisis,
                estadísticas avanzadas, publicidad o servicios similares, esta
                Política de Cookies será actualizada y se implementarán los
                mecanismos de información o consentimiento que correspondan.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">7. Almacenamiento local</h2>
              <p>
                Algunas funciones de PF24 pueden utilizar almacenamiento local
                del navegador para recordar configuraciones básicas o estados de
                interfaz. Por ejemplo, puede utilizarse para recordar que el
                usuario ya ha visto un aviso informativo o para conservar estados
                técnicos temporales necesarios para la experiencia de uso.
              </p>
              <p className="mt-4">
                Este almacenamiento no se utiliza para publicidad ni seguimiento
                comercial.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">8. Servicios de terceros</h2>
              <p>
                PF24 utiliza servicios externos necesarios para su operación, como
                Discord para autenticación y proveedores de infraestructura para
                alojamiento y base de datos. Estos servicios pueden utilizar sus
                propias cookies o mecanismos técnicos conforme a sus respectivas
                políticas.
              </p>
              <p className="mt-4">
                PF24 no controla directamente las cookies establecidas por
                servicios externos fuera del dominio o infraestructura de la
                plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">9. Gestión desde el navegador</h2>
              <p>
                El usuario puede configurar su navegador para bloquear, eliminar
                o limitar el uso de cookies. Sin embargo, bloquear cookies
                necesarias puede provocar que PF24 no funcione correctamente o
                que el usuario no pueda iniciar sesión.
              </p>
              <p className="mt-4">
                La configuración de cookies depende del navegador utilizado por
                el usuario.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">10. Aviso de cookies</h2>
              <p>
                PF24 puede mostrar un aviso informativo indicando que utiliza
                cookies necesarias para autenticación, seguridad y funcionamiento
                de la plataforma.
              </p>
              <p className="mt-4">
                Al continuar utilizando la plataforma, el usuario reconoce el uso
                de estas cookies necesarias conforme a esta Política de Cookies y
                a la Política de Privacidad.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">11. Cambios en esta política</h2>
              <p>
                PF24 podrá actualizar esta Política de Cookies cuando se
                incorporen nuevas tecnologías, servicios externos, funcionalidades
                o cambios relevantes en la forma de uso de cookies.
              </p>
              <p className="mt-4">
                La versión vigente será siempre la publicada en esta página.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">12. Contacto</h2>
              <p>
                Las consultas relacionadas con esta Política de Cookies podrán
                realizarse mediante los canales oficiales de PF24.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
