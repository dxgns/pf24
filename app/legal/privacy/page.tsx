import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | PF24",
};

export default function PrivacyPage() {
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
            Política de Privacidad
          </h1>

          <p className="mt-4 text-slate-400">
            Última actualización: Junio de 2026
          </p>

          <div className="mt-10 space-y-10 leading-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-white">1. Introducción</h2>
              <p>
                PF24 respeta la privacidad de sus usuarios y se compromete
                a tratar la información personal de forma transparente, segura y
                proporcional a las finalidades para las cuales es recopilada.
              </p>
              <p className="mt-4">
                Esta Política de Privacidad explica qué información recopilamos,
                cómo la utilizamos, con quién puede compartirse, cuánto tiempo se
                conserva y qué derechos tienen los usuarios respecto de sus datos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">2. Responsable del tratamiento</h2>
              <p>
                PF24 actúa como responsable del tratamiento de los datos
                recopilados a través de la plataforma web y sus herramientas
                asociadas.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">3. Datos que recopilamos</h2>
              <p>Dependiendo del uso de la plataforma, podemos recopilar:</p>
              <ul className="list-disc space-y-2 pl-6 mt-4">
                <li>ID de Discord.</li>
                <li>Nombre de usuario de Discord.</li>
                <li>Nombre visible o nombre global.</li>
                <li>Roles asociados dentro del servidor de Discord.</li>
                <li>Fecha y hora de inicio de sesión.</li>
                <li>Información de planes de vuelo creados por el usuario.</li>
                <li>Información operativa ATC.</li>
                <li>ATIS publicados.</li>
                <li>Mensajes Contact Me enviados o recibidos.</li>
                <li>Registros de actividad y auditoría.</li>
                <li>Información técnica necesaria para el funcionamiento y seguridad de la plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">4. Finalidades del tratamiento</h2>
              <ul className="list-disc space-y-2 pl-6">
                <li>Autenticar usuarios mediante Discord.</li>
                <li>Determinar permisos y roles.</li>
                <li>Gestionar operaciones ATC y planes de vuelo.</li>
                <li>Mantener registros de auditoría y seguridad.</li>
                <li>Detectar accesos indebidos o comportamientos anómalos.</li>
                <li>Investigar errores técnicos o incidencias operativas.</li>
                <li>Mantener la estabilidad y continuidad de la plataforma.</li>
                <li>Desarrollar nuevas funcionalidades.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">5. Base para el tratamiento</h2>
              <p>
                El tratamiento de la información se realiza únicamente para
                permitir el funcionamiento legítimo de la plataforma, la gestión
                de la comunidad, la seguridad operativa y la prestación de los
                servicios solicitados por los usuarios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">6. Roles y autenticación</h2>
              <p>
                La plataforma utiliza Discord como proveedor de autenticación.
                Los roles del servidor pueden utilizarse para determinar los
                permisos disponibles dentro de la web.
              </p>
              <p className="mt-4">
                La pérdida o modificación de roles puede afectar el acceso a
                determinadas funcionalidades.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">7. Conservación de datos</h2>
              <p>
                Los datos se conservarán únicamente durante el tiempo necesario
                para cumplir las finalidades descritas en esta política, atender
                necesidades operativas, resolver incidencias, mantener registros
                históricos razonables y proteger la seguridad de la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">8. Compartición de información</h2>
              <p>
                PF24 no vende información personal. Los datos solo podrán
                compartirse cuando sea necesario para el funcionamiento técnico
                de la plataforma o mediante proveedores tecnológicos utilizados
                para prestar el servicio.
              </p>
              <p className="mt-4">
                Entre estos proveedores pueden encontrarse servicios de
                autenticación, alojamiento, bases de datos, infraestructura y
                herramientas necesarias para la operación de la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">9. Seguridad</h2>
              <p>
                Se implementan medidas técnicas y organizativas razonables para
                proteger la información contra accesos no autorizados,
                alteraciones, pérdidas, destrucción o divulgación indebida.
              </p>
              <p className="mt-4">
                Ningún sistema conectado a Internet puede garantizar seguridad
                absoluta, por lo que no es posible asegurar la ausencia total de
                riesgos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">10. Derechos de los usuarios</h2>
              <p>Los usuarios podrán solicitar:</p>
              <ul className="list-disc space-y-2 pl-6 mt-4">
                <li>Acceso a la información asociada a su cuenta.</li>
                <li>Rectificación de datos inexactos.</li>
                <li>Actualización de información desactualizada.</li>
                <li>Eliminación de datos cuando corresponda.</li>
                <li>Información sobre el tratamiento realizado.</li>
                <li>Limitación u oposición cuando resulte aplicable.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">11. Menores de edad</h2>
              <p>
                PF24 es una comunidad orientada a usuarios de plataformas
                de simulación y videojuegos. Cuando corresponda, los usuarios son
                responsables de cumplir los requisitos establecidos por los
                servicios externos utilizados para acceder a la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">12. Servicios externos</h2>
              <p>
                La plataforma puede depender de servicios de terceros como
                Discord, Supabase, Vercel y otros proveedores tecnológicos.
                Dichos servicios pueden contar con políticas de privacidad
                independientes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">13. Cookies</h2>
              <p>
                PF24 utiliza cookies y tecnologías similares necesarias para la
                autenticación, mantenimiento de sesión, seguridad y correcto
                funcionamiento de la plataforma.
              </p>
              <p className="mt-4">
                Información adicional se encuentra disponible en la Política de Cookies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">14. Cambios en esta política</h2>
              <p>
                Esta Política de Privacidad podrá actualizarse para reflejar
                cambios legales, técnicos, operativos o funcionales. La versión
                vigente será siempre la publicada en esta página.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">15. Contacto</h2>
              <p>
                Las consultas relacionadas con privacidad y protección de datos
                podrán realizarse mediante los canales oficiales de PF24.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
