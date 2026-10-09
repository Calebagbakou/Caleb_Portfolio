drop trigger if exists enforce_gemini_18_month_plan on public.product_plans;
drop function if exists public.enforce_gemini_18_month_plan();

update public.products
set
  description = 'Les formules Gemini AI Pro de 4 et 12 mois sont momentanément indisponibles. La formule 18 mois est disponible avec un lien d’activation généré après confirmation du paiement.',
  tagline = 'Gemini AI Pro — formule 18 mois disponible.',
  updated_at = now()
where slug = 'gemini-pro';
