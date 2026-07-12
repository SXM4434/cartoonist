
update public.transcript_chunks set created_at = now() - (interval '1 minute' * (case
  when text like 'I set up%' then 10
  when text like 'Should we ship%' then 1.5
  when text like 'Anyway, the office%' then 1.4
  when text like 'Somebody should call%' then 1.3
  when text like 'Also the new plants%' then 1.1
  when text like 'My cat threw%' then 0.9
  when text like 'Traffic on the bridge%' then 0.6
  when text like 'Lunch options%' then 0.3
end)) where room_id='fbaef197-7700-45af-95ed-258c8deb8451' and created_at > '2026-07-12 20:00:00+00';
