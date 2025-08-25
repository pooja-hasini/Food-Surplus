'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, HandHeart, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export function UserTypeSelection() {
  const cardVariants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
  };

  return (
    <div className="container flex max-w-4xl flex-col items-center justify-center gap-8 py-10 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }}>
        <HandHeart className="mx-auto h-20 w-20 text-primary" />
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-primary-foreground">
          Welcome to FoodBridge
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Connecting surplus food with those who need it most.
          <br />
          Choose your role to get started.
        </p>
      </motion.div>

      <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
        {/* Donor Card */}
        <motion.div variants={cardVariants} initial="initial" animate="animate" transition={{ delay: 0.4, duration: 0.5 }}>
          <Link href="/login/donor">
            <Card className="group transform cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-2xl hover:border-primary">
              <CardHeader>
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <HandHeart className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-semibold">I am a Donor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Share your surplus food and make a difference in your community. Help reduce food waste and support those in need.
                </p>
                <div className="mt-6 flex items-center justify-center text-primary font-semibold transition-transform duration-300 group-hover:translate-x-1">
                  Login / Signup <ArrowRight className="ml-2 h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
        {/* Receiver Card */}
        <motion.div variants={cardVariants} initial="initial" animate="animate" transition={{ delay: 0.6, duration: 0.5 }}>
          <Link href="/login/receiver">
            <Card className="group transform cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-2xl hover:border-primary">
              <CardHeader>
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Users className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-semibold">I am a Receiver</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Find available food donations near you from generous donors. Get the support you need for yourself or your organization.
                </p>
                <div className="mt-6 flex items-center justify-center text-primary font-semibold transition-transform duration-300 group-hover:translate-x-1">
                  Login / Signup <ArrowRight className="ml-2 h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}