import { useEffect, useRef, useState } from 'react';
import type { PageInfo, SplitterController } from '../types';

export function PageImage({ page, alt = '', className = '' }: { page?: PageInfo; alt?: string; className?: string }) {
  if (!page) return <div className={`page-image page-placeholder ${className}`} aria-hidden="true" />;
  return <img className={`page-image ${className}`} src={page.thumbnail} alt={alt} draggable={false} />;
}

export function RenderedPage({ controller, page, width, label }: { controller: SplitterController; page: number; width: number; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const abort = new AbortController();
    setFailed(false);
    controller.render(page, canvas, width, abort.signal).catch(() => {
      if (!abort.signal.aborted) setFailed(true);
    });
    return () => abort.abort();
  }, [controller.render, page, width]);

  return (
    <div className="rendered-page" aria-label={label}>
      <canvas ref={canvasRef} />
      {failed && <span className="render-error">Preview unavailable</span>}
    </div>
  );
}
