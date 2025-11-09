"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ReceiverSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.user) {
      try {
        await supabase.from("profiles").insert([
          { id: data.user.id, role: "receiver", mobile_number: mobileNumber },
        ]);
      } catch (e: any) {
        console.error("Failed to insert profile:", e?.message || e);
      }

      setMessage(
        "A verification email has been sent to your email address. Please verify before logging in."
      );
      // optional redirect after a short delay
      // setTimeout(() => router.push('/login/receiver'), 4000);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-50">
      <form
        onSubmit={handleSignup}
        className="bg-card/80 backdrop-blur-md p-8 rounded-2xl shadow-lg w-96 border border-border transition-all duration-300 hover:shadow-xl"
      >
        <h2 className="text-3xl font-bold mb-6 text-center text-primary-foreground">
          Receiver Signup
        </h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          suppressHydrationWarning
          className="w-full p-3 mb-4 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white/90 text-foreground placeholder:text-muted-foreground transition"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          suppressHydrationWarning
          className="w-full p-3 mb-4 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white/90 text-foreground placeholder:text-muted-foreground transition"
        />

        <input
          type="tel"
          placeholder="Mobile Number"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          suppressHydrationWarning
          className="w-full p-3 mb-6 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white/90 text-foreground placeholder:text-muted-foreground transition"
        />

        <button
          type="submit"
          className="w-full p-3 rounded-xl font-semibold text-primary-foreground bg-primary hover:bg-green-500 transition-transform transform hover:scale-[1.02] shadow-md"
        >
          Signup
        </button>

        {message && (
          <div className="mt-4 text-center text-green-700 font-medium bg-green-50 p-2 rounded-lg">
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
