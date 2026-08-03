import { useCallback, useEffect, useState } from 'react'
import type { PromotionProduct, PromotionRecord } from '../domain/promotion'
import { supabase } from '../services/supabase'

export function usePromotions(companyId: string) {
  const [promotions, setPromotions] = useState<PromotionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error: queryError } = await supabase.from('tv_generated_promotions').select('*,products:tv_generated_promotion_products(*)').eq('company_id', companyId).order('updated_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else { setPromotions((data ?? []).map(row => ({ ...row, products: (row.products as PromotionProduct[]).toSorted((a, b) => a.position - b.position) })) as PromotionRecord[]); setError(null) }
    setLoading(false)
  }, [companyId])
  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer) }, [reload])
  useEffect(() => { if (!supabase) return; const client = supabase; const channel = client.channel(`promotions:${companyId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_generated_promotions', filter: `company_id=eq.${companyId}` }, () => void reload()).subscribe(); return () => { void client.removeChannel(channel) } }, [companyId, reload])
  return { promotions, loading, error, reload }
}
