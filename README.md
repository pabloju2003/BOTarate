# BOTarate

Extensión de Chrome que añade **roles pedagógicos basados en IA** a [eGela](https://egela.ehu.eus/) (el Moodle de la UPV/EHU) para ayudar a los alumnos a aprender xQuery. Pone un chat lateral en las páginas del curso. Desde ahí el alumno puede pedir explicaciones de los ejercicios, enviar sus soluciones para que se evalúen o refinar un borrador de forma iterativa. El profesor decide, ejercicio a ejercicio, qué tipo de ayuda da la IA.

---

## Contexto académico

- **Tipo de trabajo:** Trabajo de Fin de Grado (TFG)
- **Universidad:** Universidad del País Vasco / Euskal Herriko Unibertsitatea (UPV/EHU)
- **Director:** Óscar Díaz García
- **Autores:** Iñigo Alzugaray y Pablo Jurado (pabloju2003)

---

## Funcionalidades

### Roles pedagógicos por ejercicio

Cada ejercicio tiene un **rol de IA** (`AIRole`, definido en `src/types/shared.ts`) que decide qué puede hacer la IA con él. Si un ejercicio no tiene rol asignado, se usa `tutor`. Las restricciones se aplican en `src/background/handlers/agentHandlers.ts` y también se le explican al modelo en el prompt de `CourseAgent`.

| Rol | ¿Explica? | ¿Evalúa la solución? | Comportamiento |
|---|---|---|---|
| `observer` | No | No | La IA no está disponible para ese ejercicio. |
| `proofreader` | No | Solo sintaxis | Revisa únicamente errores de sintaxis de la solución (`EvaluationAgent.evaluateSyntaxOnly`). |
| `tutor` | Sí | Sí | Modo normal: explica el ejercicio y evalúa la solución con nota y feedback. |
| `challenger` | Sí | Sí | Las explicaciones incluyen **errores intencionados** que el alumno debe detectar. Al alumno no se le avisa de ello. |
| `refiner` | No | No (solo borradores) | El alumno envía borradores híbridos, código xQuery con comentarios `(: … :)` en las partes que aún no ha implementado. La IA le dice si va por buen camino sin darle la solución (ver `refiner-spec.md`). |

El profesor asigna los roles desde la pestaña **Config** de la barra lateral (`src/components/ExerciseConfigTab/`). Puede asignarlos uno a uno o a varios ejercicios a la vez.

### Agentes de IA

Todos están en `src/util/ai/` y heredan de `BaseAgent.ts`. `BaseAgent` monta los prompts a partir de plantillas, añade la instrucción de idioma y la personalización del profesor, y limita qué herramientas puede usar cada agente.

| Agente | Fichero | Qué hace |
|---|---|---|
| Chat del curso | `CourseAgent.ts` | Conversa con el usuario sobre el curso. Cuando le preguntan por un ejercicio, llama a la herramienta adecuada según el rol (`explainExercise`, `solveExercise`, `refineExercise`) en vez de responder directamente. |
| Identificación de ejercicios | `ExerciseAgent.ts` | Analiza una página de laboratorio de eGela y extrae los ejercicios, el contexto, los conceptos y los objetivos de aprendizaje. El resultado se guarda en `chrome.storage.local`. |
| Explicación | `ExplanationAgent.ts` | Genera la explicación paso a paso de un ejercicio (roles `tutor` y `challenger`) y permite hacer preguntas de seguimiento. |
| Evaluación | `EvaluationAgent.ts` | Evalúa la solución del alumno con una nota y feedback. Para el rol `proofreader` solo revisa la sintaxis. |
| Refinamiento | `RefinerAgent.ts` | Gestiona la sesión iterativa de borradores del rol `refiner`. |

Las herramientas que puede invocar el modelo se definen en `Tools.ts` y se implementan en `ToolFunctions.ts`: leer secciones, páginas, recursos y ficheros del curso, y analizar imágenes con un modelo de visión. Los esquemas de las respuestas estructuradas están en `schemas.ts`.

El texto de los prompts se puede adaptar a la asignatura desde **Opciones → Agentes**: rol, criterios de evaluación, metodología, nombre del profesor y sus muletillas, etc. Los campos disponibles están en `AgentConfig.ts`.

### Modo profesor y modo alumno

- La extensión comprueba si el usuario es profesor del curso consultando la lista de participantes de eGela (`checkTeacherStatus` en `src/util/egela/common.ts`). El resultado se guarda en caché por curso.
- **Modo profesor**: en la barra lateral aparecen las pestañas **Labs** (verbosidad y esfuerzo de razonamiento de cada laboratorio) y **Config** (roles de los ejercicios).
- **Modo alumno**: aparecen las pestañas **Ejercicios** (explicaciones y evaluaciones guardadas) y **Progreso**.
- Un profesor puede cambiar a vista de alumno en un curso sin que eso afecte a los demás cursos (`ModeManager.ts`).

### Otras funcionalidades

- **Idiomas:** inglés, castellano y euskera (`src/i18n/locales/`). El idioma elegido se aplica a la interfaz y también a las respuestas del modelo.
- **Importar/Exportar:** el profesor exporta la configuración de un curso (config de agentes, ejercicios, laboratorios y progreso) a un fichero `BOTarate-<curso>-config.json` ofuscado (ver Limitaciones), que después importan los alumnos (`ImportExportManager.ts`). Este fichero **no incluye las claves de API**.
- **Lectura de PDFs** del curso con `unpdf` (`src/util/pdf/PdfExtractor.ts`).

---

## Arquitectura

```
┌──────────────────────────── Chrome ────────────────────────────┐
│                                                                │
│  eGela (egela.ehu.eus)                                         │
│  └─ Content script (src/content/content.tsx)                   │
│       └─ FloatingButton + ChatSidebar (React)                  │
│              │  chrome.runtime.sendMessage                     │
│              ▼                                                 │
│  Service worker (src/background/background.ts)                 │
│   ├─ handlers/agentHandlers   → agentes de IA                  │
│   ├─ handlers/dataHandlers    → datos de curso/ejercicios      │
│   ├─ handlers/storageHandlers → chrome.storage + rol profesor  │
│   └─ handlers/configHandlers  → proveedor/modelo               │
│              │                        │                        │
│              ▼                        ▼                        │
│  src/util/ai/* (agentes)      src/util/egela/* (fetch+parseo)  │
│              │                                                 │
│  Popup (idioma)   ·   Página de Opciones (LLM, Agentes, I/E)   │
└──────────────┼─────────────────────────────────────────────────┘
               ▼
   API compatible con OpenAI (OpenAI, Anthropic, Google, Groq u OpenRouter)
```

| Ruta | Contenido |
|---|---|
| `public/manifest.json` | Manifest V3: permisos, service worker, popup, opciones y content script (solo en `https://egela.ehu.eus/*`). |
| `src/background/` | Service worker y handlers de mensajes. `context.ts` inicializa los agentes. |
| `src/content/` | Script que se inyecta en eGela y monta la UI de React. |
| `src/components/` | Componentes de React: barra lateral, pestañas, modales de explicación, solución y refiner, etc. |
| `src/popup/`, `src/options/` | Popup de la extensión y página de opciones. |
| `src/util/ai/` | Agentes, herramientas, lista de modelos y cliente LLM (`OpenAIService.ts`). |
| `src/util/egela/` | Obtención y parseo del HTML de eGela: curso, secciones, páginas, ficheros y rol del usuario. |
| `src/util/config/` | `ConfigManager` (proveedor, modelo, claves) y `ModeManager` (profesor/alumno). |
| `src/util/storage/` | Gestores de `chrome.storage.local` para cada tipo de dato. |
| `src/util/progress/` | Cálculo del progreso del alumno. |
| `src/i18n/` | Traducciones (en/es/eu) y la instrucción de idioma para el LLM. |
| `samples/` | HTML de ejemplo de páginas de eGela, útil para probar el parser. |
| `refiner-spec.md` | Especificación de diseño del rol Refiner. |

**Cliente LLM:** `OpenAIService.ts` usa el SDK oficial `openai` con `dangerouslyAllowBrowser: true` y cambia su `baseURL` según el proveedor elegido. Las llamadas se hacen con `chat.completions.create`. Por eso todos los proveedores se usan a través de su endpoint compatible con OpenAI. Las URLs base están en `src/util/config/ConfigManager.ts`.

---

## Requisitos previos

- **Node.js** ≥ 20.19 o ≥ 22.12 (requisito de Vite 7), y **npm**. Probado con v24.13.0.
- **Google Chrome** o un navegador basado en Chromium con soporte de Manifest V3. En `.vscode/launch.json` también hay una configuración para Brave.
- Una **cuenta de eGela** con acceso a un curso.
- Una **clave de API** de al menos uno de los proveedores soportados.

---

## Instalación y compilación

```bash
git clone <url-del-repositorio>
cd BOTarate
npm install
```

**Build de producción** (genera `dist/`):

```bash
npm run build
```

**Desarrollo** (servidor de Vite en el puerto 5173 con `@crxjs/vite-plugin`):

```bash
npm run dev
```

Con `npm run dev`, el plugin escribe la extensión en `dist/` y muestra el aviso `CRXJS: Load dist as unpacked extension`. Se carga igual que en el siguiente apartado. Ese `dist/` es un build de desarrollo; antes de distribuir la extensión, genera de nuevo el de producción con `npm run build`.

En VS Code están configuradas las tareas `npm: build` y `npm: dev` (`.vscode/tasks.json`). También hay configuraciones de depuración que abren eGela en Chrome o Brave (`.vscode/launch.json`).

---

## Cargar la extensión en Chrome

1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `dist/` del proyecto.
4. Entra en `https://egela.ehu.eus/`. Debería aparecer el botón flotante de BOTarate.

Cada vez que hagas `npm run build`, pulsa el botón de recargar de la extensión en `chrome://extensions` y recarga la pestaña de eGela.

---

## Configuración

### Proveedor, modelo y clave de API (lo normal)

1. Haz clic derecho en el icono de la extensión y elige **Opciones**, o pulsa el enlace del popup.
2. En la pestaña **LLM**, elige proveedor, modelo de texto y modelo de visión, e introduce la clave de API.
3. Guarda. La configuración se guarda en `chrome.storage.local` (clave `config`).

Los modelos disponibles están en `src/util/ai/ModelList.ts`. Para añadir uno, hay que incluirlo en `MODEL_LIST` e indicar qué admite (texto, visión, verbosidad, razonamiento).

Mientras no haya una clave y un modelo seleccionados, la barra lateral avisa de que falta la configuración del LLM. Además, en modo alumno hay que haber importado la configuración del profesor (config de agentes y datos de ejercicios o laboratorios) para poder usar la extensión. Esto se comprueba en `handleCheckConfiguration`, dentro de `src/background/handlers/configHandlers.ts`.

### Variables de entorno (solo desarrollo)

Opcionalmente, puedes precargar las claves copiando `.env.example` a `.env`:

| Variable | Proveedor |
|---|---|
| `VITE_OPENAI_API_KEY` | OpenAI |
| `VITE_ANTHROPIC_API_KEY` | Anthropic |
| `VITE_GOOGLE_API_KEY` | Google (Gemini) |
| `VITE_GROQ_API_KEY` | Groq |
| `VITE_OPENROUTER_API_KEY` | OpenRouter |

Formato: `NOMBRE=valor`, una por línea, sin comillas. Las que no uses se dejan vacías.

> ⚠️ **Importante**
> - Vite **incrusta las variables `VITE_*` en el bundle compilado**. Cualquiera que tenga el `dist/` puede leerlas. Úsalas solo en desarrollo y nunca distribuyas un build hecho con claves en `.env`.
> - **Nunca hagas commit de `.env` ni de `dist/`.** Los dos están en `.gitignore`.
> - Los valores de `.env` son solo los iniciales. Si ya hay una configuración guardada en `chrome.storage.local`, sus claves (aunque estén vacías) sustituyen a las de `.env` (`ConfigManager.loadConfig`).

### Opciones de desarrollo

En los builds de desarrollo (`import.meta.env.DEV`), la página de Opciones tiene una sección extra para **forzar el rol de profesor**. Sirve para probar el modo profesor sin ser profesor en eGela.

---

## Uso: flujo básico en eGela

### Profesor

1. Configura el LLM en **Opciones → LLM**.
2. Opcionalmente, adapta los prompts a la asignatura en **Opciones → Agentes**.
3. Entra en el curso en eGela y abre una página de laboratorio. La extensión detecta los ejercicios con `ExerciseAgent`; la primera vez llama al LLM y después los lee del almacenamiento.
4. En la barra lateral:
   - **Labs**: ajusta la verbosidad y el esfuerzo de razonamiento de cada laboratorio.
   - **Config**: asigna a cada ejercicio un rol (`observer`, `proofreader`, `tutor`, `challenger`, `refiner`).
5. En **Opciones → Importar/Exportar**, exporta la configuración del curso y pásales el `.json` a los alumnos.

### Alumno

1. Configura el LLM con su propia clave en **Opciones → LLM**.
2. Importa el `.json` del profesor, desde **Opciones → Importar/Exportar** o desde el aviso de la barra lateral.
3. En una página de laboratorio, abre el chat y pide, por ejemplo:
   - «explícame el ejercicio 3», que abre la explicación (roles `tutor` y `challenger`);
   - «quiero enviar mi solución del ejercicio 3», que abre el formulario de evaluación;
   - «refinar el ejercicio 5», que abre la interfaz de borradores (rol `refiner`).
4. Consulta las explicaciones y evaluaciones guardadas en **Ejercicios**, y su avance en **Progreso**.

---

## Cómo verificar que funciona

**El proyecto no tiene tests automáticos:** no hay script `test` en `package.json` ni ficheros de test. La verificación es manual:

1. `npm run build` termina sin errores.
2. La extensión se carga en `chrome://extensions` sin errores. Revisa también el enlace "service worker" para ver la consola del background.
3. En Opciones → LLM, al seleccionar un proveedor con clave válida se carga la lista de modelos (`getModelList`).
4. En una página de laboratorio de eGela se identifican los ejercicios y el chat responde.
5. Prueba cada rol en un ejercicio. Con el modo de desarrollo puedes forzar el rol de profesor para asignarlos.

Los logs de agentes y handlers salen por consola con prefijos como `[identifyExercises]`, `[checkTeacherStatus]` o `[REQUEST]`.

---

## Limitaciones conocidas

- **Sin tests automáticos.** Ver el apartado anterior.
- **Mapeo de roles antiguos incoherente.** Los ejercicios guardados con los flags antiguos (`allowed`, `isPicky`) se traducen de forma distinta según dónde se lean:
  - `src/util/storage/ExerciseStorageManager.ts:12-25` (y también `dataHandlers.ts`, `ChatSidebar.ts` y `content.tsx`): `allowed === false` → `observer`, `isPicky === true` → `challenger`.
  - `src/util/ai/ExerciseAgent.ts:195-197`: `allowed === false` → `challenger`, `isPicky === true` → `proofreader`.

  Un ejercicio antiguo puede cambiar de rol cuando se vuelve a identificar la página. Hay que unificarlo.
- **Restos de versiones anteriores (SQL / "Moodlia").** El proyecto empezó orientado a SQL y quedan referencias:
  - la clave i18n `placeholderSQL` («Escribe tu consulta SQL aquí…») en `SolutionModal.tsx` y en `src/i18n/locales/*.json`;
  - ejemplos con SQL en las descripciones de `src/util/ai/schemas.ts` y `src/util/ai/Tools.ts`, y marcadores `name.sql` en los prompts de `ExplanationAgent.ts` y `RefinerAgent.ts`;
  - el ejemplo de errores del rol challenger en las traducciones habla de «sintaxis SQL»;
  - `package.json` conserva datos de plantilla (`"name": "chrome-extension-vite"`, `"author": "Your Name"`).
- **Configuración de progreso sin conectar.** El componente `src/components/ProgressConfigTab/` (nota mínima y porcentaje de ejercicios challenger) no se usa desde ningún otro componente. `ProgressConfigStorageManager` solo se usa en importar/exportar, así que los umbrales no se aplican en el cálculo del progreso.
- **Claves en el navegador.** El SDK de OpenAI se usa con `dangerouslyAllowBrowser: true` y cada usuario pone su propia clave. No hay backend intermedio.
- **El fichero exportado está ofuscado, no protegido.** El `.json` de configuración se cifra con AES, pero la clave es fija y está en el código fuente (`ImportExportManager.ts`). Cualquiera con acceso al repositorio o al bundle puede descifrarlo. Es **ofuscación, no seguridad real**: solo evita que se lea o edite a mano sin querer.
- **Dependencia del HTML de eGela.** La detección de ejercicios y del rol de profesor depende de la estructura HTML de eGela (IDs de celdas en la lista de participantes, clases del dashboard, etc.). Si eGela cambia, puede dejar de funcionar.
- **Permisos amplios.** `host_permissions` en `public/manifest.json` incluye `http://*/*` y `https://*/*`, aunque el content script solo se inyecta en eGela. Ver trabajo futuro.

## Posibles líneas de trabajo futuro

- Añadir tests (unitarios del parser de eGela usando `samples/`, y de la lógica de roles).
- Unificar el mapeo de roles antiguos y eliminar los restos de SQL.
- Conectar la configuración de progreso con el cálculo del progreso.
- Estudiar un backend o proxy para no tener que distribuir claves de API a los alumnos.
- Restringir `host_permissions` a `https://egela.ehu.eus/*` y a los dominios de los proveedores de IA que aparecen en `ConfigManager.ts` (`api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.groq.com`, `openrouter.ai`).

---

## Créditos y autoría

- **Iñigo Alzugaray**: autor del proyecto base.
- **Pablo Jurado (pabloju2003)**: rol Refiner (`src/util/ai/RefinerAgent.ts`, `src/components/RefinerModal/`, `refiner-spec.md`) y parte del sistema de roles pedagógicos.
- **Director:** Óscar Díaz García (UPV/EHU).

---

## Licencia

Este proyecto se distribuye bajo la **licencia MIT**. Ver el fichero [LICENSE](LICENSE).
