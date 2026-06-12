-- Add checkout status and last handler to skus
ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'available';
ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS last_handler TEXT;

-- Transaction history table
CREATE TABLE IF NOT EXISTS public.sku_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sku_code TEXT NOT NULL,
    department TEXT NOT NULL,
    action_type TEXT NOT NULL, -- check_out | check_in
    person_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.sku_transactions ENABLE ROW LEVEL SECURITY;

-- Authenticated users
CREATE POLICY "auth_insert_transactions"
ON public.sku_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_select_transactions"
ON public.sku_transactions FOR SELECT TO authenticated USING (true);

-- Anon users (field workers scanning QR codes without logging in)
CREATE POLICY "anon_insert_transactions"
ON public.sku_transactions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_transactions"
ON public.sku_transactions FOR SELECT TO anon USING (true);
