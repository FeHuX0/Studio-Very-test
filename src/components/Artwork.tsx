import { useId, useMemo } from 'react';
import { exportSvg } from '../services/SvgExportService';
import { coloredSvg, sourceFor } from '../services/PaletteService';
import type { Asset, Composition, PaletteId } from '../types';

export function AssetArtwork({ asset, palette }: { asset: Asset; palette: PaletteId }) {
  const scope = useId();
  const markup = useMemo(() => {
    const role = sourceFor(asset, 'main', 'S') ? 'main' : 'background';
    return coloredSvg(asset, role, 'S', palette, `thumb-${scope}-${asset.id}`);
  }, [asset, palette, scope]);
  return <span className="asset-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}
export function CompositionArtwork({ composition, assets }: { composition: Composition; assets: Asset[] }) {
  const scope = useId();
  const markup = useMemo(() => {
    try { return exportSvg(composition, assets, scope).replace(/^<\?xml[^>]*>\s*/, ''); }
    catch { return ''; }
  }, [composition, assets, scope]);
  return <span className="composition-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}
