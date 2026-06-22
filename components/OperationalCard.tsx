type OperationalCardProps = {
  label: string;
  value: string;
  sub?: string;
};

export default function OperationalCard({ label, value, sub }: OperationalCardProps) {
  return (
    <div className="panel rounded-2xl p-5">
      <p className="mono text-xs uppercase text-sky-300/70">{label}</p>
      <p className="mono mt-2 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}