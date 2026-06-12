-- Allow unauthenticated (anon) users to read SKU data by exact sku_code lookup.
-- This enables the QR-scan landing page to display product info without requiring login.
-- Writes remain restricted to authenticated users only (existing policies unchanged).
CREATE POLICY "Public read skus by sku_code"
  ON public.skus
  FOR SELECT
  TO anon
  USING (true);
