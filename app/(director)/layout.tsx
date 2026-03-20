import { AppNav } from "@/components/AppNav";

export default function DirectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppNav />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
