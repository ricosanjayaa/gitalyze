"use client";

import { motion } from "motion/react";
import { ModeToggle } from "@/components/mode-toggle";
import { SearchInput } from "@/components/SearchInput";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden selection:bg-primary selection:text-primary-foreground">
      <div className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition-opacity">
        <ModeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-3xl px-4 sm:px-6 text-center flex flex-col items-center"
      >
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground font-sans">Github analytics, reimagined</h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto font-sans">Track the performance, diversity, and maturity of any repository or developer profile.</p>
      </div>
      <div className="mt-8 w-full max-w-2xl">
        <SearchInput />
      </div>

        <div className="mt-16 sm:mt-20 grid grid-cols-3 gap-6 sm:gap-8 md:gap-16 text-xs md:text-sm text-muted-foreground/40 font-mono uppercase tracking-widest tabular-nums">
          <div className="font-sans">No Tracking</div>
          <div className="font-sans">Open Source</div>
          <div className="font-sans">Fast</div>
        </div>
      </motion.div>
    </div>
  );
}
