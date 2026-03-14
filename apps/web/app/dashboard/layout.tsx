import { SlimNav } from "../../components/SlimNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SlimNav />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
