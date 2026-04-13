export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 px-4 py-12">
      <div className="max-w-3xl mx-auto">{children}</div>
    </div>
  );
}
