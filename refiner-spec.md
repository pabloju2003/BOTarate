# Refiner Role — Implementación Completa

## Contexto del proyecto

BOTarate es una extensión de Chrome educativa que integra IA en Egela (Moodle, UPV/EHU). Tiene dos modos: profesor (configura ejercicios) y alumno (recibe ayuda de la IA). Cada ejercicio tiene un "rol de IA" que determina cómo se comporta la IA con ese ejercicio.

**Roles existentes (4):** Observer, Proofreader, Tutor, Challenger.
**Nuevo rol a implementar: Refiner** (5º rol).

## Qué es el Refiner

El Refiner es un modo pedagógico donde el alumno NO recibe una explicación generada por la IA, ni envía una solución final para evaluación. En su lugar:

1. El alumno escribe un **borrador híbrido**: mezcla de código xQuery con comentarios en lenguaje natural `(: descripción :)` describiendo las partes que aún no ha implementado.
2. La IA **evalúa si el borrador va en la dirección correcta**, sin dar la respuesta.
3. El alumno **refina iterativamente** su borrador basándose en el feedback.

La IA NUNCA da la solución completa. Solo indica: "esto está bien, continúa" o "esto está mal" (sin corregirlo).

## Prompt de referencia del tutor (Óscar)

Óscar probó este prompt en ChatGPT como modelo de cómo debe comportarse la IA:

```
Behave as an SQL expert. I will provide you with an SQL draft, i.e., 
an SQL expression with comments embedded. Comments are in English. 
Your task is to assess the extent this first draft is on the right 
direction to fulfil the query. The database schema is that of the 
uploaded file. Next I will provide you with pair: query, SQL draft. 
Your task is to assess the extent the SQL draft is on the right path 
w.r.t. query
```

Adaptaremos esto a xQuery pero manteniendo la misma filosofía genérica (la asignatura se configura vía AgentConfig).

## Arquitectura actual — Archivos clave

```
src/
├── types/shared.ts                          → AIRole type, Exercise, interfaces
├── background/
│   ├── background.ts                        → Message router (switch/case por action)
│   ├── context.ts                           → Instanciación de agentes
│   └── handlers/
│       ├── agentHandlers.ts                 → Handlers de explicación, evaluación, chat
│       └── storageHandlers.ts               → Handlers de storage (roles, config)
├── util/ai/
│   ├── AgentConfig.ts                       → Interface de configuración por asignatura
│   ├── BaseAgent.ts                         → Clase base de agentes
│   ├── ExplanationAgent.ts                  → Agente de explicaciones (referencia)
│   ├── EvaluationAgent.ts                   → Agente de evaluaciones (referencia)
│   ├── OpenAIService.ts                     → Servicio de LLM
│   ├── schemas.ts                           → JSON schemas para structured output
│   └── Tools.ts                             → Definiciones de tools
├── components/
│   ├── ExerciseConfigTab/                   → UI profesor: radio buttons de roles
│   │   ├── ExerciseConfigTab.tsx            → Tabla con radio buttons
│   │   ├── types.ts                         → ExerciseRoleConfig, props
│   │   └── utils.ts                         → buildConfigMap, computePendingChanges
│   ├── ExerciseModal/                       → Modal de explicación (Tutor/Challenger)
│   │   └── ExerciseModal.tsx                → Layout: explicación izq + chat der
│   ├── SolutionModal/                       → Modal de evaluación (textarea + submit)
│   ├── ChatSidebar/
│   │   ├── ChatSidebar.ts                   → Hook principal del sidebar
│   │   ├── ChatSidebar.tsx                  → UI del sidebar
│   │   └── tabs/ExercisesTab.tsx            → Lista de ejercicios con badges/botones
│   └── BaseModal/                           → Modal reutilizable
└── content/content.tsx                      → Punto de entrada, renderiza modales
```

## Plan de cambios — Paso a paso

### FASE 1: Tipos y configuración (cambios quirúrgicos)

#### 1.1 `src/types/shared.ts`
Añadir `'refiner'` al tipo `AIRole`:
```typescript
export type AIRole = "observer" | "proofreader" | "tutor" | "challenger" | "refiner";
```

#### 1.2 `src/util/ai/AgentConfig.ts`
Añadir sección opcional `refinerAgent` a la interfaz `AgentConfig`:
```typescript
refinerAgent?: {
    role: string;
    taskDescription: string;
    evaluationGuidelines: string;
    importantNotes?: string;
};
```

#### 1.3 `src/content/content.tsx`
Actualizar la interfaz local `Exercise` (línea ~22) que tiene los roles hardcodeados:
```typescript
interface Exercise {
    name: string;
    statement: string;
    role?: 'observer' | 'proofreader' | 'tutor' | 'challenger' | 'refiner';
}
```

#### 1.4 `src/components/ChatSidebar/tabs/ExercisesTab.tsx`
Igual, actualizar la interfaz local `Exercise` (línea ~8):
```typescript
interface Exercise {
    name: string;
    statement: string;
    role?: 'observer' | 'proofreader' | 'tutor' | 'challenger' | 'refiner';
}
```

### FASE 2: Backend — RefinerAgent + handlers

#### 2.1 Nuevo archivo: `src/util/ai/RefinerAgent.ts`

Crear un agente nuevo que extienda `BaseAgent`. Puntos clave:

- Usa las mismas tools que `ExplanationAgent`: `getPageContent`, `getFilteredFileContent`, `analyzeImage`
- **NO usa structured output** (no JSON schema). Las respuestas del Refiner son texto libre (Markdown), lo que evita el problema de `maxTokens` cortando JSON.
- Usa `processResponseWithTools` para el flujo conversacional (igual que `continueConversation` en ExplanationAgent).
- Mantiene historial de conversación entre turnos (el alumno envía borrador → IA responde → alumno refina → IA responde).

**Métodos principales:**

```typescript
class RefinerAgent extends BaseAgent {
    
    // Inicia una nueva sesión de refinamiento para un ejercicio
    async startSession(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        pageId?: string,
        responseOptions?: ResponseOptions
    ): Promise<void>
    
    // Envía un borrador del alumno y recibe feedback
    async evaluateDraft(studentDraft: string): Promise<string>
    
    // Envía una pregunta de seguimiento (sin borrador nuevo)
    async sendFollowUp(message: string): Promise<string>
    
    // Restaura una sesión desde storage (para continuar donde lo dejó)
    async restoreSession(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        chatHistory?: Array<{role: string; content: string}>,
        pageId?: string
    ): Promise<void>
}
```

**System prompt del Refiner** (construido en `buildRefinerSystemPrompt`):

```
You are an expert tutor helping students design solutions incrementally. Specifically: {role}.

Your task is {taskDescription}

THE REFINER PROCESS:
The student will send you drafts of their solution. These drafts mix:
- Actual code fragments (partial implementation)
- Comments in natural language describing parts they haven't implemented yet

YOUR RULES:
1. NEVER provide the complete solution or write code for the student.
2. If the draft is on the right track, acknowledge what's correct and encourage them to continue.
3. If something is wrong, indicate WHAT is wrong but do NOT fix it for them.
4. If the overall approach/structure is wrong, guide them toward the right approach without giving it away.
5. Be concise: 3-5 sentences per response.
6. Focus on logical structure and approach, not syntax details.
7. When the student's draft is nearly complete and correct, congratulate them and confirm they can finalize it.

{evaluationGuidelines}

PEDAGOGICAL CONTEXT:
{conceptsContext}
{objectivesContext}

{teacherPersonalization}

{responseLengthConstraints}
```

El user prompt cuando el alumno envía un borrador:

```
Exercise: {exerciseName}

{exerciseStatement}

{exerciseContext ? `Context:\n${exerciseContext}` : ''}

--- STUDENT DRAFT ---
{studentDraft}
--- END DRAFT ---

Assess if this draft is on the right direction to solve the exercise. Remember: do NOT provide the solution.
```

Para turnos siguientes (re-envíos de borrador), el user prompt es más simple:

```
--- UPDATED DRAFT ---
{studentDraft}  
--- END DRAFT ---

Assess my updated draft. What improved? What still needs work?
```

Para preguntas de follow-up (sin borrador nuevo), se envía el mensaje directamente como en `continueConversation`.

#### 2.2 `src/background/context.ts`
Añadir:
```typescript
import { RefinerAgent } from "../util/ai/RefinerAgent";

let refinerAgent: RefinerAgent;

// En initializeAgents():
refinerAgent = new RefinerAgent(agentsConfig);

// Nueva función:
export function getRefinerAgent(): RefinerAgent { ... }
```

#### 2.3 `src/background/handlers/agentHandlers.ts`
Añadir 3 nuevos handlers:

```typescript
// Inicia sesión de refiner y envía primer borrador
export function handleStartRefinerSession(request, sendResponse): boolean
// request: { exerciseName, pageId, courseId, studentDraft }
// 1. Lee exercise data del storage
// 2. Verifica role === 'refiner'
// 3. Llama refinerAgent.startSession(...)
// 4. Llama refinerAgent.evaluateDraft(studentDraft)
// 5. Devuelve { success: true, feedback: string }

// Envía un borrador actualizado en sesión existente
export function handleRefinerDraft(request, sendResponse): boolean
// request: { exerciseName, pageId, courseId, studentDraft, chatHistory }
// 1. Restaura contexto si necesario (como restoreExplanationContext)
// 2. Llama refinerAgent.evaluateDraft(studentDraft)
// 3. Devuelve { success: true, feedback: string }

// Envía pregunta de follow-up sin borrador
export function handleRefinerFollowUp(request, sendResponse): boolean
// request: { message, exerciseName, pageId, courseId, chatHistory }
// 1. Restaura contexto si necesario
// 2. Llama refinerAgent.sendFollowUp(message)
// 3. Devuelve { success: true, response: string }
```

**IMPORTANTE sobre restauración de contexto:** Seguir el mismo patrón que `handleSendExplanationChatMessage` — siempre restaurar el contexto completo antes de cada llamada, porque el service worker puede haberse reiniciado entre turnos. Usar `chatHistory` del request para restaurar.

#### 2.4 `src/background/background.ts`
Añadir en el switch de `processMessage`:
```typescript
case "startRefinerSession":
    return handleStartRefinerSession(request, sendResponse);
case "refinerDraft":
    return handleRefinerDraft(request, sendResponse);
case "refinerFollowUp":
    return handleRefinerFollowUp(request, sendResponse);
```

### FASE 3: UI del profesor

#### 3.1 `src/components/ExerciseConfigTab/ExerciseConfigTab.tsx`
Añadir 5ª columna al array `roleColumns`:
```typescript
const roleColumns: Array<{ role: AIRole; label: string }> = [
    { role: "observer", label: "Observer" },
    { role: "proofreader", label: "Proofreader" },
    { role: "tutor", label: "Tutor" },
    { role: "challenger", label: "Challenger" },
    { role: "refiner", label: "Refiner" },
];
```

Ajustar anchos de columna (de 44%/14% a ~39%/~12%).

Actualizar el bloque informativo `<ul>` con la descripción del Refiner:
```html
<li><strong>Refiner:</strong> el alumno envía borradores progresivos y la IA evalúa si va en la dirección correcta, sin dar la respuesta.</li>
```

### FASE 4: UI del alumno — RefinerModal (componente nuevo)

#### 4.1 Nuevo directorio: `src/components/RefinerModal/`

Crear:
- `RefinerModal.tsx` — componente principal
- `hooks.ts` — hook `useRefinerModal`
- `types.ts` — props interface
- `index.ts` — export

**Layout del RefinerModal:**

```
┌──────────────────────────────────────────────────────────────────┐
│  BaseModal: exercise.name                                       │
├────────────────────────────────┬─────────────────────────────────┤
│  Panel izquierdo (flex: 1)     │  Panel derecho (width: 40%)     │
│                                │                                 │
│  Enunciado del ejercicio       │  💬 Feedback y conversación     │
│  (card bg-light, Markdown)     │                                 │
│                                │  [Mensajes scrollables]         │
│  📝 Tu borrador               │  - Borrador 1 (user, colapsado) │
│  ┌────────────────────────┐    │  - Feedback 1 (assistant)       │
│  │ textarea monospace     │    │  - Borrador 2 (user, colapsado) │
│  │ (el alumno escribe     │    │  - Feedback 2 (assistant)       │
│  │  aquí su borrador)     │    │  - ...                          │
│  │                        │    │                                 │
│  └────────────────────────┘    │  [Loading spinner si esperando] │
│                                │                                 │
│  [Enviar borrador 📤]         │  ── Pregunta adicional ──       │
│                                │  ┌─────────────────────────┐    │
│                                │  │ textarea pequeño        │    │
│                                │  └─────────────────────────┘    │
│                                │  [Enviar pregunta 📨]           │
└────────────────────────────────┴─────────────────────────────────┘
```

**Comportamiento:**

1. Al abrir el modal (primera vez):
   - Panel izquierdo: muestra enunciado arriba + textarea vacío debajo
   - Panel derecho: mensaje informativo "Escribe tu primer borrador y envíalo para recibir feedback"
   
2. El alumno escribe su borrador en el textarea y pulsa "Enviar borrador":
   - Se envía `startRefinerSession` al background
   - Loading spinner en panel derecho
   - El borrador del alumno aparece como mensaje "user" en el panel derecho (colapsado/resumido, porque es largo)
   - El feedback de la IA aparece como mensaje "assistant"
   - El textarea NO se borra — el alumno modifica el mismo borrador
   
3. El alumno modifica su borrador y lo reenvía:
   - Se envía `refinerDraft` al background
   - Nuevo par borrador+feedback se añade al historial
   
4. El alumno puede hacer preguntas sin reenviar el borrador:
   - Usa el input de chat pequeño abajo a la derecha
   - Se envía `refinerFollowUp`
   - La respuesta aparece en el historial

**Hook `useRefinerModal`:**

```typescript
function useRefinerModal({ exercise, isOpen, pageId, courseId }) {
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);  // historial completo
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [isFirstDraft, setIsFirstDraft] = useState(true);
    
    // Enviar borrador
    const handleSubmitDraft = async () => { ... }
    
    // Enviar pregunta de follow-up
    const handleSendFollowUp = async () => { ... }
    
    return { draft, setDraft, messages, isSubmitting, ... };
}
```

**Mensajes del historial:**

Para los borradores del alumno, mostrarlos de forma compacta en el panel derecho (no el texto completo, que puede ser largo). Opciones:
- Mostrar solo las primeras 2-3 líneas con "Ver completo" expandible
- O un badge "Borrador #N enviado" sin mostrar el texto

Para el feedback de la IA, renderizar con ReactMarkdown + CodeBlock (reutilizar el componente existente).

#### 4.2 `src/content/content.tsx`

Añadir estado y renderizado del RefinerModal:

```typescript
const [isRefinerModalOpen, setIsRefinerModalOpen] = useState(false);

// En handleOpenExerciseModal: si el ejercicio es refiner, abrir RefinerModal en vez de ExerciseModal
// O crear un handler dedicado handleOpenRefinerModal

// En el JSX, añadir:
{isRefinerModalOpen && exercises[selectedExerciseIndex] && (
    <RefinerModal
        exercise={exercises[selectedExerciseIndex]}
        isOpen={isRefinerModalOpen}
        onClose={() => setIsRefinerModalOpen(false)}
        pageId={currentPageId || undefined}
        courseId={courseId || undefined}
        exerciseContext={exerciseContext}
    />
)}
```

Actualizar `isAnyModalOpen` para incluir `isRefinerModalOpen`.

#### 4.3 `src/components/ChatSidebar/tabs/ExercisesTab.tsx`

Cambios para ejercicios con `role === 'refiner'`:
- Mostrar badge "Refiner" (ej: `<span className="badge bg-info">Refiner</span>`)
- Mostrar botón "Refinar" que abre el RefinerModal
- NO mostrar botones de "Ver explicación" / "Ver evaluaciones" (el refiner no genera ninguno de los dos)

#### 4.4 Botones inyectados en Egela (si aplica)

Si hay botones "Explicar"/"Resolver" inyectados en la página de Egela junto a cada ejercicio, para ejercicios refiner:
- No mostrar "Explicar" ni "Resolver"
- Mostrar un botón "Refinar" (o "Diseñar borrador")

Buscar en `content.tsx` o en el mecanismo de inyección de botones cómo se manejan los roles para Observer/Proofreader y seguir el mismo patrón.

### FASE 5: Storage (persistencia de sesiones)

#### 5.1 Guardar historial de refinamiento

Reutilizar el patrón de `ExplanationStorageManager.updateChatHistory()`. Cuando el alumno cierra el RefinerModal y lo reabre, debe poder continuar donde lo dejó.

Opciones:
- **Opción A (simple):** Guardar el chatHistory del Refiner usando el mismo `saveChatHistory` action que ya existe. Al abrir, enviar `refinerDraft` con `chatHistory` para restaurar contexto.
- **Opción B (dedicada):** Crear un `RefinerStorageManager` separado. Más limpio pero más código.

Recomiendo **Opción A** para empezar: reutilizar `saveChatHistory` con una key diferenciada.

### FASE 6: Bloqueos del Refiner en flujos existentes

En `agentHandlers.ts`, los handlers `handleGenerateExplanation` y `handleEvaluateSolution` ya bloquean Observer y Proofreader. Añadir bloqueo para Refiner:

```typescript
// En handleGenerateExplanation:
if (role === 'refiner') {
    sendResponse({
        success: false,
        error: `Este ejercicio está en modo Refiner. Usa la opción "Refinar" en su lugar.`,
    });
    return;
}

// En handleEvaluateSolution: 
if (role === 'refiner') {
    sendResponse({
        success: false,
        error: `Este ejercicio está en modo Refiner. No se evalúan soluciones directamente.`,
    });
    return;
}
```

## Orden de implementación recomendado

1. **Fase 1** (tipos) → 5 min, cambios en 4 archivos
2. **Fase 2.1** (RefinerAgent.ts) → el más importante, ~100 líneas
3. **Fase 2.2-2.4** (context, handlers, background) → seguir patrones existentes
4. **Fase 6** (bloqueos) → 2 líneas en cada handler
5. **Fase 3** (UI profesor) → 1 archivo, cambios menores
6. **Fase 4** (RefinerModal) → el más largo, nuevo componente React
7. **Fase 5** (storage) → al final, cuando todo funcione

## Lecciones aprendidas relevantes

- **NUNCA usar `maxTokens` en structured output (json_schema)**: Corta el JSON. El Refiner usa texto libre, así que no aplica, pero si se añadiera un schema luego, recordar esto.
- **Siempre restaurar contexto antes de cada turno**: El service worker de Chrome puede reiniciarse. Por eso cada handler debe recibir `chatHistory` y restaurar la sesión completa.
- **El `processResponseWithTools` de OpenAIService** es la forma correcta de hacer conversación libre (sin structured output). Es lo que usa `continueConversation` en ExplanationAgent.
- **Validar end-to-end**: Copilot/Claude Code pueden swappear lógica silenciosamente. Probar cada rol manualmente después de implementar.

## Testing manual

1. En modo profesor: verificar que aparece la 5ª columna "Refiner" y se puede asignar
2. En modo alumno: verificar que un ejercicio Refiner muestra el botón "Refinar" (no "Explicar"/"Resolver")
3. Abrir RefinerModal → escribir borrador → enviarlo → recibir feedback
4. Modificar borrador → reenviar → verificar que la IA reconoce los cambios
5. Enviar pregunta de follow-up sin reenviar borrador
6. Cerrar y reabrir el modal → verificar que se restaura el historial
7. Verificar que un ejercicio Refiner NO permite generar explicación ni evaluación clásica
