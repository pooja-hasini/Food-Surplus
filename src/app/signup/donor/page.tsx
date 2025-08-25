"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DonorSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); // Clear previous messages
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.user) {
      await supabase.from("profiles").insert([{ id: data.user.id, role: "donor" }]);
      setMessage("A verification email has been sent to your email address. Please check your inbox and verify your account before logging in.");
      // Optionally, you can redirect after a delay:
      // setTimeout(() => router.push("/login/donor"), 5000);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <form onSubmit={handleSignup} className="bg-white p-6 rounded-2xl shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4">Donor Signup</h2>
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 border rounded"/>
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded"/>
        <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded-xl hover:bg-blue-600">
          Signup
        </button>
        {message && (
          <div className="mt-4 text-center text-green-600">{message}</div>
        )}
      </form>
    </div>
  );
}