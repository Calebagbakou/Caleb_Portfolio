update public.settings
set value = to_jsonb('Des outils IA et créatifs premium, livrés immédiatement après paiement.'::text)
where key = 'shop_hero_title'
  and value = to_jsonb('Des outils IA et créatifs premium, activés rapidement.'::text);

update public.settings
set value = to_jsonb('Abonnements Gemini Pro, CapCut Pro, Canva Pro et plus — livraison immédiate après confirmation du paiement. En cas de problème, la situation est résolue sous 24 h.'::text)
where key = 'shop_hero_description'
  and value = to_jsonb('Abonnements Gemini Pro, CapCut Pro, Canva Pro et plus — sélectionnés par Caleb Creative, activés après commande, avec un accompagnement direct.'::text);

update public.settings
set value = to_jsonb('Livraison immédiate'::text)
where key = 'shop_activation_title'
  and value = to_jsonb('Activation rapide'::text);

update public.settings
set value = to_jsonb('Après confirmation du paiement · problème résolu sous 24 h'::text)
where key = 'shop_activation_description'
  and value = to_jsonb('Sous 24 à 48h après commande'::text);

update public.products
set description = replace(
      description,
      'généré après confirmation du paiement',
      'généré immédiatement après confirmation du paiement'
    ),
    highlights = array_replace(
      highlights,
      'Lien d’activation généré après paiement confirmé',
      'Lien d’activation généré immédiatement après paiement confirmé'
    ),
    updated_at = now()
where slug = 'gemini-pro';
