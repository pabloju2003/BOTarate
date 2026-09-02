import { parseHTML } from 'linkedom';

/**
 * Interface for teacher role detection result
 */
export interface TeacherRoleCheckResult {
    isTeacher: boolean;
    userEmail: string;
}

/**
 * Nombres de rol conocidos que identifican a un profesor.
 *
 * Se comparan de forma exacta, y son sobre todo los roles de alumno
 * matriculado a mano que se usan como atajo de pruebas, que no contienen
 * ninguna de las palabras clave de TEACHER_ROLE_KEYWORDS.
 */
export const TEACHER_ROLES = [
    'Teacher',
    'Profesor',
    'Irakaslea',
    'Docente',
    'Docente manual sin permiso de edición',
    'Eskuz matrikulatutako ikaslea', // TODO: Remove these test roles
    'Estudiante manual',
    'Manual enrollment student'
];

/**
 * Palabras clave que, apareciendo en cualquier parte del nombre del rol,
 * bastan para considerarlo un rol de profesor.
 *
 * Egela nombra el mismo rol de maneras distintas según el idioma de la
 * interfaz y según cómo se haga la matriculación ('Docente', 'Docente manual
 * sin permiso de edición', 'Non-editing teacher', 'Editatzeko baimenik gabeko
 * irakaslea'...). Comparar por palabra clave evita tener que tocar el código
 * cada vez que cambia el nombre exacto del rol asignado.
 */
export const TEACHER_ROLE_KEYWORDS = [
    'docente',
    'teacher',
    'profesor',
    'irakasle' // cubre 'irakaslea', 'irakasleak' y demás formas declinadas
];

/**
 * Normaliza un nombre de rol para compararlo: sin tildes, en minúsculas y sin
 * espacios sobrantes.
 */
function normalizeRoleName(role: string): string {
    return role
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Decide si el nombre de rol leído de la lista de participantes corresponde a
 * un profesor. Primero prueba las palabras clave, que toleran variantes en el
 * nombre del rol, y después la lista de nombres exactos de TEACHER_ROLES.
 */
export function isTeacherRoleName(role: string): boolean {
    const normalizedRole = normalizeRoleName(role);
    if (!normalizedRole) {
        return false;
    }

    if (TEACHER_ROLE_KEYWORDS.some(keyword => normalizedRole.includes(keyword))) {
        return true;
    }

    return TEACHER_ROLES.some(knownRole => normalizeRoleName(knownRole) === normalizedRole);
}

/**
 * Textos de la etiqueta <dt> que preceden al email en la página de perfil de
 * Egela, en los idiomas que puede tener la interfaz (castellano y euskera).
 * Se comparan en minúsculas y sin acentos-sensibilidad estricta.
 */
const EMAIL_LABELS = [
    'dirección de correo',
    'correo electrónico',
    'helbide elektronikoa',
    'posta elektronikoa'
];

/**
 * FRAGILIDAD CONOCIDA: la detección de rol de profesor depende de parsear el
 * HTML de la página de perfil de Egela (Moodle), que cambia con cada
 * actualización de tema. En julio de 2026, una actualización de tema de Egela
 * rompió el selector CSS anterior
 *   (#region-main-box > div > div.col-md-4 > ... > div.userinfo.my-2 > ...)
 * porque el nuevo tema dejó de usar las clases `col-md-4` y `userinfo.my-2`.
 * El síntoma era silencioso: la excepción se capturaba aguas arriba y el
 * usuario quedaba forzado a modo alumno sin toggle de rol.
 *
 * Para reducir esa fragilidad, este extractor NO depende de clases de tema:
 *   1. Prefiere un enlace `mailto:` dentro del nodo de perfil cuyo <dt> sea la
 *      etiqueta de correo (contempla castellano y euskera).
 *   2. Si no lo encuentra, cae a cualquier `a[href^="mailto:"]` de la página.
 * El email se lee del textContent del <a> (no del href, que Moodle codifica en
 * hexadecimal, p. ej. mailto:%70%6a...).
 *
 * @param profileDoc Documento ya parseado de la página de perfil
 * @returns El email en texto plano, o null si no se pudo extraer
 */
function extractEmailFromProfileDoc(profileDoc: Document): string | null {
    // 1. Búsqueda semántica: <li class="contentnode"> (o cualquier bloque con
    //    <dt>/<dd>) cuyo <dt> coincida con una etiqueta de correo conocida.
    const labelledBlocks = profileDoc.querySelectorAll('dl');
    for (const dl of Array.from(labelledBlocks)) {
        const dt = dl.querySelector('dt');
        const dtText = dt?.textContent?.trim().toLowerCase() || '';
        if (!dtText || !EMAIL_LABELS.some(label => dtText.includes(label))) {
            continue;
        }
        const mailtoLink = dl.querySelector('dd a[href^="mailto:"]') || dl.querySelector('dd a');
        const email = mailtoLink?.textContent?.trim();
        if (email) {
            return email;
        }
    }

    // 2. Fallback independiente del tema: primer enlace mailto: de la página.
    const anyMailto = profileDoc.querySelector('a[href^="mailto:"]');
    const fallbackEmail = anyMailto?.textContent?.trim();
    if (fallbackEmail) {
        console.warn('[extractEmailFromProfileDoc] Email extraído por fallback mailto: (no se encontró el <dt> de etiqueta de correo; ¿cambió el tema de Egela?)');
        return fallbackEmail;
    }

    return null;
}

/**
 * Gets the current user's email from their profile page
 * @returns The current user's email
 * @throws Error if profile cannot be fetched or email cannot be extracted
 */
export async function getCurrentUserEmail(): Promise<string> {
    const profileUrl = 'https://egela.ehu.eus/user/profile.php';
    const profileResponse = await fetch(profileUrl);

    if (!profileResponse.ok) {
        throw new Error(`[getCurrentUserEmail] Error fetching profile: ${profileResponse.status}`);
    }

    if (profileResponse.url?.includes('egela.ehu.eus/login/index.php')) {
        throw new Error('EgelaSessionExpired');
    }

    const profileHtml = await profileResponse.text();
    const { document: profileDoc } = parseHTML(profileHtml);

    const currentUserEmail = extractEmailFromProfileDoc(profileDoc as unknown as Document);

    if (!currentUserEmail) {
        // Diagnóstico: si esto vuelve a fallar por otro cambio de tema, el log
        // deja pistas sin tener que reinspeccionar el HTML a mano. Ver la nota
        // de FRAGILIDAD CONOCIDA en extractEmailFromProfileDoc().
        const mailtoCount = profileDoc.querySelectorAll('a[href^="mailto:"]').length;
        console.error(
            `[getCurrentUserEmail] No se pudo extraer el email del perfil. ` +
            `HTML recibido: ${profileHtml.length} bytes; enlaces mailto: encontrados: ${mailtoCount}. ` +
            `Probable cambio de tema de Egela: revisar extractEmailFromProfileDoc() y las etiquetas EMAIL_LABELS.`
        );
        throw new Error('[getCurrentUserEmail] Could not get current user email');
    }

    return currentUserEmail;
}

/**
 * Checks if the current user is a teacher in the given course
 * Optimized to check role first before fetching profiles
 * @param courseId The course ID to check
 * @returns Object with isTeacher flag and the current user's email
 */
export async function checkTeacherStatus(courseId: string): Promise<TeacherRoleCheckResult> {
    // 1. Get current user's email
    const currentUserEmail = await getCurrentUserEmail();

    // 2. Get course participants (requesting up to 5000 per page to avoid pagination)
    const participantsUrl = `https://egela.ehu.eus/user/index.php?page=0&perpage=5000&contextid=0&id=${courseId}&newcourse`;
    const participantsResponse = await fetch(participantsUrl);

    if (!participantsResponse.ok) {
        throw new Error(`[checkTeacherStatus] Error fetching participants: ${participantsResponse.status}`);
    }

    if (participantsResponse.url?.includes('egela.ehu.eus/login/index.php')) {
        throw new Error('EgelaSessionExpired');
    }

    const participantsHtml = await participantsResponse.text();
    const { document: participantsDoc } = parseHTML(participantsHtml);

    // 3. Find current user in participants and check role
    let userIndex = 0;
    while (true) {
        const userNameCellId = `user-index-participants-${courseId}_r${userIndex}_c1`;
        const userNameCell = participantsDoc.querySelector(`#${userNameCellId}`);

        if (!userNameCell) {
            // No more users - current user is not a teacher
            return {
                isTeacher: false,
                userEmail: currentUserEmail
            };
        }

        // 1. Check the role first (before fetching the profile)
        // El rol siempre vive en la columna c3, unas veces como texto plano
        // ('<td class="cell c3">Docente manual sin permiso de edición</td>') y
        // otras envuelto en un enlace ('<span><a>...</a></span>'). textContent
        // de la celda entera cubre los dos casos, así que no hace falta
        // distinguirlos ni recurrir a la columna c2.
        const userRoleCellId = `user-index-participants-${courseId}_r${userIndex}_c3`;
        const userRoleCell = participantsDoc.querySelector(`#${userRoleCellId}`);

        if (!userRoleCell) {
            throw new Error(`[checkTeacherStatus] Could not get role for user record at index ${userIndex}`);
        }

        const role = userRoleCell.textContent?.trim() || '';

        const isTeacherRole = isTeacherRoleName(role);

        if (!isTeacherRole) {
            // If not a teacher role, skip this user without fetching their profile
            userIndex++;
            continue;
        }

        // 2. If it is a teacher role, fetch the profile to see if it's the current user
        console.log(`[checkTeacherStatus] Potential teacher found (role: ${role}), checking email...`);

        const userProfileLink = userNameCell.querySelector('a');
        if (!userProfileLink) {
            userIndex++;
            continue;
        }

        const userProfileUrl = userProfileLink.getAttribute('href');
        if (!userProfileUrl) {
            userIndex++;
            continue;
        }

        const userProfileResponse = await fetch(userProfileUrl);
        if (!userProfileResponse.ok) {
            userIndex++;
            continue;
        }

        if (userProfileResponse.url?.includes('egela.ehu.eus/login/index.php')) {
            throw new Error('EgelaSessionExpired');
        }

        const userProfileHtml = await userProfileResponse.text();
        const { document: userProfileDoc } = parseHTML(userProfileHtml);

        // Se reutiliza el extractor independiente del tema en lugar del
        // selector CSS antiguo, que dejó de funcionar con el cambio de tema de
        // Egela de julio de 2026 (ver la nota de FRAGILIDAD CONOCIDA arriba).
        const userEmail = extractEmailFromProfileDoc(userProfileDoc as unknown as Document);

        if (userEmail === currentUserEmail) {
            console.log(`[checkTeacherStatus] Current user confirmed as teacher: ${currentUserEmail}`);
            return {
                isTeacher: true,
                userEmail: currentUserEmail
            };
        }

        userIndex++;
    }
}
