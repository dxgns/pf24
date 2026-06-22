type FeatureCardProps = {
  title: string;
  text: string;
};

export default function FeatureCard({ title, text }: FeatureCardProps) {
  return (
    <div className="card p-8">
      <h3 className="mb-4 text-xl font-bold text-sky-400">{title}</h3>
      <p className="text-slate-300">{text}</p>
    </div>
  );
}