type FamintoosBrandProps = {
  className?: string;
};

export function FamintoosBrand({ className = '' }: FamintoosBrandProps) {
  return (
    <div className={`famintoos-brand ${className}`.trim()} aria-label="Famintoos TV">
      <span className="famintoos-brand-mark" aria-hidden="true">
        <img src="/famintoos-mark.svg" alt="" />
      </span>
      <span className="famintoos-brand-copy">
        <strong>Famintoos</strong>
        <small>TV</small>
      </span>
    </div>
  );
}
