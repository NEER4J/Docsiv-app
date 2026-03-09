"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/use-auth";

const FormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  remember: z.boolean().optional(),
});

const ERROR_MESSAGES: Record<string, string> = {
  callback_error: "Sign-in was interrupted. Please try again.",
  no_code: "Sign-in link was invalid or expired. Please try again.",
  session_missing: "Session could not be restored. Please sign in again.",
};

export function LoginForm({ redirectNext, errorFromUrl }: { redirectNext?: string; errorFromUrl?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (errorFromUrl) {
      toast.error(ERROR_MESSAGES[errorFromUrl] ?? "Something went wrong. Please try again.");
    }
  }, [errorFromUrl]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    
    const { error } = await signIn(data.email, data.password);
    
    if (error) {
      toast.error("Login failed", {
        description: error,
      });
    } else {
      toast.success("Login successful", {
        description: redirectNext ? "Redirecting..." : "Redirecting to documents...",
      });
      router.push(redirectNext ?? "/dashboard/documents");
    }
    
    setIsLoading(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="remember"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center">
              <FormControl>
                <Checkbox
                  id="login-remember"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="size-4"
                />
              </FormControl>
              <FormLabel htmlFor="login-remember" className="text-muted-foreground ml-1 text-sm font-medium">
                Remember me for 30 days
              </FormLabel>
            </FormItem>
          )}
        />
        <div className="flex items-center justify-between">
          <Link 
            href={redirectNext ? `/auth/forgot-password?next=${encodeURIComponent(redirectNext)}` : "/auth/forgot-password"}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <Button className="w-full" type="submit" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
