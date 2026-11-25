-- Public bucket for style tile photos (Unsplash License, free commercial use) + image_url for 14 styles.
insert into storage.buckets (id, name, public) values ('style-images', 'style-images', true) on conflict (id) do update set public = true;

update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/feminine.jpg' where id = 'feminine';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/officechic.jpg' where id = 'officechic';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/parisian.jpg' where id = 'parisian';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/coquette.jpg' where id = 'coquette';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/cleangirl.jpg' where id = 'cleangirl';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/darkacademia.jpg' where id = 'darkacademia';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/cottagecore.jpg' where id = 'cottagecore';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/grunge.jpg' where id = 'grunge';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/athflow.jpg' where id = 'athflow';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/elegant.jpg' where id = 'elegant';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/kfashion.jpg' where id = 'kfashion';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/vintage.jpg' where id = 'vintage';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/resort.jpg' where id = 'resort';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/artsy.jpg' where id = 'artsy';
