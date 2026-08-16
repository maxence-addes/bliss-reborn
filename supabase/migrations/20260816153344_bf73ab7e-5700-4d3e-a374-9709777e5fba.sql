ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS used_invite_codes text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.consume_invite_code(_code TEXT)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET used_invite_codes = (
    SELECT ARRAY(SELECT DISTINCT unnest(used_invite_codes || ARRAY[_code]))
  )
  WHERE (invite_code = _code OR _code = ANY(invite_codes))
    AND EXISTS (
      SELECT 1 FROM public.parent_child_links l
      WHERE (l.parent_user_id = profiles.id AND l.child_user_id = auth.uid())
         OR (l.child_user_id = profiles.id AND l.parent_user_id = auth.uid())
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_invite_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_invite_code(TEXT) TO authenticated;