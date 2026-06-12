insert into storage.buckets (id, name, public)
values ('sku-images', 'sku-images', true)
on conflict (id) do nothing;

create policy "Public read sku-images"
on storage.objects for select
using (bucket_id = 'sku-images');

create policy "Authenticated upload sku-images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'sku-images');

create policy "Authenticated update sku-images"
on storage.objects for update
to authenticated
using (bucket_id = 'sku-images');

create policy "Authenticated delete sku-images"
on storage.objects for delete
to authenticated
using (bucket_id = 'sku-images');