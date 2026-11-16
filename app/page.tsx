"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, Moon, Package, ScanFace } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DropinLogo } from "@/components/brand/logo";
import { useDropin } from "@/components/providers/dropin-provider";
import warm from "@/public/images/dropin-collector-warm.jpg";
import ember from "@/public/images/dropin-collector-ember.jpg";
import side from "@/public/images/dropin-collector-side.jpg";

const SLIDES: { image: StaticImageData; eyebrow: string; title: string[]; body: string; chip: { icon: React.ReactNode; text: string }; position: string }[] = [
  {
    image: warm,
    eyebrow: "Welcome to Dropin",
    title: ["Smart", "parcel", "collection"],
    body: "Receive the world at your doorstep — even when you're not home.",
    chip: { icon: <Package className="size-4" />, text: "Parcel received · DHL" },
    position: "62% 30%",
  },
  {
    image: ember,
    eyebrow: "How it works",
    title: ["Dropped in.", "Locked.", "Yours."],
    body: "Couriers deposit parcels into a secure compartment. It locks itself, snaps a photo, and lets you know.",
    chip: { icon: <span className="size-2 rounded-full bg-accent" />, text: "Compartment locked" },
    position: "50% 30%",
  },
  {
    image: side,
    eyebrow: "Doorbell & monitor",
    title: ["Know who's", "at the door"],
    body: "See and speak to visitors, let them in from anywhere — and keep nights silent with quiet hours.",
    chip: { icon: <Moon className="size-4" />, text: "Quiet hours · 12–7 AM" },
    position: "40% 40%",
  },
];

export default function WelcomePage() {
  const { status } = useDropin();
  const router = useRouter();
  const [i, setI] = useState(0);
  const slide = SLIDES[i]!;
  const last = i === SLIDES.length - 1;

  useEffect(() => {
    if (status === "ready") router.replace("/home");
    if (status === "needs_onboarding") router.replace("/onboarding");
  }, [status, router]);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0d0c0b] text-white lg:flex-row">
      <div className="absolute inset-0 lg:relative lg:inset-auto lg:w-[56%]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}>
            <Image src={slide.image} alt="The Dropin parcel collector" fill priority={i === 0} sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" style={{ objectPosition: slide.position }} placeholder="blur" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/85 lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-black/30" />
        <motion.div key={`chip-${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="absolute right-5 top-[38%] hidden items-center gap-2 rounded-full bg-white/14 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/15 backdrop-blur-md sm:flex lg:right-10">
          {slide.chip.icon}
          {slide.chip.text}
        </motion.div>
      </div>

      <div className="pt-safe pb-safe relative z-10 flex min-h-dvh flex-1 flex-col px-6 lg:min-h-0 lg:justify-center lg:bg-[#0d0c0b] lg:px-16">
        <div className="flex items-center justify-between pt-5 lg:absolute lg:left-16 lg:right-16 lg:top-10">
          <DropinLogo className="text-white [--bg:#0d0c0b]" />
          <Link href="/login" className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur-md hover:bg-white/20">
            Sign in
          </Link>
        </div>

        <div className="mt-auto lg:mt-0">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/60">{slide.eyebrow}</p>
              <h1 className="text-display font-semibold">
                {slide.title.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </h1>
              <p className="mt-6 max-w-[22rem] text-lg leading-snug text-white/75">{slide.body}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex gap-1.5" role="tablist" aria-label="Introduction slides">
            {SLIDES.map((_, idx) => (
              <button key={idx} role="tab" aria-selected={idx === i} aria-label={`Slide ${idx + 1}`} onClick={() => setI(idx)} className={`h-1.5 rounded-full transition-all duration-300 ${idx === i ? "w-10 bg-white" : "w-4 bg-white/30"}`} />
            ))}
          </div>

          <div className="mb-6 mt-8 flex items-center gap-3 lg:max-w-md">
            <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} aria-label="Previous" className="flex size-16 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-white/25 transition disabled:opacity-30">
              <ChevronLeft className="size-6" />
            </button>
            <button
              onClick={() => (last ? router.push("/login?intent=signup") : setI((v) => v + 1))}
              className="group flex h-16 flex-1 items-center gap-3 rounded-full bg-white/12 p-1.5 pr-6 ring-1 ring-inset ring-white/15 backdrop-blur-md transition hover:bg-white/18"
            >
              <span className={`flex size-[52px] items-center justify-center rounded-full transition-colors ${last ? "bg-accent text-white" : "bg-white text-[#111]"}`}>
                {last ? <ScanFace className="size-5" /> : <ArrowRight className="size-5" />}
              </span>
              <span className="flex-1 text-left text-[15px] font-semibold">{last ? "Set up my Dropin" : "Next"}</span>
              <span className="flex text-white/60" aria-hidden>
                {[0, 1, 2].map((k) => (
                  <ChevronLeft key={k} className="-ml-2 size-4 rotate-180 animate-chevrons" style={{ animationDelay: `${k * 0.18}s` }} />
                ))}
              </span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
