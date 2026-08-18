import { Archive, Copy, Eye, Pencil, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { PromotionRecord, PromotionStatus } from '../domain/promotion';
import type { TvDisplayRecord } from '../hooks/useTvData';
import { supabase } from '../services/supabase';
import { ActionDialog } from './ActionDialog';

const labels: Record<PromotionStatus, string> = {
  draft: 'Rascunho',
  approved: 'Aprovada',
  scheduled: 'Agendada',
  active: 'Em exibição',
  archived: 'Arquivada',
};
const filters: Array<[string, PromotionStatus | 'all']> = [
  ['Todas', 'all'],
  ['Rascunhos', 'draft'],
  ['Aprovadas', 'approved'],
  ['Em exibição', 'active'],
  ['Agendadas', 'scheduled'],
  ['Arquivadas', 'archived'],
];
export function PromotionsPage({
  companyId,
  promotions,
  displays,
  onEdit,
  onCreate,
  onReload,
}: {
  companyId: string;
  promotions: PromotionRecord[];
  displays: TvDisplayRecord[];
  onEdit: (promotion: PromotionRecord) => void;
  onCreate: () => void;
  onReload: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<PromotionStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: 'unpublish' | 'delete';
    promotion: PromotionRecord;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const visible =
    filter === 'all' ? promotions : promotions.filter((item) => item.status === filter);
  const displayNames = new Map(displays.map((display) => [display.id, display.name]));
  const archive = async (promotion: PromotionRecord) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('tv_generated_promotions')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', promotion.id)
      .eq('company_id', companyId);
    if (error) setError(error.message);
    else await onReload();
  };
  const removeFromTv = async (promotion: PromotionRecord) => {
    if (!supabase || !promotion.current_media_id || processing) return;
    setProcessing(true);
    const { error } = await supabase
      .from('tv_playlist_items')
      .delete()
      .eq('company_id', companyId)
      .eq('media_id', promotion.current_media_id);
    if (error) setError(error.message);
    else {
      await supabase
        .from('tv_generated_promotions')
        .update({ status: 'approved', display_ids: [], updated_at: new Date().toISOString() })
        .eq('id', promotion.id)
        .eq('company_id', companyId);
      setPendingAction(null);
      await onReload();
    }
    setProcessing(false);
  };
  const duplicate = async (promotion: PromotionRecord) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('tv_generated_promotions')
      .insert({
        company_id: companyId,
        title: `${promotion.title} (cópia)`,
        subtitle: promotion.subtitle,
        status: 'draft',
        layout_type: promotion.layout_type,
        design: promotion.design,
        duration_seconds: promotion.duration_seconds,
        schedule: promotion.schedule,
      })
      .select('id')
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    const products = promotion.products ?? [];
    if (products.length)
      await supabase
        .from('tv_generated_promotion_products')
        .insert(
          products.map((product) => ({
            company_id: companyId,
            promotion_id: data.id,
            name: product.name,
            short_description: product.short_description || null,
            original_price: product.original_price,
            promotional_price: product.promotional_price,
            image_key: product.image_key,
            image_url: product.image_url,
            badge_text: product.badge_text || null,
            note: product.note || null,
            position: product.position,
            image_transform: product.image_transform,
          })),
        );
    await onReload();
  };
  const remove = async (promotion: PromotionRecord) => {
    if (!supabase || processing) return;
    setProcessing(true);
    if (promotion.current_media_id)
      await supabase
        .from('tv_playlist_items')
        .delete()
        .eq('company_id', companyId)
        .eq('media_id', promotion.current_media_id);
    const { error } = await supabase
      .from('tv_generated_promotions')
      .delete()
      .eq('id', promotion.id)
      .eq('company_id', companyId);
    if (error) setError(error.message);
    else {
      setPendingAction(null);
      await onReload();
    }
    setProcessing(false);
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Promoções</h1>
          <p>Artes criadas, aprovadas e programadas para suas TVs.</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          Criar promoção
        </button>
      </div>
      {error ? (
        <div className="system-alert error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="tabs promotion-filters">
        {filters.map(([label, value]) => (
          <button
            type="button"
            key={value}
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <section className="card empty compact">
          <div>
            <h3>Nenhuma promoção nesta categoria</h3>
            <p>Crie uma arte e salve como rascunho ou publique em uma televisão.</p>
          </div>
        </section>
      ) : (
        <div className="promotion-list">
          {visible.map((promotion) => {
            const image = promotion.current_media_id ? promotion.design?.backgroundColor : null;
            return (
              <article className="card promotion-row" key={promotion.id}>
                <div
                  className="promotion-thumbnail"
                  style={{ background: image ?? promotion.design?.backgroundColor ?? '#183d2d' }}
                >
                  <strong>{promotion.title}</strong>
                </div>
                <div className="promotion-row-copy">
                  <div>
                    <strong>{promotion.title}</strong>
                    <span className={`call-status ${promotion.status}`}>
                      {labels[promotion.status]}
                    </span>
                  </div>
                  <span>
                    {promotion.products?.length ?? 0} produto(s) ·{' '}
                    {promotion.display_ids
                      .map((id) => displayNames.get(id))
                      .filter(Boolean)
                      .join(', ') || 'Nenhuma TV'}
                  </span>
                  <span>
                    Criada em {new Date(promotion.created_at).toLocaleDateString('pt-BR')} ·
                    Atualizada em {new Date(promotion.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="promotion-actions">
                  <button
                    className="icon-button"
                    onClick={() => onEdit(promotion)}
                    aria-label="Visualizar ou editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => void duplicate(promotion)}
                    aria-label="Duplicar"
                  >
                    <Copy size={16} />
                  </button>
                  {promotion.status === 'active' || promotion.status === 'scheduled' ? (
                    <button
                      className="icon-button"
                      onClick={() => setPendingAction({ type: 'unpublish', promotion })}
                      aria-label="Remover da programação"
                    >
                      <Play size={16} />
                    </button>
                  ) : null}
                  <button
                    className="icon-button"
                    onClick={() => void archive(promotion)}
                    aria-label="Arquivar"
                  >
                    <Archive size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    onClick={() => setPendingAction({ type: 'delete', promotion })}
                    aria-label="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                  <span className="sr-only">
                    <Eye />
                    Visualizar
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <ActionDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.type === 'unpublish' ? 'Remover promoção das TVs?' : `Excluir “${pendingAction?.promotion.title ?? 'promoção'}”?`}
        description={pendingAction?.type === 'unpublish'
          ? <p>A promoção deixará de aparecer em todas as TVs, mas continuará salva para ser publicada novamente.</p>
          : <p>A promoção será excluída. As imagens já geradas continuarão disponíveis na biblioteca de mídias.</p>}
        actions={[{
          value: pendingAction?.type ?? 'delete',
          label: pendingAction?.type === 'unpublish' ? 'Remover das TVs' : 'Excluir promoção',
          variant: 'danger',
        }]}
        busy={processing}
        busyLabel={pendingAction?.type === 'unpublish' ? 'Removendo...' : 'Excluindo...'}
        onAction={() => {
          if (!pendingAction) return
          if (pendingAction.type === 'unpublish') void removeFromTv(pendingAction.promotion)
          else void remove(pendingAction.promotion)
        }}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}
