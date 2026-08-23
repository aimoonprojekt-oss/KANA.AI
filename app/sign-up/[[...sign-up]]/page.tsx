import { SignUp } from "@clerk/nextjs";
import ZugangRahmen, { clerkHell } from "@/app/components/ui/ZugangRahmen";

export const metadata = { title: "Registrieren — KANA AI" };

export default function SignUpPage() {
  return (
    <ZugangRahmen modus="registrieren">
      <SignUp appearance={clerkHell} signInUrl="/sign-in" />
    </ZugangRahmen>
  );
}
