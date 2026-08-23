import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminos y Condiciones de Uso | PF24",
};

export default function TermsPage() {
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
            Términos y Condiciones de Uso
          </h1>

          <p className="mt-4 text-slate-400">
            Última actualización: Junio de 2026
          </p>

          <div className="mt-10 space-y-10 leading-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-white">1. Introducción</h2>
              <p>
                Bienvenido a PF24. Estos Términos y Condiciones regulan
                el acceso y uso de la plataforma web, servicios digitales,
                sistemas internos, paneles operativos, herramientas ATC,
                sistemas de planes de vuelo, ATIS, mensajes operativos,
                autenticación mediante Discord, paneles administrativos y demás
                funcionalidades ofrecidas por PF24.
              </p>
              <p className="mt-4">
                Al acceder, iniciar sesión o utilizar cualquier parte de la
                plataforma, el usuario declara haber leído, comprendido y
                aceptado estos Términos y Condiciones. Si el usuario no acepta
                estas condiciones, deberá abstenerse de utilizar la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">2. Definiciones</h2>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  <strong>PF24:</strong> comunidad y plataforma web
                  destinada a apoyar operaciones virtuales relacionadas con
                  Project Flight.
                </li>
                <li>
                  <strong>Usuario:</strong> persona que accede, inicia sesión o
                  utiliza la plataforma.
                </li>
                <li>
                  <strong>Discord:</strong> servicio externo utilizado para la
                  autenticación e identificación de usuarios.
                </li>
                <li>
                  <strong>Roles:</strong> permisos asignados dentro del servidor
                  de Discord que determinan el acceso a funciones de la web.
                </li>
                <li>
                  <strong>ATC:</strong> usuario autorizado para realizar funciones
                  de control de tránsito aéreo virtual dentro de la comunidad.
                </li>
                <li>
                  <strong>Plan de vuelo:</strong> registro operativo creado por
                  un piloto dentro de la plataforma.
                </li>
                <li>
                  <strong>ATIS:</strong> información operacional publicada por
                  controladores autorizados para un aeropuerto determinado.
                </li>
                <li>
                  <strong>Contact Me:</strong> mensaje enviado por un controlador
                  a un piloto para indicarle que debe contactar una dependencia
                  ATC específica.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">3. Naturaleza de la plataforma</h2>
              <p>
                PF24 es una plataforma comunitaria y operativa creada
                para facilitar la coordinación de vuelos virtuales, control ATC,
                publicación de ATIS, gestión de sesiones, registro de planes de
                vuelo y administración interna de la comunidad.
              </p>
              <p className="mt-4">
                La plataforma no tiene fines aeronáuticos reales. Toda la
                información, comunicación, control, fraseología, planes de vuelo
                y datos operativos se utilizan exclusivamente en un contexto de
                simulación, entretenimiento, organización comunitaria y gestión
                interna.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">4. Elegibilidad y acceso</h2>
              <p>
                El acceso a determinadas secciones puede requerir autenticación
                mediante Discord, pertenencia al servidor de Discord de PF24
                 y la asignación de roles específicos dentro de dicho
                servidor.
              </p>
              <p className="mt-4">
                La plataforma podrá impedir el acceso a usuarios que no formen
                parte del servidor, que no cuenten con los roles necesarios, que
                hayan sido restringidos por la administración o que representen
                un riesgo operativo, técnico o de seguridad.
              </p>
              <p className="mt-4">
                PF24 se reserva la facultad de habilitar, limitar,
                suspender o retirar accesos a módulos específicos cuando resulte
                necesario para mantener el orden, la seguridad y el correcto
                funcionamiento de la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">5. Autenticación mediante Discord</h2>
              <p>
                El inicio de sesión se realiza mediante Discord. Al iniciar
                sesión, la plataforma puede consultar información básica de la
                cuenta, incluyendo identificador de usuario, nombre de usuario,
                nombre visible y roles asociados dentro del servidor de PF24.
              </p>
              <p className="mt-4">
                Discord es un servicio externo. PF24 no controla la
                disponibilidad, funcionamiento, políticas, cambios técnicos ni
                condiciones de uso de Discord. El usuario es responsable de
                mantener segura su cuenta de Discord.
              </p>
              <p className="mt-4">
                Si la cuenta de Discord del usuario es eliminada, suspendida,
                comprometida o pierde acceso al servidor de PF24, el
                acceso a la plataforma podrá verse afectado.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">6. Roles y permisos</h2>
              <p>
                Los permisos dentro de PF24 se determinan según los roles
                del usuario en el servidor de Discord. Estos roles pueden
                habilitar o restringir funciones como acceso al Portal Piloto,
                Scope ATC, publicación de ATIS, envío de Contact Me,
                modificación de planes de vuelo, administración y mantenimiento.
              </p>
              <p className="mt-4">
                Los roles pueden modificarse, suspenderse o eliminarse en
                cualquier momento por razones operativas, disciplinarias,
                administrativas, técnicas o de seguridad. Ningún usuario tiene
                derecho adquirido sobre un rol específico.
              </p>
              <p className="mt-4">
                La plataforma puede actualizar automáticamente los permisos del
                usuario conforme cambien sus roles en Discord.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">7. Uso permitido</h2>
              <p>
                El usuario se compromete a utilizar la plataforma de forma
                responsable, honesta y conforme a las finalidades de la comunidad.
              </p>
              <p className="mt-4">Queda prohibido:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Manipular información sin autorización.</li>
                <li>Intentar acceder a áreas restringidas.</li>
                <li>Suplantar a otros usuarios, pilotos o controladores.</li>
                <li>Interferir deliberadamente con operaciones ATC.</li>
                <li>Enviar información falsa, abusiva o malintencionada.</li>
                <li>Utilizar errores o vulnerabilidades para obtener ventajas.</li>
                <li>Automatizar acciones sin autorización expresa.</li>
                <li>Alterar, explotar o sobrecargar la plataforma.</li>
                <li>Intentar evadir restricciones, roles o controles de acceso.</li>
                <li>Compartir credenciales o permitir el uso de cuentas por terceros.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">8. Planes de vuelo</h2>
              <p>
                Los pilotos pueden crear, modificar y finalizar planes de vuelo
                dentro de la plataforma, sujeto a las validaciones y reglas
                operativas establecidas por PF24.
              </p>
              <p className="mt-4">
                La información de los planes de vuelo puede incluir callsign,
                aeronave, reglas de vuelo, aeródromo de salida, aeródromo de
                llegada, ruta, nivel de vuelo, transponder, notas y estados
                operativos.
              </p>
              <p className="mt-4">
                PF24 podrá aplicar restricciones automáticas para evitar
                duplicidades, rutas inválidas, transponders no permitidos,
                vuelos simultáneos no autorizados u otros errores operativos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">9. Scope ATC</h2>
              <p>
                El Scope ATC está reservado para usuarios autorizados mediante
                roles específicos. Los controladores pueden seleccionar sectores,
                asumir tráfico, modificar información operativa, enviar Contact
                Me, publicar ATIS y realizar acciones propias de control virtual.
              </p>
              <p className="mt-4">
                Un usuario ATC es responsable de utilizar sus permisos con
                prudencia y conforme a las normas internas de la comunidad. El
                uso abusivo del Scope ATC podrá dar lugar a restricciones,
                suspensión de permisos o revisión administrativa.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">10. ATIS</h2>
              <p>
                Los ATIS publicados en la plataforma son información operativa
                virtual generada por usuarios autorizados. El sistema puede
                completar automáticamente parte de la información utilizando
                fuentes públicas de METAR, cuando estén disponibles.
              </p>
              <p className="mt-4">
                El usuario que publica un ATIS es responsable de revisar que la
                información manual ingresada sea adecuada para el contexto de la
                operación virtual. PF24 no garantiza la disponibilidad,
                exactitud o actualización permanente de fuentes externas de datos
                meteorológicos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">11. Contact Me y mensajes operativos</h2>
              <p>
                La función Contact Me permite a un controlador enviar un mensaje
                a un piloto específico para indicarle que contacte una dependencia
                ATC determinada. Estos mensajes pueden generar notificaciones
                visuales y auditivas en la interfaz del piloto.
              </p>
              <p className="mt-4">
                El uso de esta función debe limitarse a necesidades operativas
                reales dentro del entorno virtual de la comunidad.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">12. Registros de actividad</h2>
              <p>
                PF24 puede registrar eventos relevantes para seguridad,
                auditoría, administración y mantenimiento de la plataforma. Estos
                eventos pueden incluir inicios de sesión, roles detectados,
                sesiones ATC, planes de vuelo, publicaciones ATIS, mensajes
                Contact Me, finalización de vuelos, acciones administrativas y
                otros eventos operativos.
              </p>
              <p className="mt-4">
                Estos registros permiten investigar errores, resolver incidentes,
                liberar sectores bloqueados, finalizar vuelos bugueados, detectar
                accesos indebidos y mantener la estabilidad de la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">13. Administración y mantenimiento</h2>
              <p>
                Los administradores autorizados podrán realizar acciones de
                mantenimiento destinadas a preservar la continuidad operativa de
                PF24. Esto puede incluir finalizar sesiones ATC pegadas,
                liberar sectores, finalizar vuelos bugueados, revisar registros
                de inicio de sesión y corregir estados operativos.
              </p>
              <p className="mt-4">
                Las acciones administrativas deberán realizarse con criterio,
                proporcionalidad y finalidad operativa legítima.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">14. Disponibilidad del servicio</h2>
              <p>
                PF24 se proporciona según disponibilidad. No se garantiza
                funcionamiento continuo, ausencia de errores, acceso permanente o
                disponibilidad ininterrumpida.
              </p>
              <p className="mt-4">
                La plataforma podrá suspender temporalmente módulos o funciones
                por mantenimiento, actualizaciones, problemas técnicos, cambios
                de infraestructura, fallas de terceros o razones de seguridad.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">15. Servicios de terceros</h2>
              <p>
                PF24 puede depender de servicios externos como Discord,
                Supabase, Vercel, APIs públicas de información meteorológica y
                otros proveedores técnicos. La disponibilidad y funcionamiento de
                estos servicios está fuera del control directo de PF24.
              </p>
              <p className="mt-4">
                La interrupción, modificación o indisponibilidad de servicios de
                terceros puede afectar parcial o totalmente el funcionamiento de
                la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">16. Propiedad intelectual</h2>
              <p>
                El diseño, código, estructura, documentación, interfaces,
                elementos visuales, textos y componentes desarrollados para PF24
                pertenecen a sus respectivos titulares.
              </p>
              <p className="mt-4">
                Salvo autorización expresa, queda prohibida la reproducción,
                distribución, modificación, extracción, copia o reutilización de
                elementos de la plataforma con fines ajenos a la comunidad.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">17. Independencia</h2>
              <p>
                PF24 es una comunidad independiente. No está afiliada,
                respaldada, administrada ni representada oficialmente por Project
                Flight, Roblox Corporation, Discord Inc. ni por otras marcas,
                plataformas o entidades mencionadas dentro de la comunidad.
              </p>
              <p className="mt-4">
                Cualquier referencia a terceros se realiza únicamente para fines
                descriptivos, operativos o de compatibilidad comunitaria.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">18. Suspensión o terminación de acceso</h2>
              <p>
                PF24 podrá suspender, limitar o retirar el acceso de un
                usuario cuando exista incumplimiento de estos términos, abuso de
                funciones, alteración de datos, interferencia operativa, uso
                indebido de permisos, riesgos de seguridad o decisiones
                administrativas de la comunidad.
              </p>
              <p className="mt-4">
                La suspensión de acceso a la plataforma puede ser independiente
                de las medidas adoptadas dentro del servidor de Discord.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">19. Limitación de responsabilidad</h2>
              <p>
                PF24 no será responsable por pérdidas de datos,
                interrupciones, errores técnicos, indisponibilidad de servicios
                externos, fallos de red, uso incorrecto de la plataforma,
                decisiones operativas de usuarios o consecuencias derivadas del
                uso o imposibilidad de uso del sistema.
              </p>
              <p className="mt-4">
                El usuario reconoce que la plataforma se utiliza en un entorno de
                simulación y organización comunitaria, sin efectos aeronáuticos
                reales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">20. Protección de datos y privacidad</h2>
              <p>
                El tratamiento de datos personales y registros operativos se
                describe en la Política de Privacidad de PF24. El usuario
                deberá revisarla para conocer qué información se recopila, con qué
                finalidad, durante cuánto tiempo puede conservarse y qué derechos
                puede ejercer.
              </p>
              <p className="mt-4">
                El uso de la plataforma implica también la aceptación de la
                Política de Privacidad y de la Política de Cookies cuando
                corresponda.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">21. Cambios en los términos</h2>
              <p>
                PF24 podrá actualizar estos Términos y Condiciones para
                reflejar cambios técnicos, operativos, administrativos, legales o
                funcionales. La versión vigente será la publicada en esta página.
              </p>
              <p className="mt-4">
                El uso continuado de la plataforma después de una actualización
                implica la aceptación de los términos modificados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">22. Contacto</h2>
              <p>
                Las consultas relacionadas con estos Términos y Condiciones
                podrán realizarse mediante los canales oficiales de comunicación
                de PF24, especialmente a través del servidor de Discord de
                la comunidad.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
