import type { Metadata } from "next";

import ForgotPasswordPage from "@/app/auth/forgot-password/page";

export const metadata: Metadata = {
  title: "Magic link",
  description: "Email sign-in and password reset flow.",
};

export default ForgotPasswordPage;
