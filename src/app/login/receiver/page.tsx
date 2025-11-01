"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ReceiverLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (profile?.role === "receiver") {
        router.push("/receiver");
      } else {
        setErrorMsg("Not a receiver account");
      }
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-50">
      <form
        onSubmit={handleLogin}
        className="bg-card/80 backdrop-blur-md p-8 rounded-2xl shadow-lg w-96 border border-border transition-all duration-300 hover:shadow-xl"
      >
        <h2 className="text-3xl font-bold mb-6 text-center text-primary-foreground">
          Receiver Login
        </h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white/90 text-foreground placeholder:text-muted-foreground transition"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-6 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white/90 text-foreground placeholder:text-muted-foreground transition"
        />

        <button
          type="submit"
          className="w-full p-3 rounded-xl font-semibold text-primary-foreground bg-primary hover:bg-green-500 transition-transform transform hover:scale-[1.02] shadow-md"
        >
          Login
        </button>

        {errorMsg && (
          <div className="mt-4 text-center text-red-600 font-medium bg-red-50 p-2 rounded-lg">
            {errorMsg}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don’t have an account?{" "}
          <Link
            href="/signup/receiver"
            className="text-primary font-semibold hover:underline"
          >
            Signup
          </Link>
        </p>
      </form>
    </div>
  );
}
