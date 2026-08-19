type FamintoosBrandProps = {
  className?: string;
};

const FAMINTOOS_LOGO_URL = 'https://famintoos.com.br/logo.png';

export function FamintoosBrand({ className = '' }: FamintoosBrandProps) {
  return (
    <div
      className={`famintoos-brand ${className}`.trim()}
      role="img"
      aria-label="Famintoos TV"
    >
      <span className="famintoos-brand-logo" aria-hidden="true">
        <img src={FAMINTOOS_LOGO_URL} alt="" fetchPriority="high" />
      </span>
      <span className="famintoos-product-name">TV</span>
    </div>
  );
}
