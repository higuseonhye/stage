import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground flex min-h-full flex-col items-center justify-center px-4 py-16 text-sm">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
