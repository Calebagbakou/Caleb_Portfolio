update public.settings
set value = to_jsonb('Paiement sécurisé par SasPay'::text)
where key = 'shop_payment_description';
