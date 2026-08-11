import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  FileImage,
  LoaderCircle,
  MessageSquareText,
  Search,
  Sparkles,
  Video,
  WandSparkles,
} from "lucide-react";
import type { TvMediaRecord, TvPlaylistRecord, TvTransitionType } from "../hooks/useTvData";
import { supabase } from "../services/supabase";
import { transitionOptions } from "./presentationOptions";

interface BusinessAppearanceProfile {
  name: string;
  nickname: string | null;
  icon: string | null;
  og_image_url: string | null;
  pwa_icon_512: string | null;
  phone: string | null;
  whatsapp: string | null;
  tagline: string | null;
  instagram_url: string | null;
  schema_street: string | null;
  schema_city: string | null;
  schema_state: string | null;
}

interface BulkContentGroup {
  mediaId: string;
  item: TvPlaylistRecord;
  displayIds: string[];
}

const PAGE_SIZE = 12;

export function BulkAppearancePage({
  companyId,
  items,
  onBack,
  onSaved,
}: {
  companyId: string;
  items: TvPlaylistRecord[];
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [applyTransition, setApplyTransition] = useState(true);
  const [transitionType, setTransitionType] = useState<TvTransitionType>("fade");
  const [transitionDurationMs, setTransitionDurationMs] = useState(700);
  const [applyWatermark, setApplyWatermark] = useState(true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkName, setWatermarkName] = useState("");
  const [watermarkPhone, setWatermarkPhone] = useState("");
  const [watermarkExtraText, setWatermarkExtraText] = useState("");
  const [watermarkLogoMediaId, setWatermarkLogoMediaId] = useState<string | null>(null);
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState("");
  const [business, setBusiness] = useState<BusinessAppearanceProfile | null>(null);
  const [logos, setLogos] = useState<TvMediaRecord[]>([]);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewRun, setPreviewRun] = useState(0);

  const contents = useMemo<BulkContentGroup[]>(() => {
    const groups = new Map<string, { item: TvPlaylistRecord; displayIds: Set<string> }>();
    for (const item of items) {
      const current = groups.get(item.media_id);
      if (current) current.displayIds.add(item.display_id);
      else groups.set(item.media_id, { item, displayIds: new Set([item.display_id]) });
    }
    return Array.from(groups, ([mediaId, group]) => ({
      mediaId,
      item: group.item,
      displayIds: Array.from(group.displayIds),
    }));
  }, [items]);

  const filteredContents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return contents.filter(({ item }) => {
      const matchesType = typeFilter === "all" || item.media.media_type === typeFilter;
      const matchesSearch = !term || item.media.title.toLocaleLowerCase("pt-BR").includes(term);
      return matchesType && matchesSearch;
    });
  }, [contents, search, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredContents.length / PAGE_SIZE));
  const pagedContents = filteredContents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedSet = useMemo(() => new Set(selectedMediaIds), [selectedMediaIds]);
  const allFilteredSelected = filteredContents.length > 0 && filteredContents.every((content) => selectedSet.has(content.mediaId));
  const previewContent = contents.find((content) => selectedSet.has(content.mediaId)) ?? contents[0];
  const selectedLogo = logos.find((logo) => logo.id === watermarkLogoMediaId);
  const finalLogoUrl = selectedLogo?.public_url ?? selectedLogo?.media_url ?? watermarkLogoUrl;

  const fillFromBusiness = useCallback((profile: BusinessAppearanceProfile) => {
    setWatermarkName(profile.name || profile.nickname || "");
    setWatermarkPhone(profile.whatsapp || profile.phone || "");
    setWatermarkExtraText(profile.tagline || businessAddress(profile));
    setWatermarkLogoMediaId(null);
    setWatermarkLogoUrl(profile.icon || profile.og_image_url || profile.pwa_icon_512 || "");
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const load = async () => {
      setLoadingDefaults(true);
      const [businessResult, logosResult] = await Promise.all([
        client
          .from("business")
          .select("name,nickname,icon,og_image_url,pwa_icon_512,phone,whatsapp,tagline,instagram_url,schema_street,schema_city,schema_state")
          .eq("cnpj", companyId)
          .maybeSingle(),
        client
          .from("tv_media")
          .select("id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider")
          .eq("company_id", companyId)
          .eq("media_type", "image")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (businessResult.error || logosResult.error) {
        setError(businessResult.error?.message ?? logosResult.error?.message ?? "Não foi possível carregar os dados da empresa.");
      }
      const profile = businessResult.data as BusinessAppearanceProfile | null;
      setBusiness(profile);
      setLogos((logosResult.data ?? []) as TvMediaRecord[]);
      if (profile) fillFromBusiness(profile);
      setLoadingDefaults(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [companyId, fillFromBusiness]);

  const toggleMedia = (mediaId: string) => {
    setSelectedMediaIds((current) =>
      current.includes(mediaId) ? current.filter((id) => id !== mediaId) : [...current, mediaId],
    );
    setSuccess(null);
  };

  const toggleAllFiltered = () => {
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredContents.forEach((content) => next.delete(content.mediaId));
      else filteredContents.forEach((content) => next.add(content.mediaId));
      return Array.from(next);
    });
    setSuccess(null);
  };

  const apply = async () => {
    if (!supabase) return;
    setError(null);
    setSuccess(null);
    if (!selectedMediaIds.length) {
      setError("Selecione pelo menos um conteúdo.");
      return;
    }
    if (!applyTransition && !applyWatermark) {
      setError("Escolha aplicar a animação, a marca d'água ou ambas.");
      return;
    }
    const logoUrl = watermarkLogoUrl.trim();
    if (applyWatermark && watermarkEnabled && logoUrl && !logoUrl.startsWith("https://")) {
      setError("A URL do logo precisa começar com https://.");
      return;
    }
    if (
      applyWatermark && watermarkEnabled && !watermarkLogoMediaId && !logoUrl &&
      !watermarkName.trim() && !watermarkPhone.trim() && !watermarkExtraText.trim()
    ) {
      setError("Informe ao menos um dado para a marca d'água.");
      return;
    }
    const changes: Record<string, string | number | boolean | null> = {};
    if (applyTransition) {
      changes.transition_type = transitionType;
      changes.transition_duration_ms = transitionDurationMs;
    }
    if (applyWatermark) {
      changes.watermark_enabled = watermarkEnabled;
      changes.watermark_name = watermarkEnabled ? watermarkName.trim() || null : null;
      changes.watermark_phone = watermarkEnabled ? watermarkPhone.trim() || null : null;
      changes.watermark_extra_text = watermarkEnabled ? watermarkExtraText.trim() || null : null;
      changes.watermark_logo_media_id = watermarkEnabled ? watermarkLogoMediaId : null;
      changes.watermark_logo_url = watermarkEnabled && !watermarkLogoMediaId ? logoUrl || null : null;
    }
    setSaving(true);
    try {
      const { data, error: updateError } = await supabase
        .from("tv_playlist_items")
        .update(changes)
        .eq("company_id", companyId)
        .in("media_id", selectedMediaIds)
        .select("id,media_id");
      if (updateError) throw updateError;
      const updatedMedia = new Set((data ?? []).map((row) => row.media_id));
      if (updatedMedia.size !== selectedMediaIds.length)
        throw new Error("Alguns conteúdos não foram encontrados ou não pertencem à empresa conectada.");
      await onSaved();
      setSuccess(`Aparência aplicada a ${updatedMedia.size} conteúdo(s), em todas as TVs onde estão programados.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível aplicar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bulk-appearance-page">
      <div className="page-header bulk-page-header">
        <div>
          <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16} /> Voltar para programação</button>
          <h1>Aplicar aparência em massa</h1>
          <p>Selecione vários conteúdos e configure a mesma animação ou marca d'água de uma só vez.</p>
        </div>
        <div className="bulk-header-count"><strong>{selectedMediaIds.length}</strong><span>selecionados</span></div>
      </div>

      {error ? <div className="system-alert error" role="alert">{error}</div> : null}
      {success ? <div className="system-alert success" role="status"><Check size={18} /><span>{success}</span></div> : null}

      <div className="bulk-appearance-layout">
        <section className="card bulk-content-selector">
          <div className="bulk-section-heading"><span>1</span><div><h2>Escolha os conteúdos</h2><p>Cada conteúdo será atualizado em todas as TVs onde está programado.</p></div></div>
          <div className="bulk-filters">
            <label className="bulk-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Buscar conteúdo" /></label>
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(0); }} aria-label="Filtrar por tipo">
              <option value="all">Todos os tipos</option>
              <option value="image">Imagens</option>
              <option value="video">Vídeos</option>
              <option value="message">Textos</option>
            </select>
          </div>
          <label className="bulk-select-all"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} /><span><strong>Selecionar resultados</strong><small>{filteredContents.length} conteúdo(s) encontrados</small></span></label>
          <div className="bulk-content-list">
            {pagedContents.map((content) => (
              <BulkContentOption key={content.mediaId} content={content} selected={selectedSet.has(content.mediaId)} onToggle={toggleMedia} />
            ))}
            {!pagedContents.length ? <div className="empty compact"><p>Nenhum conteúdo encontrado.</p></div> : null}
          </div>
          {pageCount > 1 ? (
            <div className="media-pagination"><button type="button" className="button secondary" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Anterior</button><span>Página {page + 1} de {pageCount}</span><button type="button" className="button secondary" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Próxima</button></div>
          ) : null}
        </section>

        <section className="card bulk-configuration">
          <div className="bulk-section-heading"><span>2</span><div><h2>Defina o que aplicar</h2><p>Ative somente as configurações que deseja substituir.</p></div></div>

          <BulkToggle checked={applyTransition} onChange={setApplyTransition} icon={<Sparkles size={18} />} title="Aplicar a mesma animação" description="Substitui a transição dos conteúdos selecionados." />
          {applyTransition ? (
            <div className="bulk-setting-body">
              <div className="transition-option-grid bulk-transition-grid">
                {transitionOptions.map((option) => (
                  <button key={option.value} type="button" aria-pressed={transitionType === option.value} className={transitionType === option.value ? "selected" : ""} onClick={() => { setTransitionType(option.value); setPreviewRun((run) => run + 1); }}>
                    <span className={`transition-swatch transition-swatch-${option.value}`} aria-hidden="true"><i /></span>
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    {transitionType === option.value ? <Check className="transition-selected-icon" size={17} /> : null}
                  </button>
                ))}
              </div>
              <label className="transition-speed-control"><span><strong>Duração</strong><b>{(transitionDurationMs / 1000).toFixed(1)} s</b></span><input type="range" min={200} max={2500} step={100} disabled={transitionType === "none"} value={transitionDurationMs} onChange={(event) => setTransitionDurationMs(Number(event.target.value))} /><small><span>Mais rápida</span><span>Mais suave</span></small></label>
            </div>
          ) : null}

          <BulkToggle checked={applyWatermark} onChange={setApplyWatermark} icon={<Building2 size={18} />} title="Aplicar a mesma marca d'água" description="Use o cadastro da empresa como ponto de partida e edite livremente." />
          {applyWatermark ? (
            <div className="bulk-setting-body">
              <label className="watermark-toggle"><input type="checkbox" checked={watermarkEnabled} onChange={(event) => setWatermarkEnabled(event.target.checked)} /><span><strong>Exibir marca d'água</strong><small>Desmarque para remover a marca dos conteúdos selecionados.</small></span></label>
              {watermarkEnabled ? (
                <>
                  <div className="business-prefill-row"><div><Building2 size={17} /><span><strong>Dados da empresa</strong><small>{loadingDefaults ? "Carregando cadastro..." : business ? "Informações encontradas no Supabase" : "Cadastro não encontrado"}</small></span></div><button type="button" className="button secondary" disabled={!business} onClick={() => business && fillFromBusiness(business)}>Preencher novamente</button></div>
                  <div className="watermark-fields bulk-watermark-fields">
                    <label>Nome ou marca<input maxLength={80} value={watermarkName} onChange={(event) => setWatermarkName(event.target.value)} /></label>
                    <label>Telefone / WhatsApp<input maxLength={40} value={watermarkPhone} onChange={(event) => setWatermarkPhone(event.target.value)} /></label>
                    <label className="watermark-extra-field">Informação complementar<input maxLength={160} value={watermarkExtraText} onChange={(event) => setWatermarkExtraText(event.target.value)} /></label>
                  </div>
                  {business ? <BusinessSuggestions business={business} onSelect={setWatermarkExtraText} /> : null}
                  <fieldset className="bulk-logo-picker"><legend>Logo</legend><label>URL HTTPS do logo<input type="url" maxLength={2048} value={watermarkLogoUrl} onChange={(event) => { setWatermarkLogoMediaId(null); setWatermarkLogoUrl(event.target.value); }} placeholder="https://site.com/logo.png" /></label>{logos.length ? <label>Ou escolha uma imagem da biblioteca<select value={watermarkLogoMediaId ?? ""} onChange={(event) => { setWatermarkLogoMediaId(event.target.value || null); if (event.target.value) setWatermarkLogoUrl(""); }}><option value="">Usar URL acima</option>{logos.map((logo) => <option key={logo.id} value={logo.id}>{logo.title}</option>)}</select></label> : null}</fieldset>
                </>
              ) : null}
            </div>
          ) : null}

          <BulkPreview content={previewContent} transitionType={applyTransition ? transitionType : "none"} transitionDurationMs={transitionDurationMs} watermarkEnabled={applyWatermark && watermarkEnabled} watermarkName={watermarkName} watermarkPhone={watermarkPhone} watermarkExtraText={watermarkExtraText} logoUrl={finalLogoUrl} previewRun={previewRun} />
        </section>
      </div>

      <div className="bulk-save-bar"><div><strong>{selectedMediaIds.length} conteúdo(s) selecionado(s)</strong><span>As TVs serão atualizadas automaticamente após salvar.</span></div><button type="button" className="button primary" disabled={saving || !selectedMediaIds.length} onClick={() => void apply()}>{saving ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />} Aplicar configurações</button></div>
    </div>
  );
}

function BulkToggle({ checked, onChange, icon, title, description }: { checked: boolean; onChange: (checked: boolean) => void; icon: React.ReactNode; title: string; description: string }) {
  return <label className={`bulk-setting-toggle${checked ? " enabled" : ""}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="bulk-setting-icon">{icon}</span><span><strong>{title}</strong><small>{description}</small></span></label>;
}

function BulkContentOption({ content, selected, onToggle }: { content: BulkContentGroup; selected: boolean; onToggle: (mediaId: string) => void }) {
  const { item } = content;
  const mediaUrl = item.media.public_url ?? item.media.media_url;
  const icon = item.media.media_type === "video" ? <Video size={19} /> : item.media.media_type === "message" ? <MessageSquareText size={19} /> : <FileImage size={19} />;
  return (
    <label className={`bulk-content-option${selected ? " selected" : ""}`}>
      <input type="checkbox" checked={selected} onChange={() => onToggle(content.mediaId)} />
      <span className="bulk-content-thumb">{item.media.media_type === "image" && mediaUrl ? <img src={mediaUrl} alt="" loading="lazy" /> : icon}</span>
      <span className="bulk-content-copy"><strong>{item.media.title}</strong><small>{content.displayIds.length} TV(s) · {item.media.media_type === "video" ? "Vídeo" : item.media.media_type === "message" ? "Texto" : "Imagem"}</small><span>{item.transition_type && item.transition_type !== "none" ? "Com animação" : "Sem animação"}{item.watermark_enabled ? " · Com marca d'água" : ""}</span></span>
      {selected ? <Check className="bulk-content-check" size={17} /> : null}
    </label>
  );
}

function BusinessSuggestions({ business, onSelect }: { business: BusinessAppearanceProfile; onSelect: (value: string) => void }) {
  const suggestions = [
    business.tagline ? { label: "Usar slogan", value: business.tagline } : null,
    businessAddress(business) ? { label: "Usar endereço", value: businessAddress(business) } : null,
    business.instagram_url ? { label: "Usar Instagram", value: business.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@") } : null,
  ].filter((suggestion): suggestion is { label: string; value: string } => Boolean(suggestion));
  return suggestions.length ? <div className="business-suggestions"><span>Sugestões:</span>{suggestions.map((suggestion) => <button key={suggestion.label} type="button" onClick={() => onSelect(suggestion.value)}>{suggestion.label}</button>)}</div> : null;
}

function BulkPreview({ content, transitionType, transitionDurationMs, watermarkEnabled, watermarkName, watermarkPhone, watermarkExtraText, logoUrl, previewRun }: { content?: BulkContentGroup; transitionType: TvTransitionType; transitionDurationMs: number; watermarkEnabled: boolean; watermarkName: string; watermarkPhone: string; watermarkExtraText: string; logoUrl: string; previewRun: number }) {
  const mediaUrl = content?.item.media.public_url ?? content?.item.media.media_url;
  return <div className="bulk-preview"><div className="presentation-preview-heading"><strong>Prévia</strong><span>{content?.item.media.title ?? "Selecione um conteúdo"}</span></div><div key={`${transitionType}-${transitionDurationMs}-${previewRun}`} className={`presentation-preview transition-preview-${transitionType}`} style={{ "--transition-duration": `${transitionDurationMs}ms` } as React.CSSProperties}>{content?.item.media.media_type === "image" && mediaUrl ? <img src={mediaUrl} alt="Prévia" /> : content?.item.media.media_type === "video" && mediaUrl ? <video src={mediaUrl} preload="metadata" muted playsInline /> : <div className="presentation-preview-message">{content?.item.media.message_text || content?.item.media.title || "Seu conteúdo"}</div>}{watermarkEnabled ? <div className="tv-watermark preview-watermark">{logoUrl ? <img src={logoUrl} alt="" /> : null}<div>{watermarkName ? <strong>{watermarkName}</strong> : null}{watermarkExtraText ? <span>{watermarkExtraText}</span> : null}</div>{watermarkPhone ? <b>{watermarkPhone}</b> : null}</div> : null}</div></div>;
}

function businessAddress(business: BusinessAppearanceProfile) {
  const city = [business.schema_city, business.schema_state].filter(Boolean).join("/");
  return [business.schema_street, city].filter(Boolean).join(" · ").slice(0, 160);
}

export default BulkAppearancePage;
