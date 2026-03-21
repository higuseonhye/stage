import { Separator } from "@/components/ui/separator";

export default function DirectorLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-8 px-4 py-8">
      <div className="flex justify-between gap-4">
        <div className="space-y-3">
          <div className="bg-muted h-4 w-24 rounded" />
          <div className="bg-muted h-8 max-w-md rounded-md" />
          <div className="bg-muted h-4 max-w-xl rounded" />
        </div>
        <div className="bg-muted h-7 w-28 rounded-full" />
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="bg-muted h-3 w-40 rounded" />
        <div className="bg-muted h-32 rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="bg-muted h-3 w-36 rounded" />
        <div className="bg-muted h-24 rounded-lg" />
      </div>
    </div>
  );
}
