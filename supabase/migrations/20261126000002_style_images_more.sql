-- image_url for the remaining 10 styles (objects uploaded to public bucket style-images; Unsplash License).
-- vintage.jpg and parisian.jpg objects were replaced in place (no-text photos); their image_url is unchanged.
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/glam.jpg' where id = 'glam';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/businessformal.jpg' where id = 'businessformal';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/gothic.jpg' where id = 'gothic';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/utility.jpg' where id = 'utility';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/sporty.jpg' where id = 'sporty';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/normcore.jpg' where id = 'normcore';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/retro70s.jpg' where id = 'retro70s';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/pinup.jpg' where id = 'pinup';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/whimsigoth.jpg' where id = 'whimsigoth';
update public.styles set image_url = 'https://trtjcsxcowqecsebvyme.supabase.co/storage/v1/object/public/style-images/mobwife.jpg' where id = 'mobwife';
