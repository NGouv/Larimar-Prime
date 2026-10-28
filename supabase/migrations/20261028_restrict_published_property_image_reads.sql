drop policy if exists "Visitors can read published property images"
  on storage.objects;

create policy "Visitors can read published property images"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1
      from public.properties as property
      where property.id::text = split_part(storage.objects.name, '/', 1)
        and property.status = 'published'
        and property.gallery @> jsonb_build_array(
          jsonb_build_object('path', storage.objects.name)
        )
    )
  );
