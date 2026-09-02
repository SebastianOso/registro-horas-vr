// Da de alta en lote a los becarios de un semestre: por cada renglón, crea la cuenta si
// el correo no existe todavía, o solo agrega la inscripción si ya existe (becario que
// repite servicio). Usa la secret key porque crear cuentas de Auth requiere la Admin
// API, que no puede tocar el navegador en un repo público (ver CLAUDE.md > Seguridad).
// El CSV se parsea en el cliente (ver src/features/becarios/parseCsvBecarios.ts) — esta
// function solo recibe el JSON ya parseado y revalida cada campo.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

interface BecarioInput {
  nombre?: string;
  matricula?: string;
  correo?: string;
}

interface CargarBecariosBody {
  semestre_id?: string;
  password?: string;
  becarios?: BecarioInput[];
}

type Estado = "cuenta_creada" | "solo_inscrito" | "omitido" | "error";

interface ResultadoFila {
  fila: number;
  correo: string;
  estado: Estado;
  mensaje?: string;
}

const MAX_BECARIOS = 200;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El cliente (navegador) llama a esta función desde el origen de Vite (localhost:5173 en
// dev, el dominio de producción después) — sin estos headers, el navegador descarta la
// respuesta real después del preflight OPTIONS y fetch() falla con un error genérico.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonError(mensaje: string, status: number) {
  return Response.json({ error: mensaje }, { status, headers: corsHeaders });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const userId = ctx.userClaims?.id;

    if (!userId) {
      return jsonError("Sesión inválida.", 401);
    }

    const body = (await req.json()) as CargarBecariosBody;
    const { semestre_id: semestreId, password, becarios } = body;

    if (!semestreId || !password || !Array.isArray(becarios)) {
      return jsonError("Faltan semestre_id, password o la lista de becarios.", 400);
    }

    if (password.length < 8) {
      return jsonError("La contraseña del lote debe tener al menos 8 caracteres.", 400);
    }

    if (becarios.length === 0) {
      return jsonError("La lista de becarios está vacía.", 400);
    }

    if (becarios.length > MAX_BECARIOS) {
      return jsonError(`No se pueden cargar más de ${MAX_BECARIOS} becarios a la vez.`, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
    const admin = createClient(supabaseUrl, secretKey);

    // withSupabase({ auth: "user" }) prueba QUIÉN llama, no QUÉ ROL tiene, y el cliente
    // admin bypassea RLS — así que la autorización de coordinador se verifica a mano acá,
    // con la misma condición que public.es_coordinador().
    const { data: perfil, error: errorPerfil } = await admin
      .from("profiles")
      .select("rol, activo")
      .eq("id", userId)
      .maybeSingle();

    if (errorPerfil) {
      return jsonError(errorPerfil.message, 500);
    }

    if (!perfil || perfil.rol !== "coordinador" || !perfil.activo) {
      return jsonError("Solo un coordinador puede cargar becarios.", 403);
    }

    const { data: semestre, error: errorSemestre } = await admin
      .from("semestres")
      .select("id")
      .eq("id", semestreId)
      .maybeSingle();

    if (errorSemestre) {
      return jsonError(errorSemestre.message, 500);
    }

    if (!semestre) {
      return jsonError("El semestre indicado no existe.", 400);
    }

    const resultados: ResultadoFila[] = [];
    const correosVistos = new Set<string>();

    // Secuencial, no Promise.all: la Auth Admin API tiene rate limit, y el orden de
    // resultados debe corresponder al del archivo que subió el coordinador.
    for (let idx = 0; idx < becarios.length; idx++) {
      const fila = idx + 1;
      const entrada = becarios[idx];

      try {
        const resultado = await procesarFila(admin, fila, entrada, semestreId, password, correosVistos);
        resultados.push(resultado);
      } catch (err) {
        resultados.push({
          fila,
          correo: entrada?.correo ?? "",
          estado: "error",
          mensaje: err instanceof Error ? err.message : "Error inesperado al procesar la fila.",
        });
      }
    }

    const resumen = {
      creados: resultados.filter((r) => r.estado === "cuenta_creada").length,
      inscritos: resultados.filter((r) => r.estado === "solo_inscrito").length,
      omitidos: resultados.filter((r) => r.estado === "omitido").length,
      errores: resultados.filter((r) => r.estado === "error").length,
    };

    return Response.json({ resultados, resumen }, { headers: corsHeaders });
  }),
};

// deno-lint-ignore no-explicit-any
async function procesarFila(
  admin: ReturnType<typeof createClient>,
  fila: number,
  entrada: BecarioInput,
  semestreId: string,
  password: string,
  correosVistos: Set<string>,
): Promise<ResultadoFila> {
  const nombre = (entrada?.nombre ?? "").trim();
  const matricula = (entrada?.matricula ?? "").trim();
  const correo = (entrada?.correo ?? "").trim().toLowerCase();

  if (!nombre || !matricula || !correo) {
    return { fila, correo, estado: "error", mensaje: "Faltan nombre, matrícula o correo." };
  }

  if (!CORREO_REGEX.test(correo)) {
    return { fila, correo, estado: "error", mensaje: "El correo no tiene un formato válido." };
  }

  if (correosVistos.has(correo)) {
    return { fila, correo, estado: "omitido", mensaje: "Correo repetido en el archivo." };
  }
  correosVistos.add(correo);

  const { data: profileExistente, error: errorBusqueda } = await admin
    .from("profiles")
    .select("id")
    .eq("correo", correo)
    .maybeSingle();

  if (errorBusqueda) {
    return { fila, correo, estado: "error", mensaje: errorBusqueda.message };
  }

  let becarioId: string;
  let cuentaNueva = false;

  if (profileExistente) {
    becarioId = profileExistente.id;
  } else {
    const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
    });

    if (errorCrear || !creado.user) {
      return {
        fila,
        correo,
        estado: "error",
        mensaje: errorCrear?.message.includes("already registered")
          ? "Ya existe una cuenta de autenticación con ese correo pero sin perfil; revisar a mano."
          : errorCrear?.message ?? "No se pudo crear la cuenta.",
      };
    }

    becarioId = creado.user.id;

    const { error: errorProfile } = await admin.from("profiles").insert({
      id: becarioId,
      nombre,
      matricula,
      correo,
      rol: "becario",
      activo: true,
      debe_cambiar_password: true,
    });

    if (errorProfile) {
      // Compensar: sin esto, reintentar el mismo CSV corregido caería en "already
      // registered" y quedaría trabado, porque el usuario de Auth sí quedó creado.
      await admin.auth.admin.deleteUser(becarioId);
      return { fila, correo, estado: "error", mensaje: errorProfile.message };
    }

    cuentaNueva = true;
  }

  const { error: errorInscripcion } = await admin.from("inscripciones").insert({
    becario_id: becarioId,
    semestre_id: semestreId,
    horas_meta: null,
    activo: true,
  });

  if (errorInscripcion) {
    if (errorInscripcion.code === "23505") {
      return { fila, correo, estado: "omitido", mensaje: "Ya estaba inscrito en este semestre." };
    }
    if (cuentaNueva) {
      return {
        fila,
        correo,
        estado: "error",
        mensaje: `La cuenta se creó pero no se pudo inscribir: ${errorInscripcion.message}`,
      };
    }
    return { fila, correo, estado: "error", mensaje: errorInscripcion.message };
  }

  return { fila, correo, estado: cuentaNueva ? "cuenta_creada" : "solo_inscrito" };
}
