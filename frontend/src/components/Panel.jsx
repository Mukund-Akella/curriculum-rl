export default function Panel({ title, description, controls, children }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#1a1a19] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#898781]">{description}</p>
        </div>
        {controls ? <div className="shrink-0">{controls}</div> : null}
      </div>
      {children}
    </section>
  );
}
