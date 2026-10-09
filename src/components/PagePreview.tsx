import { useEffect, useRef, useState } from 'react';
import type { PageInfo, SplitterController } from '../types';

export function PageImage({ page, alt = '', className = '' }: { page?: PageInfo; alt?: string; className?: string }) {
  if (!page) return <div className={`page-image page-placeholder ${className}`} aria-hidden="true" />;
  return <img className={`page-image ${className}`} src={page.thumbnail} alt={alt} draggable={false} />;
}

export function RenderedPage({ controller, page, width, label }: { controller: SplitterController; page: number; width: number; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [readyPage, setReadyPage] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const abort = new AbortController();
    setFailed(false);
    setReadyPage(null);
    controller.render(page, canvas, width, abort.signal)
      .then(() => { if (!abort.signal.aborted) setReadyPage(page); })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [controller.render, page, width]);

  return (
    <div className={`rendered-page ${readyPage === page ? 'ready' : 'rendering'}`} aria-label={label}>
      <canvas key={page} ref={canvasRef} />
      {readyPage !== page && !failed && <span className="render-loading"><i className="spinner" />Rendering page…</span>}
      {failed && <span className="render-error">Preview unavailable</span>}
    </div>
  );
}
