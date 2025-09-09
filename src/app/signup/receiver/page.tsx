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

    if (data.user) {
      setMessage(
        "A verification email has been sent to your email address. Please check your inbox and verify your account before logging in."
      );

      // Update mobile_number after profile row is auto-created by trigger
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ mobile_number: mobileNumber })
        .eq("id", data.user.id);
      if (updateError) {
        console.error("Failed to update mobile number:", updateError);
      }

      // Optionally redirect or clear form here
      // setTimeout(() => router.push("/login/receiver"), 5000);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <form onSubmit={handleSignup} className="bg-white p-6 rounded-2xl shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4">Receiver Signup</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />
        <input
          type="tel"
          placeholder="Mobile Number"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />
        <button
          type="submit"
          className="w-full bg-green-500 text-white p-2 rounded-xl hover:bg-green-600"
        >
          Signup
        </button>
        {message && (
          <div className="mt-4 text-center text-green-600">{message}</div>
        )}
      </form>
    </div>
  );
}
