/**
 * Esquema para un ejercicio individual
 */
export const ExerciseSchema = {
    type: "object",
    properties: {
        name: {
            type: "string",
            description: "El nombre o identificador del ejercicio (ej: 'Ejercicio 2.1')"
        },
        statement: {
            type: "string",
            description: "El enunciado completo del ejercicio, incluyendo tablas y contexto relevante en formato Markdown"
        }
    },
    required: ["name", "statement"],
    additionalProperties: false
} as const;

/**
 * Esquema para la respuesta de identificación de ejercicios
 */
export const ExerciseListSchema = {
    type: "object",
    properties: {
        exercises: {
            type: "array",
            items: ExerciseSchema,
            description: "Lista de ejercicios identificados en la página. Array vacío si no hay ejercicios."
        },
        exercise_context: {
            type: ["string", "null"],
            description: "Contexto adicional relevante para los ejercicios (por ejemplo, script SQL de esquema de base de datos, especificaciones técnicas, etc.)"
        },
        concepts: {
            type: ["array", "null"],
            items: {
                type: "string"
            },
            description: "Lista de conceptos o instrucciones que se trabajan en los ejercicios de esta página"
        },
        learning_objectives: {
            type: ["string", "null"],
            description: "Descripción breve de los objetivos de aprendizaje o conceptos que se pretenden trabajar con estos ejercicios"
        }
    },
    required: ["exercises", "exercise_context", "concepts", "learning_objectives"],
    additionalProperties: false
} as const;

/**
 * Esquema para un paso de explicación
 */
export const StepSchema = {
    type: "object",
    properties: {
        title: {
            type: "string",
            description:"Título breve y descriptivo del paso sin incluir numeración. El número del paso se añadirá automáticamente en la interfaz. (ej: 'Identificar los datos necesarios', 'Aplicar la técnica de filtrado adecuada')"
        },
        content: {
            type: "string",
            description: "Explicación detallada del paso en formato Markdown. Cada paso se corresponde a un subproblema/paso de refinamiento sucesivo. Puede incluir tablas, código SQL, listas, etc. NO incluyas un título en markdown al inicio, ya que se usará el campo 'title'."
        }
    },
    required: ["title", "content"],
    additionalProperties: false
} as const;

/**
 * Esquema para la explicación estructurada de un ejercicio
 */
export const ExplanationSchema = {
    type: "object",
    properties: {
        steps: {
            type: "array",
            items: StepSchema,
            description: "Lista ordenada de pasos para resolver el ejercicio. Cada paso debe ser claro y progresivo. Si el alumno ya ha completado ejercicios relacionados, reduce la verbosidad en conceptos básicos y enfócate en los aspectos nuevos o avanzados."
        }
    },
    required: ["steps"],
    additionalProperties: false
} as const;

/**
 * Esquema para la evaluación de una solución de ejercicio
 */
export const EvaluationSchema = {
    type: "object",
    properties: {
        score: {
            type: "number",
            minimum: 0,
            maximum: 10,
            description: "Puntuación de la solución sobre 10 puntos"
        },
        feedback: {
            type: "string",
            description: "Comentario detallado sobre la solución en formato Markdown. Debe incluir: qué está bien, qué está mal, sugerencias de mejora y explicación de errores si los hay."
        }
    },
    required: ["score", "feedback"],
    additionalProperties: false
} as const;

export type ExerciseSchemaType = {
    name: string;
    statement: string;
};

export type ExerciseListSchemaType = {
    exercises: ExerciseSchemaType[];
    exercise_context: string | null;
    concepts: string[] | null;
    learning_objectives: string | null;
};

export type StepSchemaType = {
    title: string;
    content: string;
};

export type ExplanationSchemaType = {
    steps: StepSchemaType[];
};

export type EvaluationSchemaType = {
    score: number;
    feedback: string;
};
