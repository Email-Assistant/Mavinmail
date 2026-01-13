"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-white/20 antialiased">
      {/* ================= HERO ================= */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Cinematic Background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: "url(/hero_cinematic_dither.png)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />

        <div className="relative z-10 max-w-5xl px-6 text-center space-y-10">
          <motion.h1
            {...fadeUp}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-[clamp(3rem,6vw,6rem)] font-serif leading-[1.05] tracking-tight text-white"
          >
            Email was never meant <br /> to feel like this.
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 1, delay: 0.2 }}
            className="max-w-2xl mx-auto text-xl text-white/60 font-light leading-relaxed"
          >
            An intelligence layer for communication — understanding context,
            intent, and tone so you respond with precision.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 1, delay: 0.4 }}
            className="flex flex-col sm:flex-row justify-center gap-5 pt-4"
          >
            <Link href="/signup">
              <Button className="h-13 px-10 bg-white text-black rounded-none text-base font-medium tracking-wide hover:bg-neutral-200 shadow-[0_0_40px_rgba(255,255,255,0.15)]">
                Enter the new inbox
              </Button>
            </Link>

            <Link href="#problem">
              <Button
                variant="ghost"
                className="h-13 px-10 rounded-none text-white/50 hover:text-white hover:bg-white/5"
              >
                See how it works
                <ArrowRight className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </Link>
          </motion.div>

          <p className="pt-16 text-xs font-mono tracking-[0.3em] uppercase text-cyan-400">
            Less noise. More meaning.
          </p>
        </div>
      </section>

      {/* ================= PROBLEM ================= */}
      <section
        id="problem"
        className="relative py-40 bg-black flex items-center justify-center"
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "url(/static_noise_dither.png)" }}
        />

        <div className="relative z-10 max-w-3xl px-6 space-y-32 text-center">
          {[
            {
              title: "Important messages buried under noise.",
              text:
                "Your inbox has become a task queue designed by strangers. Signal collapsed. Focus lost.",
            },
            {
              title: "Threads that steal time.",
              text:
                "Endless replies. Context switching. Cognitive drag. Email was not designed for this.",
            },
            {
              title: "Memory without understanding.",
              text:
                "Your inbox remembers everything — but understands nothing.",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <h2 className="text-4xl font-serif text-white/85">
                {item.title}
              </h2>
              <p className="text-lg text-white/45 font-light leading-relaxed">
                {item.text}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ================= SHIFT ================= */}
      <section className="relative py-40 bg-[#050505] overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "url(/abstract_flow_dither.png)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-12">
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-400">
            The Shift
          </p>

          <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-serif leading-tight">
            We didn’t build another <br />
            <span className="italic text-white/40">productivity tool</span>.
          </h2>

          <h3 className="text-[clamp(2.5rem,5vw,4rem)] font-serif">
            We built intelligence.
          </h3>

          <p className="max-w-2xl mx-auto text-xl text-white/65 font-light leading-relaxed">
            An assistant that understands what matters — and helps you respond
            without replacing your voice.
          </p>
        </div>
      </section>

      {/* ================= FEATURE STORY ================= */}
      <section className="py-40 bg-black">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-24">
          {/* Sticky Visual */}
          <div className="hidden lg:flex sticky top-32 h-[560px] border border-white/10 bg-[#0b0b0b] items-center justify-center relative">
            <div className="text-center space-y-5 px-12">
              <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center mx-auto">
                ✨
              </div>
              <h3 className="text-2xl font-serif">Contextual Intelligence</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                The interface adapts to what you’re thinking — not the other way
                around.
              </p>
            </div>
          </div>

          {/* Scroll Content */}
          <div className="space-y-40">
            {[
              {
                id: "01",
                title: "Instant clarity in long threads.",
                text:
                  "Summaries, decisions, and action items — without reading everything.",
              },
              {
                id: "02",
                title: "Ask your inbox questions.",
                text:
                  "Deadlines, files, decisions. Get answers, not search results.",
              },
              {
                id: "03",
                title: "Draft without losing your voice.",
                text:
                  "Tone, clarity, concision — refined, not rewritten.",
              },
            ].map((f) => (
              <div key={f.id} className="space-y-6">
                <p className="text-xs font-mono tracking-widest text-cyan-400">
                  {f.id}
                </p>
                <h3 className="text-3xl font-serif">{f.title}</h3>
                <p className="text-xl text-white/55 font-light leading-relaxed">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative py-40 bg-[#050505] border-t border-white/5">
        <div className="absolute inset-0 bg-radial opacity-60" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-14">
          <p className="text-sm text-cyan-400 font-light">
            Private by default. No training on your emails. Ever.
          </p>

          <h2 className="text-[clamp(3rem,6vw,6rem)] font-serif tracking-tight">
            This is how email <br /> should feel.
          </h2>

          <Link href="/signup">
            <Button className="h-14 px-12 bg-white text-black rounded-none text-lg shadow-[0_0_50px_rgba(255,255,255,0.25)]">
              Create your account
            </Button>
          </Link>
        </div>

        <p className="absolute bottom-10 text-cyan-400 w-full text-center text-xs font-mono tracking-[0.3em]">
          MavinMail Systems © 2026
        </p>
      </section>
    </main>
  )
}
