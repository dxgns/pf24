import type { ReactNode } from "react";

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-slate-300">{children}</p>;
}

function Subheading({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-xl font-extrabold text-white">{children}</h2>;
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3 text-sm leading-7 text-slate-300">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-[2px] text-sky-300">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5">
      {title && <h3 className="mono text-xs font-bold uppercase tracking-[0.16em] text-sky-300">{title}</h3>}
      <div className={`${title ? "mt-3" : ""} text-sm leading-7 text-slate-300`}>{children}</div>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
        <thead className="bg-slate-800/90 text-slate-100">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-white/10 px-4 py-3 font-bold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-slate-950/35 text-slate-300">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-white/10 last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="align-top px-4 py-3 leading-6">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PplModuleContent20260903({ moduleNumber }: { moduleNumber: number }) {
  if (moduleNumber === 1) {
    return (
      <div className="space-y-6">
        <Paragraph>En un vuelo VFR el piloto mantiene referencias visuales con el terreno y conserva separación visual respecto de obstáculos, nubes y otras aeronaves. La navegación no consiste solamente en seguir una línea del mapa: exige saber dónde se encuentra la aeronave, hacia dónde se desplaza y qué opción existe si la ruta deja de ser segura.</Paragraph>

        <Subheading>Tres métodos que se complementan</Subheading>
        <DataTable
          headers={["Método", "Cómo funciona", "Uso correcto"]}
          rows={[
            ["Pilotaje", "Compara el terreno con la carta: costas, ciudades, rutas, ríos, lagos o montañas.", "Elegir referencias visibles y difíciles de confundir; confirmar más de una antes de cambiar la estimación."],
            ["Navegación estimada", "Relaciona el rumbo, la velocidad respecto del suelo y el tiempo transcurrido para prever la posición.", "Usar una estimación preparada y actualizarla cuando el avance real difiera de lo previsto."],
            ["VOR/DME y RNAV", "Aportan referencias de dirección, distancia o secuencia de puntos cuando están disponibles.", "Comparar la información mostrada por el simulador con la carta, la ruta autorizada y la posición visual."],
          ]}
        />

        <Subheading>Curso, rumbo y derrota</Subheading>
        <Paragraph>El curso es la dirección planificada sobre la carta. El rumbo es hacia dónde apunta el morro de la aeronave. La derrota es el recorrido real sobre el suelo. Con viento cruzado, el rumbo debe corregirse hacia el viento para que la derrota permanezca sobre el curso previsto. Por eso una aeronave puede volar con rumbo 085° y desplazarse realmente sobre un curso 090°.</Paragraph>

        <Subheading>Selección de ruta y puntos de comprobación</Subheading>
        <BulletList items={[
          "Dividir la ruta en tramos entre puntos fácilmente identificables o fixes publicados.",
          "Anotar distancia, curso, altitud prevista, tiempo estimado y frecuencia que se utilizará en cada tramo.",
          "Evitar que la ruta dependa de una sola referencia. Preparar puntos alternativos y una acción ante pérdida de posición.",
          "Comprobar la posición al alcanzar cada punto, no únicamente cuando el sistema de navegación avisa.",
        ]} />

        <Subheading>Cómo comprender el tiempo estimado</Subheading>
        <Callout title="Explicación práctica">Una ruta más larga requiere más tiempo; una velocidad respecto del suelo menor también prolonga el vuelo. Antes de salir se toma la duración estimada del plan y se divide la ruta en puntos de comprobación. En vuelo se compara la posición alcanzada con el tiempo transcurrido. Si la aeronave avanza más lento de lo previsto, se actualizan la llegada esperada y el margen de combustible.</Callout>

        <Subheading>Condiciones visuales y continuidad del vuelo</Subheading>
        <Paragraph>Las mínimas VFR y los requisitos de entrada dependen del espacio aéreo y de las reglas aplicables. Antes de despegar se consultan las cartas y normas de PF24; no debe aplicarse una cifra general a todos los aeródromos. Si disminuyen la visibilidad o el techo de nubes, la decisión segura se toma antes de perder referencias: regresar, desviarse, aterrizar en un alterno o solicitar asistencia.</Paragraph>

        <Callout title="Si se pierde la posición">Mantener el control de la aeronave, estabilizar rumbo y altitud, observar referencias amplias, comprobar la carta y los valores mostrados, estimar la última posición conocida y comunicar la situación a ATC. Subir puede mejorar alcance de radio y visión, pero solo si el terreno, el espacio aéreo y las condiciones lo permiten.</Callout>
      </div>
    );
  }

  if (moduleNumber === 2) {
    return (
      <div className="space-y-6">
        <Paragraph>La planificación transforma una intención de vuelo en una operación comprobable. Su función es detectar en tierra los problemas que serían más difíciles de resolver en el aire. Un plan completo relaciona ruta, altitud, tiempo, combustible, meteorología, capacidad de la aeronave y servicios ATC.</Paragraph>

        <Subheading>Secuencia recomendada</Subheading>
        <DataTable
          headers={["Paso", "Pregunta que debe responder"]}
          rows={[
            ["1. Aeronave", "¿La aeronave tiene autonomía, performance, navegación y equipamiento adecuados?"],
            ["2. Ruta", "¿Qué puntos, aerovías o procedimientos conectan salida y destino?"],
            ["3. Altitud o nivel", "¿Cumple terreno, espacio aéreo, reglas de niveles, performance y restricciones?"],
            ["4. Tiempo", "¿Qué viento, visibilidad, nubosidad y fenómenos se esperan durante toda la operación?"],
            ["5. Alternativa", "¿Dónde puede aterrizar si el destino no es utilizable y qué combustible requiere?"],
            ["6. Información", "¿Las cartas, frecuencias, NOTAM y datos de navegación están vigentes?"],
            ["7. Plan de vuelo", "¿Coinciden ruta, nivel, velocidad, autonomía y alterno con lo que realmente se volará?"],
          ]}
        />

        <Subheading>Tiempo y combustible</Subheading>
        <Paragraph>La duración del vuelo depende de la distancia, de la velocidad respecto del suelo y de los cambios de ruta. El viento de frente hace que la aeronave avance más lentamente y reduce el margen disponible; el viento de cola puede acortar el tiempo, pero no elimina la necesidad de conservar una reserva. En PF24 el piloto utiliza la duración y la autonomía indicadas por el planificador o el simulador, y debe entender cómo cambian durante la operación.</Paragraph>
        <DataTable
          headers={["Situación", "Efecto que debe reconocer"]}
          rows={[
            ["Mayor distancia", "Aumenta la duración prevista y el combustible necesario."],
            ["Viento de frente", "Reduce el avance sobre el suelo y consume parte del margen disponible."],
            ["Desvío o espera", "Prolonga la operación; se revisan autonomía y posibilidad de alternar."],
            ["Avance mejor al previsto", "Mejora el margen, pero la reserva continúa protegida."],
          ]}
        />
        <Callout title="Comprensión práctica">El alumno debe poder explicar si el combustible alcanza para completar la ruta, afrontar una demora, llegar al alterno y conservar la reserva. No se exige resolver operaciones matemáticas dentro de este temario; se evalúa la interpretación correcta de los valores entregados por las herramientas de PF24.</Callout>

        <Subheading>Selección de altitud</Subheading>
        <Paragraph>La altitud se elige después de revisar el terreno, los obstáculos, las capas del espacio aéreo, la dirección de vuelo, el viento, la meteorología y la performance. En IFR también se respetan las altitudes mínimas y restricciones publicadas. Una altitud cómoda para la aeronave puede ser incorrecta si invade un espacio controlado sin autorización o queda por debajo de una mínima de procedimiento.</Paragraph>

        <Subheading>Plan de vuelo en PF24</Subheading>
        <Paragraph>El plan debe representar la intención real. Como mínimo se comprueban aeródromo de salida y destino, reglas de vuelo, ruta, nivel o altitud, velocidad, tiempo estimado, autonomía, alterno y código de aeronave. Presentar un plan IFR no autoriza por sí solo a ejecutar la ruta: el piloto debe recibir y colacionar la autorización ATC.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 3) {
    return (
      <div className="space-y-6">
        <Paragraph>En la licencia PPL no se vuelve a desarrollar la lectura de informes meteorológicos. El objetivo es utilizar la información ya disponible para decidir si la salida, la ruta, el destino y el alterno continúan siendo seguros. El piloto observa especialmente viento, visibilidad, altura de nubes, fenómenos significativos y posibles cambios durante el vuelo.</Paragraph>

        <Subheading>Información que debe relacionarse</Subheading>
        <DataTable
          headers={["Dato", "Pregunta operativa"]}
          rows={[
            ["Viento", "¿La pista y la componente de viento permiten despegar y aterrizar con control?"],
            ["Visibilidad", "¿Se conservarán las referencias necesarias para la fase visual del vuelo?"],
            ["Altura de nubes", "¿Existe margen para la ruta, la llegada y una posible aproximación frustrada?"],
            ["Fenómenos", "¿Hay tormenta, lluvia intensa, turbulencia u otra condición que obligue a evitar una zona?"],
            ["Evolución", "¿Las condiciones pueden empeorar antes de la llegada o mientras se utiliza el alterno?"],
          ]}
        />

        <Subheading>Fenómenos que requieren especial atención</Subheading>
        <DataTable
          headers={["Fenómeno", "Riesgo operativo", "Decisión preventiva"]}
          rows={[
            ["CB / tormenta", "Turbulencia, lluvia intensa y cambios rápidos de viento o trayectoria.", "Evitar la zona con margen y no intentar atravesarla por confiar en una vista parcial."],
            ["Viento fuerte o cruzado", "Deriva, dificultad de control y cambios en distancia de despegue o aterrizaje.", "Comparar con limitaciones y capacidad; elegir otra pista o demorar."],
            ["Techo bajo / visibilidad", "Pérdida de referencias VFR o aproximación por debajo de mínimos.", "Preparar alterno y punto de decisión; no continuar por presión de completar el vuelo."],
            ["Turbulencia / cizalladura", "Variaciones rápidas de velocidad, trayectoria y carga de trabajo.", "Ajustar velocidad, aumentar margen y frustrar si la aproximación deja de ser estable."],
          ]}
        />

        <Subheading>Evaluación por fases</Subheading>
        <BulletList items={[
          <><strong className="text-white">Salida:</strong> viento, pista, techo, visibilidad y posibilidad de regresar.</>,
          <><strong className="text-white">Ruta:</strong> evolución de nubes, terreno, fenómenos significativos y aeródromos disponibles.</>,
          <><strong className="text-white">Destino:</strong> condiciones previstas a la hora estimada, pista utilizable y aproximación disponible.</>,
          <><strong className="text-white">Alterno:</strong> meteorología independiente y combustible suficiente para alcanzarlo.</>,
        ]} />

        <Callout title="Adaptación a Project Flight">No todos los efectos reales de la meteorología están simulados con el mismo detalle. En PF24 se evalúa que el piloto reconozca el riesgo, respete las condiciones establecidas para el escenario y tome una decisión segura, sin atribuir al simulador indicaciones o fallas que no representa.</Callout>
      </div>
    );
  }

  if (moduleNumber === 4) {
    return (
      <div className="space-y-6">
        <Paragraph>En PF24 las zonas asociadas a los aeródromos se identifican como ATZ. No se utiliza la denominación de zona de control. Sus límites y procedimientos se consultan en las cartas y normas vigentes del servidor. El piloto debe reconocer cuándo entra o sale de una ATZ, qué dependencia presta servicio y qué comunicación corresponde.</Paragraph>

        <DataTable
          headers={["Entorno", "Función práctica dentro de PF24"]}
          rows={[
            ["ATZ", "Organiza el tránsito del aeródromo, el circuito y sus proximidades según los límites publicados."],
            ["Salida de la ATZ", "La aeronave continúa con la dependencia que corresponda o aplica el procedimiento de frecuencia común."],
            ["Sector terminal", "Aproximación puede ordenar ascensos, descensos, vectores y secuencias de llegada o salida."],
            ["Sector en ruta", "Control gestiona el tránsito entre áreas terminales conforme a la cobertura disponible."],
            ["Sin dependencia activa", "El piloto mantiene separación, escucha y reportes de posición según las normas de PF24."],
          ]}
        />

        <Subheading>Dependencias y transferencia</Subheading>
        <Paragraph>Autorizaciones (DEL) entrega la autorización de ruta; Superficie (GND) ordena movimientos en tierra; Torre (TWR) gestiona pista, circuito y ATZ; Aproximación (APP) secuencia salidas y llegadas; Control o Centro (ACC) gestiona el tránsito en ruta. Cuando ATC ordena contacte, el piloto cambia de frecuencia y llama. Si indica mantenga escucha, escucha sin transmitir hasta ser llamado o necesitar comunicar algo urgente.</Paragraph>

        <Subheading>Uso sistemático de cartas</Subheading>
        <DataTable
          headers={["Carta", "Qué permite preparar", "Qué se comprueba"]}
          rows={[
            ["ADC / aeródromo", "Rodaje, pista y estacionamiento", "Calles, puntos de espera, elevación, frecuencias y restricciones"],
            ["ENR", "Ruta VFR o IFR", "ATZ, puntos, aerovías, distancias, rumbos y niveles mínimos"],
            ["SID", "Salida instrumental", "Pista, transición, trayectoria, gradiente y restricciones"],
            ["STAR", "Llegada instrumental", "Transición, ruta, altitudes, velocidades y enlace con aproximación"],
            ["IAC", "Aproximación instrumental", "Trayectoria final, altitudes, mínimos y frustrada"],
          ]}
        />

        <Callout title="Orden de lectura">1) Confirmar aeropuerto, pista, nombre y vigencia. 2) Leer notas y equipamiento requerido. 3) Seguir la trayectoria desde la transición hasta el final. 4) Marcar restricciones de altitud y velocidad. 5) Preparar frecuencias, mínimos y alternativa. 6) Explicar en voz alta qué se hará si ATC modifica el procedimiento.</Callout>
      </div>
    );
  }

  if (moduleNumber === 5) {
    return (
      <div className="space-y-6">
        <Paragraph>Bajo IFR la trayectoria se mantiene mediante los datos disponibles en Project Flight, los procedimientos publicados y las autorizaciones ATC. El simulador no representa una cabina completa, por lo que el piloto trabaja con los valores e indicaciones que realmente aparecen: altitud, velocidad, rumbo, posición y ruta cuando estén disponibles. El objetivo es detectar una desviación y corregirla antes de que se vuelva grande.</Paragraph>

        <Subheading>Ciclo de control adaptado al simulador</Subheading>
        <DataTable
          headers={["Etapa", "Acción"]}
          rows={[
            ["Objetivo", "Tener claro qué altitud, velocidad, rumbo o punto debe mantenerse."],
            ["Lectura", "Comprobar los valores que muestra Project Flight y compararlos con la autorización."],
            ["Trayectoria", "Confirmar que la posición y la ruta conducen al punto o procedimiento correcto."],
            ["Corrección", "Aplicar un cambio pequeño, observar el resultado y volver a comprobar."],
          ]}
        />

        <Subheading>Autorización IFR</Subheading>
        <Paragraph>Una autorización establece el límite autorizado, la ruta, la altitud o nivel inicial y otros datos como salida, frecuencia o transpondedor. Debe compararse con el plan y con las cartas. Si algo no puede cumplirse o no se entiende, se responde incapaz o se solicita aclaración antes de iniciar el movimiento.</Paragraph>

        <Callout title="Principio esencial">Haber cargado una SID, STAR o aproximación en el FMS no significa estar autorizado a volarla. La autorización ATC y la carta determinan lo que corresponde; el FMS es una herramienta para ejecutarlo y debe verificarse tramo por tramo.</Callout>

        <Subheading>Altimetría: QNH, QNE, TA y TL</Subheading>
        <Paragraph>Project Flight muestra la altitud como un valor numérico y no dispone de un ajuste de presión convencional. El QNH y la referencia estándar se estudian para comprender la información y la fraseología. Por debajo de la altitud de transición (TA) la posición vertical se comunica como altitud en pies; por encima del nivel de transición (TL) se comunica como nivel de vuelo.</Paragraph>
        <Paragraph>El piloto no debe buscar una perilla de presión ni un selector que el simulador no ofrece. Debe mantener el valor autorizado y expresarlo correctamente: por debajo de la transición, por ejemplo tres mil pies; cuando corresponde utilizar niveles, por ejemplo nivel de vuelo cero nueve cero.</Paragraph>

        <Subheading>Vectores radar y directos</Subheading>
        <Paragraph>Un vector es un rumbo asignado por ATC. Se colaciona y se mantiene usando el valor de rumbo mostrado por Project Flight hasta recibir otra instrucción. Un directo autoriza a navegar hacia un punto concreto: antes de aceptarlo se comprueba que el punto correcto figure en la ruta y que la aeronave pueda cumplir.</Paragraph>

        <Subheading>Espera publicada o asignada</Subheading>
        <Paragraph>Una espera mantiene la aeronave alrededor de un fijo mientras ATC regula el tránsito. Deben conocerse fijo, curso de acercamiento, sentido de virajes, altitud, velocidad y tiempo o distancia de los tramos. El piloto prepara la entrada y estima combustible; si la demora compromete la reserva, informa a ATC.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 6) {
    return (
      <div className="space-y-6">
        <Paragraph>Las referencias VOR/DME y los sistemas RNAV ayudan a comprender o comprobar una trayectoria sin depender únicamente de referencias visuales. En PF24 se estudia su objetivo operativo y se utilizan solo las indicaciones que Project Flight representa de forma funcional. No se presupone la existencia de controles o instrumentos de una cabina real.</Paragraph>

        <DataTable
          headers={["Sistema", "Idea principal", "Aplicación dentro de PF24"]}
          rows={[
            ["VOR", "Referencia direccional publicada vinculada a una estación.", "Reconocer su función en una ruta o carta y relacionarla con el rumbo y la posición que muestra el simulador."],
            ["DME", "Referencia de distancia respecto de una estación o punto asociado.", "Utilizar el valor de distancia cuando esté disponible y compararlo con la ruta y el siguiente punto."],
            ["GNSS / RNAV", "Navegación entre puntos definidos por coordenadas.", "Comprobar el punto activo, el orden de la ruta y que cada directo coincida con la autorización."],
            ["RNP", "Procedimiento RNAV con un requisito concreto de precisión.", "Volarlo únicamente cuando el procedimiento esté disponible y admitido para la operación en PF24."],
            ["ILS", "Referencia de alineación y descenso para una aproximación instrumental.", "Seguir la guía que el simulador realmente muestre junto con la carta, los mínimos y las instrucciones ATC."],
          ]}
        />

        <Subheading>Uso práctico de una referencia VOR</Subheading>
        <BulletList items={[
          "Identificar en la carta o en la ruta qué referencia se utilizará y para qué tramo sirve.",
          "Relacionar esa referencia con la posición, el rumbo y el siguiente punto del plan.",
          "Mantener la trayectoria mediante los valores que Project Flight muestre de forma efectiva.",
          "Si la referencia no está disponible o no puede seguirse, informar a ATC y solicitar una alternativa.",
        ]} />

        <Callout title="Límite de la explicación">No se exige sintonizar receptores, interpretar agujas o identificaciones propias de instrumentos que Project Flight no ofrece, ni reproducir controles de una cabina real. Se evalúa comprender la finalidad de la referencia y utilizar correctamente los datos disponibles.</Callout>

        <Subheading>ILS dentro de Project Flight</Subheading>
        <Paragraph>El objetivo es llegar alineado con la pista y mantener un descenso estable dentro del procedimiento autorizado. El piloto utiliza únicamente la guía que aparezca en el simulador y la relaciona con altitud, rumbo, velocidad, mínimos y posición. Si la guía no está disponible, resulta dudosa o la aproximación deja de ser estable, no se inventa una indicación: se informa a ATC y se solicita otra aproximación, vectores o se ejecuta una frustrada.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 7) {
    return (
      <div className="space-y-6">
        <Subheading>SID y salida inicial</Subheading>
        <Paragraph>Una SID conecta la pista con la ruta mediante una secuencia publicada. Puede incluir puntos, rumbos y restricciones de altitud o velocidad. Antes de despegar se confirma la pista, la primera acción, la altitud inicial y el orden de los puntos. No se evalúa la manipulación de un sistema específico que no esté representado en Project Flight.</Paragraph>

        <Subheading>STAR y preparación de la llegada</Subheading>
        <Paragraph>Una STAR conduce desde la fase en ruta hacia la aproximación. La preparación comienza antes del descenso: se revisan la pista probable, el orden de los puntos, las restricciones, la aproximación esperada, las condiciones y el margen de combustible. Una restricción escrita en la carta debe distinguirse como obligatoria, mínima, máxima o esperada según su simbología.</Paragraph>

        <Callout title="Restricciones">Cruzar un punto a 5.000 ft exige esa altitud; a/o por encima de 5.000 ft permite mayor altitud; a/o por debajo de 5.000 ft permite menor altitud si ninguna otra mínima lo impide. Cuando ATC asigna una instrucción diferente, se aclara qué restricciones permanecen vigentes.</Callout>

        <Subheading>Estructura de una aproximación instrumental</Subheading>
        <DataTable
          headers={["Parte", "Función operativa"]}
          rows={[
            ["Inicio", "Punto desde el que se ingresa al procedimiento autorizado."],
            ["Tramo intermedio", "Ordena la trayectoria y permite preparar la configuración antes del descenso final."],
            ["Tramo final", "Conduce hacia la pista siguiendo los puntos, altitudes y guía disponibles."],
            ["Mínimos", "Límite en el que se decide continuar únicamente con referencias suficientes o frustrar."],
            ["Frustrada", "Trayectoria prevista para volver a ascender y alejarse de la pista con seguridad."],
          ]}
        />

        <Subheading>Tipos principales</Subheading>
        <BulletList items={[
          <><strong className="text-white">ILS:</strong> aproximación que busca mantener alineación y descenso mediante la guía disponible.</>,
          <><strong className="text-white">RNAV/RNP:</strong> trayectoria definida por puntos de navegación de área y restricciones publicadas.</>,
          <><strong className="text-white">Visual:</strong> ATC autoriza continuar con referencias visuales; el piloto conserva responsabilidad por terreno y trayectoria visual.</>,
          <><strong className="text-white">Circling:</strong> maniobra visual posterior a una aproximación instrumental para aterrizar en una pista distinta; exige mantener referencias y permanecer en el área protegida.</>,
        ]} />

        <Callout title="Aplicación en el simulador">Las cartas explican la trayectoria y los límites, pero el alumno solo utiliza los controles e indicaciones que Project Flight tenga disponibles. No debe simular mentalmente agujas, receptores o paneles inexistentes.</Callout>
      </div>
    );
  }

  if (moduleNumber === 8) {
    return (
      <div className="space-y-6">
        <Paragraph>Una aproximación estable permite dedicar la atención a pequeñas correcciones. Antes del tramo final deben estar preparados la trayectoria, los mínimos, la altitud de frustrada, la primera acción y la configuración prevista. Durante el descenso se vigilan los datos que Project Flight realmente muestra, especialmente velocidad, altitud, rumbo, posición y alineación con la pista.</Paragraph>

        <Subheading>Indicadores de estabilidad</Subheading>
        <BulletList items={[
          "Aeronave alineada con la trayectoria prevista y con correcciones pequeñas.",
          "Velocidad y altitud cercanas a los valores previstos para la fase.",
          "Configuración de aterrizaje completa en el punto definido por el procedimiento o la técnica utilizada.",
          "Descenso progresivo y controlado, sin cambios bruscos para alcanzar la pista.",
          "Lista de aterrizaje completada y autorización o estado de pista comprendido.",
        ]} />
        <Paragraph>Si la aproximación se vuelve inestable, si se supera un límite o si en mínimos no existen referencias suficientes, la respuesta correcta es frustrar. La maniobra no representa un fallo: es una decisión prevista y debe estar preparada antes de alcanzar mínimos.</Paragraph>

        <Subheading>Secuencia general de aproximación frustrada</Subheading>
        <DataTable
          headers={["Prioridad", "Acción"]}
          rows={[
            ["1. Volar", "Aplicar potencia, controlar actitud, detener el descenso y configurar de acuerdo con la aeronave."],
            ["2. Navegar", "Seguir el procedimiento publicado o la instrucción ATC; comprobar altitud y primer rumbo/punto."],
            ["3. Comunicar", "Informar la frustrada cuando la carga de trabajo lo permita y colacionar nuevas instrucciones."],
          ]}
        />

        <Callout title="Antes de iniciar">El piloto debe poder decir en una frase: “En mínimos, si no continúo, ascenderé a..., viraré hacia..., navegaré hasta... y esperaré/continuaré según la carta”. Si no puede explicarlo, todavía no terminó de preparar la aproximación.</Callout>

        <Subheading>Aterrizaje y liberación de pista</Subheading>
        <Paragraph>Después del aterrizaje la operación continúa. Se mantiene control direccional, se libera por una calle segura sin apresurarse y se cruza la línea de espera completa antes de notificar pista libre. Los cambios de frecuencia, luces y configuración se realizan cuando la aeronave está controlada y fuera de la pista.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 9) {
    return (
      <div className="space-y-6">
        <Paragraph>La fraseología reduce ambigüedad. Una transmisión eficaz contiene únicamente lo necesario, en el orden que ayuda al controlador: dependencia, indicativo, posición o situación y solicitud. Antes de transmitir se escucha la frecuencia y se prepara mentalmente el mensaje.</Paragraph>

        <Subheading>Datos que requieren especial atención</Subheading>
        <Paragraph>Se colacionan con precisión autorizaciones de ruta, pista, punto de espera, altitud o nivel, rumbo, velocidad, frecuencia y código transpondedor. La colación no es repetir de memoria: es demostrar que el piloto comprendió lo que ejecutará. Si un número no se entendió, se solicita repetición; nunca se completa por suposición.</Paragraph>

        <DataTable
          headers={["Situación", "Ejemplo de piloto", "Respuesta ATC posible"]}
          rows={[
            ["Autorización IFR", "Santiago autorizaciones, LV-ART, puesto 3, IFR a Punta Cana, listo a copiar.", "LV-ART, autorizado a Punta Cana según plan, mantenga 4.000 pies, transpondedor 4213."],
            ["Rodaje", "Santiago superficie, LV-ART, listo para rodar.", "LV-ART, ruede al punto de espera pista 11 vía Alfa, mantenga antes de pista 11."],
            ["Salida", "Santiago torre, LV-ART, punto de espera pista 11, listo.", "LV-ART, autorizado a despegar pista 11, viento 120 grados 8 nudos."],
            ["En ruta", "Santo Domingo control, LV-ART, nivel de vuelo 090, directo LATER.", "LV-ART, identificado, continúe directo LATER."],
            ["Descenso", "LV-ART dejando nivel 090 para 4.000 pies.", "LV-ART, correcto, reduzca 180 nudos y espere aproximación asignada."],
            ["Aproximación", "Punta Cana aproximación, LV-ART, 4.000 pies, listo para aproximación.", "LV-ART, autorizado a la aproximación asignada, notifique establecido."],
          ]}
        />

        <Subheading>Ejemplo de colación de autorización</Subheading>
        <Callout><p><strong className="text-white">ATC:</strong> LV-ART, autorizado a Punta Cana según plan, mantenga 4.000 pies, transpondedor 4213.</p><p className="mt-2"><strong className="text-white">Piloto:</strong> Autorizado a Punta Cana según plan, mantengo 4.000 pies, transpondedor 4213, LV-ART.</p></Callout>
        <Paragraph>Si la carta muestra una restricción que la aeronave no puede cumplir, el piloto debe avisarlo antes de aceptar. Si ATC modifica una ruta cargada, se verifica que el nuevo punto aparezca en el orden correcto y no produzca un viraje inesperado.</Paragraph>

        <Subheading>Incapacidad y aclaración</Subheading>
        <BulletList items={[
          <><strong className="text-white">Incapaz por performance:</strong> cuando la aeronave no puede cumplir velocidad, ascenso o altitud solicitada.</>,
          <><strong className="text-white">Solicito repetición:</strong> cuando el mensaje no se recibió completo.</>,
          <><strong className="text-white">Confirme:</strong> cuando se recibió un dato, pero existe duda razonable sobre su interpretación.</>,
          <><strong className="text-white">Solicito vectores:</strong> cuando se necesita guía radar y el servicio está disponible.</>,
        ]} />
      </div>
    );
  }

  if (moduleNumber === 10) {
    return (
      <div className="space-y-6">
        <Subheading>Pérdida de comunicaciones</Subheading>
        <Paragraph>Ante una aparente pérdida de radio se comprueban el volumen, el canal o frecuencia seleccionada, el dispositivo de entrada y salida y la conexión utilizada para voz. Luego se intenta la frecuencia anterior, una alternativa publicada o el medio de comunicación admitido por PF24. Si el procedimiento del servidor lo contempla, se selecciona el código transpondedor correspondiente y se continúa de forma previsible conforme a la autorización, las cartas y las normas vigentes.</Paragraph>

        <Callout title="Prioridad">Una falla de comunicación no justifica abandonar el control de la aeronave. Primero se vuela, después se mantiene una trayectoria segura y finalmente se resuelve o comunica el problema.</Callout>

        <Subheading>Urgencia y emergencia</Subheading>
        <Paragraph>MAYDAY se reserva para peligro grave e inminente que requiere asistencia inmediata. PAN PAN comunica una situación urgente que afecta la seguridad, pero que no constituye todavía un peligro grave e inminente. El mensaje debe incluir indicativo, naturaleza del problema, intención, posición, altitud y cualquier asistencia necesaria, sin retrasar las acciones de control de la aeronave.</Paragraph>

        <Subheading>Factores humanos</Subheading>
        <Paragraph>La fatiga, el estrés, la presión por completar el vuelo y la sobrecarga reducen la capacidad de detectar errores. En simulación también aparecen por exceso de tareas, desconocimiento de la aeronave o automatización mal configurada. Una conducta profesional consiste en disminuir carga de trabajo: estabilizar, usar una espera si está disponible, pedir demora o vectores, y revisar la situación antes de continuar.</Paragraph>

        <DataTable
          headers={["DECIDE", "Aplicación"]}
          rows={[
            ["Detectar", "Reconocer el cambio: meteorología, combustible, tráfico, fallo o desviación."],
            ["Estimar", "Valorar cuánto afecta la seguridad y cuánto tiempo existe para actuar."],
            ["Elegir", "Definir el resultado seguro que se busca: regresar, alternar, estabilizar o aterrizar."],
            ["Identificar", "Comparar opciones y seleccionar una acción concreta."],
            ["Hacer", "Ejecutar la decisión y comunicarla."],
            ["Evaluar", "Comprobar si la acción resolvió el problema o exige un nuevo ciclo."],
          ]}
        />

        <Subheading>Gestión de ayudas del simulador</Subheading>
        <BulletList items={[
          "Comprobar qué función o valor se encuentra realmente activo antes de confiar en él.",
          "Comparar la trayectoria mostrada con la autorización y la carta, no solo con una línea de ruta.",
          "Si una ayuda produce una trayectoria inesperada, estabilizar la aeronave y volver a un control comprendido.",
          "No cambiar configuraciones durante una fase crítica si ello impide vigilar la aeronave.",
        ]} />
      </div>
    );
  }

  if (moduleNumber === 11) {
    return (
      <div className="space-y-6">
        <Paragraph>Para obtener la licencia PPL en PF24, el piloto debe aprobar una evaluación teórica y demostrar en un vuelo supervisado que puede integrar los conocimientos. No basta con memorizar definiciones: se evalúa la capacidad de explicar una decisión y aplicar el procedimiento correcto mientras mantiene el control de la aeronave.</Paragraph>

        <Subheading>Áreas de evaluación teórica</Subheading>
        <BulletList items={[
          "Navegación VFR, comprensión de la duración, autonomía y selección de ruta.",
          "Interpretación de NOTAM, ATIS y condiciones relevantes para salida, ruta, destino y alterno.",
          "Lectura de cartas de aeródromo, ruta, SID, STAR y aproximación.",
          "Altimetría, autorizaciones, vectores, VOR/DME, RNAV/RNP y mínimos según su aplicación en PF24.",
          "Fraseología, colación, pérdida de comunicaciones, emergencia y toma de decisiones.",
        ]} />

        <Subheading>Perfil sugerido del vuelo práctico</Subheading>
        <DataTable
          headers={["Fase", "Competencia observable"]}
          rows={[
            ["Preparación", "Explica ruta, duración, autonomía, condiciones, alterno, cartas y amenazas."],
            ["Salida", "Configura navegación, colaciona autorización y ejecuta rodaje/despegue sin invadir pista."],
            ["En ruta", "Mantiene trayectoria y nivel, actualiza estimados y responde correctamente a ATC."],
            ["Llegada", "Prepara STAR/aproximación, cumple restricciones y anticipa la frustrada."],
            ["Aproximación", "Mantiene estabilidad, respeta mínimos y aterriza o frustra con criterio."],
            ["Situación anormal", "Prioriza volar, navegar y comunicar; toma una decisión previsible y segura."],
          ]}
        />

        <Callout title="Estándar final">El piloto habilitado debe poder completar una operación de principio a fin sin depender de indicaciones paso a paso del instructor. Puede solicitar ayuda o aclaración cuando corresponde, pero conserva conciencia de la aeronave, la ruta, la autorización y la siguiente acción.</Callout>

        <Subheading>Referencias técnicas utilizadas para esta actualización</Subheading>
        <BulletList items={[
          "Temario Oficial PE - PF24 Piloto Estudiante.",
          "Normas operativas y de comunicaciones vigentes de PF24.",
          "Cartas y procedimientos utilizados dentro del servidor.",
          "Funciones efectivamente disponibles en Project Flight.",
        ]} />
      </div>
    );
  }

  return null;
}
