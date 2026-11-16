DROP POLICY "voice samples read" ON storage.objects;
DROP POLICY "voice samples insert" ON storage.objects;
CREATE POLICY "voice samples read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='voice-samples' AND owner_id=(SELECT auth.uid()::text));
CREATE POLICY "voice samples insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='voice-samples' AND owner_id=(SELECT auth.uid()::text) AND (storage.foldername(name))[1]=(SELECT auth.uid()::text));