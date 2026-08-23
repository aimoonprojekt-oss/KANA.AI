import { SignIn } from "@clerk/nextjs";
import ZugangRahmen, { clerkHell } from "@/app/components/ui/ZugangRahmen";

export const metadata = { title: "Anmelden — KANA AI" };

export default function SignInPage() {
  return (
    <ZugangRahmen modus="anmelden">
      <SignIn appearance={clerkHell} signUpUrl="/sign-up" />
    </ZugangRahmen>
  );
}
