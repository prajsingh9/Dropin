import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthScreen />
    </Suspense>
  );
}
