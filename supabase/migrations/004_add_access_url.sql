-- Add access_url field to products table for post-purchase fulfillment
alter table public.products
  add column if not exists access_url text;

-- Add comment to clarify usage
comment on column public.products.access_url is
  'URL to be displayed to customer after purchase (e.g., Gemini Pro interface, CapCut link, etc.)';
