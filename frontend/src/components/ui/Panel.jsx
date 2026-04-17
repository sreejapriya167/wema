export function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`glass-strong rounded-[1.75rem] p-6 shadow-panel ${className}`}>
      <div className="mb-5">
        <h2 className="ui-title text-xl font-semibold">{title}</h2>
        {subtitle ? <p className="ui-subtext mt-1 text-sm">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

