import { SlimNav } from "../../components/SlimNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <SlimNav />
      {children}
    </div>
  );
}
