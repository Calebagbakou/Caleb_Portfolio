update public.products
set
  name = regexp_replace(name, 'PixVerify(\.shop)?', 'service d’activation', 'gi'),
  description = regexp_replace(description, 'PixVerify(\.shop)?', 'service d’activation', 'gi'),
  tagline = regexp_replace(tagline, 'PixVerify(\.shop)?', 'service d’activation', 'gi'),
  highlights = case
    when highlights is null then null
    else array(
      select regexp_replace(highlight, 'PixVerify(\.shop)?', 'service d’activation', 'gi')
      from unnest(highlights) with ordinality as item(highlight, ord)
      order by ord
    )
  end,
  badge = regexp_replace(badge, 'PixVerify(\.shop)?', 'service d’activation', 'gi'),
  updated_at = now()
where slug = 'gemini-pro'
  and (
    name ilike '%pixverify%'
    or description ilike '%pixverify%'
    or tagline ilike '%pixverify%'
    or badge ilike '%pixverify%'
    or exists (
      select 1
      from unnest(highlights) as highlight
      where highlight ilike '%pixverify%'
    )
  );
