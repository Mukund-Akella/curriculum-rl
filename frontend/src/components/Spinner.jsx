export default function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#898781]">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[#3987e5]" />
      <span>{label}</span>
    </div>
  );
}
