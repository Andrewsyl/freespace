import { SlimNav } from "../../components/SlimNav";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <SlimNav />
      {children}
    </div>
  );
}
