// Cambia la contraseña de la cuenta que llama y apaga profiles.debe_cambiar_password,
// las dos cosas atómicas. Es la ÚNICA vía capaz de apagar esa columna: el trigger
// proteger_campos_privilegiados_profile bloquea que un usuario autenticado la escriba
// directo (ver supabase/migrations/0002_profiles_debe_cambiar_password.sql). El frontend
// nunca debe llamar a auth.updateUser() ni escribir esa columna por su cuenta.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

interface CambiarPasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

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
    const email = ctx.userClaims?.email;

    if (!userId || !email) {
      return jsonError("Sesión inválida.", 401);
    }

    const { currentPassword, newPassword } = (await req.json()) as CambiarPasswordBody;

    if (!currentPassword || !newPassword) {
      return jsonError("Faltan la contraseña actual o la nueva.", 400);
    }

    if (newPassword.length < 6) {
      return jsonError("La nueva contraseña debe tener al menos 6 caracteres.", 400);
    }

    if (newPassword === currentPassword) {
      return jsonError("La nueva contraseña debe ser distinta de la actual.", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!)["default"];
    const secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];

    // Verificar la contraseña actual intentando un login real con un cliente aparte
    // (persistSession: false para no dejar sesiones colgadas): si funciona, currentPassword
    // es efectivamente la contraseña vigente de esta cuenta.
    const clienteVerificador = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false },
    });
    const { error: errorVerificacion } = await clienteVerificador.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (errorVerificacion) {
      return jsonError("La contraseña actual no es correcta.", 400);
    }

    const admin = createClient(supabaseUrl, secretKey);

    const { error: errorCambioPassword } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (errorCambioPassword) {
      return jsonError(errorCambioPassword.message, 400);
    }

    const { error: errorPerfil } = await admin
      .from("profiles")
      .update({ debe_cambiar_password: false })
      .eq("id", userId);

    if (errorPerfil) {
      return jsonError(errorPerfil.message, 500);
    }

    return Response.json({ ok: true }, { headers: corsHeaders });
  }),
};
