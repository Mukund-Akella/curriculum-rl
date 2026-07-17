export default function Header() {
  return (
    <header className="border-b border-white/10 bg-[#0d0d0d]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-xs font-medium uppercase tracking-widest text-[#898781]">
          Reinforcement Learning · Simulation Report
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          Curriculum RL — Wheeled Robot Terrain Traversal
        </h1>
        <p className="mt-3 flex items-start gap-2 text-sm text-[#c3c2b7] sm:text-base">
          <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#0ca30c]" />
          <span>
            Curriculum learning achieved{" "}
            <span className="font-semibold text-white">15% higher episode survival</span>{" "}
            on difficulty-5 terrain vs. direct training.
          </span>
        </p>
      </div>
    </header>
  );
}
