type FamintoosBrandProps = {
  className?: string;
};

export function FamintoosBrand({ className = '' }: FamintoosBrandProps) {
  return (
    <div className={`famintoos-brand ${className}`.trim()} role="img" aria-label="Famintoos TV">
      <span className="famintoos-brand-logo" aria-hidden="true">
        <span className="famintoos-brand-crop">
          <img src="/logo.png" alt="" decoding="async" fetchPriority="high" />
        </span>
      </span>
      <span className="famintoos-product-name">TV</span>
    </div>
  );
}
