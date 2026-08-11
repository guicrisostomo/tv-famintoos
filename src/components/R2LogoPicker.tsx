import { Image, LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { TvMediaRecord } from "../hooks/useTvData";
import { listUnregisteredR2Objects, type R2ExistingObject } from "../services/storage";
import { importStoredWatermarkLogo } from "../services/watermarkLogo";

export function R2LogoPicker({
  companyId,
  onSelected,
}: {
  companyId: string;
  onSelected: (logo: TvMediaRecord) => void;
}) {
  const [objects, setObjects] = useState<R2ExistingObject[] | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const available = (await listUnregisteredR2Objects()).filter((item) => item.type === "image");
      setObjects(available);
      setSelectedKey((current) => available.some((item) => item.key === current) ? current : "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível listar as imagens do R2.");
    } finally {
      setLoading(false);
    }
  };

  const choose = async () => {
    const selected = objects?.find((item) => item.key === selectedKey);
    if (!selected) return;
    setImporting(true);
    setError(null);
    try {
      const logo = await importStoredWatermarkLogo(companyId, selected.key, selected.filename);
      onSelected(logo);
      setObjects((current) => current?.filter((item) => item.key !== selected.key) ?? []);
      setSelectedKey("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível usar a imagem do R2.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="r2-logo-picker">
      <button type="button" className="button secondary" disabled={loading || importing} onClick={() => void load()}>
        {loading ? <LoaderCircle className="spin" size={16} /> : objects ? <RefreshCw size={16} /> : <Image size={16} />}
        {loading ? "Buscando imagens..." : objects ? "Atualizar imagens do R2" : "Escolher imagem armazenada no R2"}
      </button>
      {objects ? (
        objects.length ? (
          <div className="r2-logo-choice">
            <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} aria-label="Imagem disponível no R2">
              <option value="">Selecione uma imagem do R2</option>
              {objects.map((item) => <option key={item.key} value={item.key}>{item.filename}</option>)}
            </select>
            <button type="button" className="button secondary" disabled={!selectedKey || importing} onClick={() => void choose()}>
              {importing ? <LoaderCircle className="spin" size={16} /> : null}
              {importing ? "Vinculando..." : "Usar como logo"}
            </button>
          </div>
        ) : <small>Todas as imagens do R2 já estão cadastradas na biblioteca.</small>
      ) : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
    </div>
  );
}
