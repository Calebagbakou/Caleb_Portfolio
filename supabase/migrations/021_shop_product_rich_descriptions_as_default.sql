update public.products
set description_rich = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', description)
      )
    )
  )
)
where description_rich is null
  and nullif(btrim(description), '') is not null;

update public.products
set description = null
where slug = 'gemini-pro'
  and description_rich is not null;
