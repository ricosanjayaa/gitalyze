import { Suspense } from "react";
import RedirectPage from "@/views/Redirect";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RedirectPage />
    </Suspense>
  );
}
