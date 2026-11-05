export async function getSupabaseFunctionError(error, fallback) {
  const response = error?.context;
  if (response && typeof response.clone === 'function') {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === 'string' && body.error.trim()) return new Error(body.error);
      if (typeof body?.message === 'string' && body.message.trim()) return new Error(body.message);
    } catch (parseError) {
      console.warn('La réponse de la fonction Supabase n’est pas au format JSON.', parseError);
    }
  }
  return new Error(error?.message || fallback);
}
