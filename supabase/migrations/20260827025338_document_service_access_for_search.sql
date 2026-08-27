create policy "service role may read search documents"
on public.place_search_documents
for select
to service_role
using (true);
