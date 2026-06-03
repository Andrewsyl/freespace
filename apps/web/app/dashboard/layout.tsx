import { SlimNav } from "../../components/SlimNav";
import { DashboardShell } from "../../components/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <SlimNav />
      <DashboardShell>
        {children}
      </DashboardShell>
    </div>
  );
}
