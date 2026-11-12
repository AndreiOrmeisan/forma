export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="min-w-24 text-right">
      <p className="text-xs text-[#706a62]">{current} din {total}</p>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={`h-1 flex-1 rounded-full ${index < current ? "bg-primary" : "bg-accent"}`} />
        ))}
      </div>
    </div>
  );
}
