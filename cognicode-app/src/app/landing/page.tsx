"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";

// ---------- Animations ----------
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const stagger = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.08 } },
  viewport: { once: true },
};

const fadeChild = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

// ---------- Data ----------
const FEATURES = [
  {
    title: "Legacy Archeologist",
    desc: "Deep architectural analysis powered by AI. Uncover hidden patterns, technical debt, and structural risks across your entire codebase — not just one file.",
    tag: "Architecture",
  },
  {
    title: "Live Documentation Sync",
    desc: "Auto-generated codebase documentation that stays in sync. Edit code → docs update instantly with drift detection showing if changes are stable or breaking.",
    tag: "Documentation",
  },
  {
    title: "Impact Graph",
    desc: "Click any module to see exactly what breaks if you change it. Visualize cross-file dependencies and blast radius before you ship a single line.",
    tag: "Impact Analysis",
  },
  {
    title: "Risk Map",
    desc: "Every file scored by risk — coupling, complexity, and size. Know exactly which modules are ticking time bombs before they explode in production.",
    tag: "Risk Assessment",
  },
  {
    title: "Quality Gate",
    desc: "One-click codebase-wide quality scan. Cyclomatic complexity, cognitive complexity, god modules, coupling hotspots — all surfaced with actionable severity levels.",
    tag: "Code Quality",
  },
  {
    title: "RAG-Powered Q&A",
    desc: "Ask questions about your codebase in natural language. The RAG engine indexes your entire repo and answers with context-aware, citation-backed responses.",
    tag: "AI Engine",
  },
  {
    title: "Stress Testing",
    desc: "Fire N concurrent analysis workers on your loaded codebase. Measure real latency, throughput, and pipeline breakdown — graph build, AST parsing, blast radius — under load.",
    tag: "Performance",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "$0",
    period: "/month",
    desc: "For individual developers",
    features: ["Up to 10 files per project", "Architecture analysis", "Basic quality gate", "Single user"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Team",
    price: "$29",
    period: "/user/mo",
    desc: "For engineering teams",
    features: ["Unlimited files", "Live documentation sync", "Impact graph & risk map", "Drift detection", "Priority support", "Up to 25 users"],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large organizations",
    features: ["Everything in Team", "SSO & SAML", "Self-hosted deployment", "Custom integrations", "Dedicated success manager", "SLA guarantee"],
    cta: "Contact Sales",
    highlight: false,
  },
];

// ---------- Components ----------
function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-indigo-500/[0.07] blur-[120px]" />
      <div className="absolute top-[400px] right-0 h-[400px] w-[400px] rounded-full bg-purple-500/[0.05] blur-[100px]" />
    </div>
  );
}

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute top-20 left-[10%] h-2 w-2 rounded-full bg-indigo-400/40"
        animate={{ y: [0, -20, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-40 right-[20%] h-3 w-3 rounded-full bg-purple-400/30"
        animate={{ y: [0, 15, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute top-60 left-[60%] h-1.5 w-1.5 rounded-full bg-cyan-400/30"
        animate={{ y: [0, -10, 0], x: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
}

const TESTIMONIALS = [
  {
    quote: "CogniCode caught a circular dependency chain that would have taken us weeks to debug in production. The blast radius view alone saved our last sprint.",
    name: "Priya Sharma",
    role: "Staff Engineer",
    company: "Razorpay",
    initials: "PS",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    quote: "We replaced three internal documentation tools with CogniCode's live sync. Our docs are finally accurate, and the drift detection tells us exactly when something goes stale.",
    name: "Marcus Chen",
    role: "Engineering Lead",
    company: "Vercel",
    initials: "MC",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    quote: "The RAG Q&A is a game-changer for onboarding. New engineers ask questions in plain English and get answers with exact file references. Ramp-up time dropped 60%.",
    name: "Sarah O'Brien",
    role: "VP of Engineering",
    company: "Stripe",
    initials: "SO",
    gradient: "from-amber-500 to-orange-500",
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  // Fix scrolling — override global overflow:hidden
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  // Scroll-aware navbar background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Active section tracking
  useEffect(() => {
    const sections = ["features", "how-it-works", "pricing"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { threshold: 0.3, rootMargin: "-80px 0px -40% 0px" }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How it Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white antialiased">
      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "py-2" : "py-4"}`}>
        <div className={`mx-auto max-w-5xl px-4 md:px-6 transition-all duration-300 ${scrolled ? "" : ""}`}>
          <div className={`flex items-center justify-between rounded-2xl border px-5 py-2.5 transition-all duration-300 ${
            scrolled
              ? "border-white/[0.08] bg-[#0a0a0f]/90 backdrop-blur-xl shadow-xl shadow-black/30"
              : "border-white/[0.04] bg-zinc-900/50 backdrop-blur-md"
          }`}>
            {/* Logo */}
            <Link href="/landing" className="flex items-center gap-2.5 group shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all group-hover:scale-105">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <span className="text-sm font-bold tracking-tight text-white">CogniCode</span>
            </Link>

            {/* Center nav links */}
            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map((link) => {
                const sectionId = link.href.replace("#", "");
                const isActive = activeSection === sectionId;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`relative rounded-lg px-4 py-1.5 text-[13px] font-medium transition-all ${
                      isActive
                        ? "text-white"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeNav"
                        className="absolute inset-0 rounded-lg bg-white/[0.07]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </a>
                );
              })}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/" className="hidden md:flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-zinc-400 hover:text-white border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03] transition-all">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                Open IDE
              </Link>
              <a
                href="#pricing"
                className="hidden md:block rounded-lg bg-white px-4 py-1.5 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100 transition-all"
              >
                Get Started
              </a>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="mt-2 rounded-2xl border border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-xl shadow-xl shadow-black/40 overflow-hidden"
            >
              <div className="flex flex-col p-2 gap-0.5">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="h-px bg-white/[0.06] my-1" />
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
                >
                  Open IDE
                </Link>
                <a
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 text-center hover:bg-zinc-100 transition-all"
                >
                  Get Started
                </a>
              </div>
            </motion.div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }} className="relative pt-32 pb-20 px-6">
        <GridBackground />
        <FloatingOrbs />
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }} className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-4 py-1.5 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-medium text-indigo-300">Now in Public Beta</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight">
            <span className="bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-transparent">Ship code that</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">doesn&apos;t break things</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }} className="mt-6 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            CogniCode is the architectural sentinel for engineering teams. See the full blast radius of every change, auto-sync your documentation, and catch breaking patterns before they reach production.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} className="mt-10 flex items-center justify-center gap-4">
            <Link href="/" className="group rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30">
              Try it Free →
            </Link>
            <a href="#features" className="rounded-xl border border-zinc-700 px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
              See Features
            </a>
          </motion.div>
        </div>

        {/* Hero visual — code window mockup */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }} className="relative mx-auto mt-20 max-w-5xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-2xl shadow-black/50 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-zinc-500 font-mono">CogniCode — Architectural Sentinel</span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-zinc-800/50">
              <div className="bg-zinc-900/90 p-4 space-y-2">
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Explorer</div>
                {["main.py", "api/routes.py", "models/user.py", "services/auth.py", "utils/helpers.py"].map((f, i) => (
                  <div key={f} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${i === 1 ? "bg-indigo-500/10 text-indigo-300" : "text-zinc-400"}`}>
                    <span className="text-[10px]">🐍</span>{f}
                  </div>
                ))}
              </div>
              <div className="bg-zinc-900/90 p-4">
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div><span className="text-purple-400">from</span> <span className="text-cyan-300">services.auth</span> <span className="text-purple-400">import</span> <span className="text-zinc-300">verify_token</span></div>
                  <div><span className="text-purple-400">from</span> <span className="text-cyan-300">models.user</span> <span className="text-purple-400">import</span> <span className="text-zinc-300">UserModel</span></div>
                  <div className="text-zinc-600">&nbsp;</div>
                  <div><span className="text-blue-400">@app</span>.<span className="text-yellow-300">route</span>(<span className="text-green-300">&quot;/api/users&quot;</span>)</div>
                  <div><span className="text-purple-400">async def</span> <span className="text-yellow-300">get_users</span>(request):</div>
                  <div className="pl-4"><span className="text-zinc-400">token</span> = <span className="text-zinc-300">verify_token</span>(request)</div>
                  <div className="pl-4"><span className="text-purple-400">return</span> <span className="text-zinc-300">UserModel</span>.all()</div>
                </div>
              </div>
              <div className="bg-zinc-900/90 p-4">
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Impact Analysis</div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                    <div className="text-[10px] text-amber-400 font-semibold">⚠ High Coupling</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">auth.py → 4 dependents</div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                    <div className="text-[10px] text-emerald-400 font-semibold">✓ Changes Stable</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Drift: 0 sections changed</div>
                  </div>
                  <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2">
                    <div className="text-[10px] text-indigo-400 font-semibold">Quality: 94%</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">0 violations found</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-transparent to-purple-500/10 -z-10 blur-xl" />
        </motion.div>
      </motion.section>

      {/* Metrics */}
      <motion.div {...fadeUp} className="relative py-16 px-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/[0.02] to-transparent" />
        <div className="relative mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                val: "20-30×",
                lbl: "Token Reduction",
                sub: "vs raw source code",
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                ),
                color: "from-indigo-500/20 to-indigo-500/0",
                accent: "text-indigo-400",
                border: "border-indigo-500/10 hover:border-indigo-500/25",
              },
              {
                val: "13+",
                lbl: "Languages",
                sub: "Python, TS, Go, Rust…",
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                ),
                color: "from-purple-500/20 to-purple-500/0",
                accent: "text-purple-400",
                border: "border-purple-500/10 hover:border-purple-500/25",
              },
              {
                val: "<3s",
                lbl: "Graph Build",
                sub: "100+ file codebases",
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                ),
                color: "from-cyan-500/20 to-cyan-500/0",
                accent: "text-cyan-400",
                border: "border-cyan-500/10 hover:border-cyan-500/25",
              },
              {
                val: "100%",
                lbl: "Local Parsing",
                sub: "No code leaves your machine",
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                ),
                color: "from-emerald-500/20 to-emerald-500/0",
                accent: "text-emerald-400",
                border: "border-emerald-500/10 hover:border-emerald-500/25",
              },
            ].map((m) => (
              <div
                key={m.lbl}
                className={`group relative rounded-xl border bg-zinc-900/40 p-5 transition-all duration-300 ${m.border} hover:bg-zinc-900/60`}
              >
                {/* Gradient glow */}
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-b ${m.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative">
                  <div className={`mb-3 ${m.accent} opacity-60 group-hover:opacity-100 transition-opacity`}>
                    {m.icon}
                  </div>
                  <div className={`text-2xl md:text-3xl font-bold tracking-tight text-white`}>{m.val}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{m.lbl}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-600 group-hover:text-zinc-500 transition-colors">{m.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Features — Editorial Layout */}
      <section id="features" className="relative py-24 px-6 overflow-hidden">
        {/* Section background accent */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-indigo-600/[0.04] blur-[150px]" />

        <div className="relative mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="mb-20 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-medium text-indigo-300 mb-4">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              Features
            </span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.15]">
              Every view answers a<br />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">specific question</span>
            </h2>
            <p className="mt-5 text-base text-zinc-400 leading-relaxed">No fluff, no dashboards-for-dashboards. Six focused tools that give you actionable intelligence about your codebase.</p>
          </motion.div>

          <div className="space-y-5">

            {/* Row 1 — Hero feature (Archeologist) */}
            <motion.div {...fadeUp} className="group relative">
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-8 md:p-10 overflow-hidden">
                {/* Decorative corner glow */}
                <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-[60px] group-hover:bg-indigo-500/15 transition-colors duration-500" />
                <div className="relative flex flex-col md:flex-row gap-8 items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-indigo-400">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400/80">{FEATURES[0].tag}</span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">{FEATURES[0].title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">{FEATURES[0].desc}</p>
                  </div>
                  {/* Mini-preview panel */}
                  <div className="shrink-0 w-full md:w-[320px] rounded-xl bg-black/60 border border-zinc-800/60 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-900/50">
                      <span className="h-2 w-2 rounded-full bg-zinc-700" />
                      <span className="h-2 w-2 rounded-full bg-zinc-700" />
                      <span className="h-2 w-2 rounded-full bg-zinc-700" />
                      <span className="ml-2 text-[10px] text-zinc-600 font-mono">analysis.out</span>
                    </div>
                    <div className="p-4 font-mono text-[11px] space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-400 text-[10px]">✓</span>
                        <span className="text-zinc-300">MVC pattern detected</span>
                        <span className="ml-auto text-zinc-600 text-[10px]">94%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-500/10 text-amber-400 text-[10px]">⚠</span>
                        <span className="text-zinc-400">Circular: auth ↔ user</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-red-500/10 text-red-400 text-[10px]">✕</span>
                        <span className="text-zinc-400">God module: utils.py</span>
                      </div>
                      <div className="h-px bg-zinc-800/80 my-1" />
                      <div className="text-zinc-600 text-[10px]">3 patterns · 1 risk · 2 warnings</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Row 2 — Two cards side by side */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Live Documentation Sync */}
              <motion.div {...fadeUp} className="group relative">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-7 overflow-hidden">
                  <div className="absolute -bottom-16 -right-16 h-32 w-32 rounded-full bg-emerald-500/[0.06] blur-[50px]" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-400">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">{FEATURES[1].tag}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{FEATURES[1].title}</h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">{FEATURES[1].desc}</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/50 px-3 py-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[12px] text-emerald-400 font-medium">Synced</span>
                        <span className="text-zinc-600 text-[11px] ml-auto font-mono">2s ago</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 rounded-lg bg-amber-500/[0.04] border border-amber-500/10 px-3 py-2 text-[11px] text-amber-400 font-mono">~ Routes changed</div>
                        <div className="flex-1 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400 font-mono">✓ Stable</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Impact Graph */}
              <motion.div {...fadeUp} className="group relative">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-orange-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-7 overflow-hidden">
                  <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-orange-500/[0.06] blur-[50px]" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-orange-400">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-400/80">{FEATURES[2].tag}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{FEATURES[2].title}</h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">{FEATURES[2].desc}</p>
                    <div className="space-y-2">
                      <div className="text-[11px] text-zinc-500 font-mono mb-2">auth.py blast radius →</div>
                      {[
                        { file: "routes.py", severity: "critical" },
                        { file: "middleware.py", severity: "warning" },
                        { file: "tests.py", severity: "warning" },
                        { file: "utils.py", severity: "warning" },
                      ].map((f, i) => (
                        <div key={f.file} className="flex items-center gap-3 text-[11px] font-mono">
                          <div className={`h-1.5 w-1.5 rounded-full ${f.severity === "critical" ? "bg-red-400" : "bg-amber-400"}`} />
                          <div className={`h-px flex-1 ${f.severity === "critical" ? "bg-red-500/20" : "bg-amber-500/10"}`} />
                          <span className={f.severity === "critical" ? "text-red-400" : "text-amber-400/80"}>{f.file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Row 3 — Three cards */}
            <div className="grid md:grid-cols-3 gap-5">
              {/* Quality Gate */}
              <motion.div {...fadeUp} className="group relative">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-cyan-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-7 overflow-hidden">
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-cyan-400">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400/80">{FEATURES[4].tag}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{FEATURES[4].title}</h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">{FEATURES[4].desc}</p>
                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-16">
                        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#27272a" strokeWidth="2" />
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#qualityGrad)" strokeWidth="2" strokeDasharray="97.4" strokeDashoffset="7.8" strokeLinecap="round" />
                          <defs><linearGradient id="qualityGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#22c55e" /></linearGradient></defs>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-white">92</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 space-y-1 font-mono">
                        <div>12 files scanned</div>
                        <div>45 functions</div>
                        <div className="text-emerald-400 font-medium">0 critical issues</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Risk Map */}
              <motion.div {...fadeUp} className="group relative">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-rose-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-7 overflow-hidden">
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-rose-400">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400/80">{FEATURES[3].tag}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{FEATURES[3].title}</h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">{FEATURES[3].desc}</p>
                    <div className="space-y-3">
                      {[
                        { file: "auth.py", risk: 87, color: "from-red-500 to-red-400" },
                        { file: "routes.py", risk: 64, color: "from-amber-500 to-amber-400" },
                        { file: "helpers.py", risk: 18, color: "from-emerald-500 to-emerald-400" },
                      ].map((f) => (
                        <div key={f.file}>
                          <div className="flex justify-between text-[11px] mb-1.5">
                            <span className="text-zinc-300 font-medium font-mono">{f.file}</span>
                            <span className="text-zinc-500 font-mono">{f.risk}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full bg-gradient-to-r ${f.color}`}
                              initial={{ width: 0 }}
                              whileInView={{ width: `${f.risk}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* RAG Q&A */}
              <motion.div {...fadeUp} className="group relative">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-violet-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-7 overflow-hidden">
                  <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-violet-500/[0.06] blur-[50px]" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-violet-400">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">{FEATURES[5].tag}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{FEATURES[5].title}</h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">{FEATURES[5].desc}</p>
                    <div className="rounded-xl bg-black/50 border border-zinc-800/50 p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <span className="shrink-0 mt-0.5 rounded-md bg-zinc-800 px-2 py-0.5 text-[9px] font-mono text-zinc-500 font-medium">YOU</span>
                        <span className="text-[12px] text-zinc-300 leading-relaxed">How does authentication work?</span>
                      </div>
                      <div className="h-px bg-zinc-800/50" />
                      <div className="flex items-start gap-2.5">
                        <span className="shrink-0 mt-0.5 rounded-md bg-violet-500/15 px-2 py-0.5 text-[9px] font-mono text-violet-400 font-medium">AI</span>
                        <span className="text-[12px] text-zinc-400 leading-relaxed">JWT tokens verified in <span className="text-violet-400">auth.py:23-45</span> via <span className="text-violet-400">verify_token()</span>…</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Row 4 — Stress Testing (full width) */}
            <motion.div {...fadeUp} className="group relative">
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-yellow-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Left - Description */}
                  <div className="p-7">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-yellow-400">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-yellow-400/80">{FEATURES[6].tag}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{FEATURES[6].title}</h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed mb-6">{FEATURES[6].desc}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Avg Latency", value: "42ms" },
                        { label: "P95", value: "128ms" },
                        { label: "Throughput", value: "23.4/s" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg bg-black/40 border border-zinc-800/50 px-2.5 py-2 text-center">
                          <div className="text-sm font-bold font-mono text-white">{s.value}</div>
                          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Right - Worker Timeline Mock */}
                  <div className="p-7 border-t md:border-t-0 md:border-l border-zinc-800/40">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Worker Timeline — 10 concurrent</span>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">PASS</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { id: 0, ms: 38, pct: 30 },
                        { id: 1, ms: 42, pct: 33 },
                        { id: 2, ms: 41, pct: 32 },
                        { id: 3, ms: 55, pct: 43 },
                        { id: 4, ms: 39, pct: 31 },
                        { id: 5, ms: 128, pct: 100 },
                        { id: 6, ms: 44, pct: 34 },
                        { id: 7, ms: 36, pct: 28 },
                        { id: 8, ms: 47, pct: 37 },
                        { id: 9, ms: 43, pct: 34 },
                      ].map((w) => (
                        <div key={w.id} className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-600 font-mono w-4 text-right">#{w.id}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-zinc-800/60 overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${
                                w.ms > 100 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              initial={{ width: 0 }}
                              whileInView={{ width: `${w.pct}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, ease: "easeOut", delay: w.id * 0.05 }}
                            />
                          </div>
                          <span className={`text-[9px] font-mono w-10 text-right ${
                            w.ms > 100 ? "text-amber-400" : "text-zinc-500"
                          }`}>{w.ms}ms</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-3 text-[9px] text-zinc-600">
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Normal</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> &gt; P95</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-medium text-indigo-300 mb-4">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Trusted by Engineers
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Loved by teams who<br />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">ship with confidence</span>
            </h2>
          </motion.div>

          <motion.div variants={stagger} initial="initial" whileInView="whileInView" viewport={{ once: true }} className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <motion.div key={t.name} variants={fadeChild} className="group relative">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-7 flex flex-col">
                  {/* Quote icon */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-indigo-500/20 mb-4 shrink-0">
                    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" fill="currentColor" />
                    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" fill="currentColor" />
                  </svg>
                  <p className="text-[13px] text-zinc-300 leading-relaxed flex-1 mb-6">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-zinc-800/50">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-white text-xs font-bold shadow-lg`}>
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t.name}</div>
                      <div className="text-[11px] text-zinc-500">{t.role} · {t.company}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works — Visual Timeline */}
      <section id="how-it-works" className="relative py-24 px-6 overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-purple-600/[0.04] blur-[150px]" />

        <div className="relative mx-auto max-w-5xl">
          <motion.div {...fadeUp} className="text-center mb-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-medium text-indigo-300 mb-4">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              How it works
            </span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.15]">
              Three steps to<br />
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">safer code</span>
            </h2>
          </motion.div>

          <div className="relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-[52px] left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-px bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30" />

            <motion.div variants={stagger} initial="initial" whileInView="whileInView" viewport={{ once: true }} className="grid md:grid-cols-3 gap-8">
              {/* Step 01 */}
              <motion.div variants={fadeChild} className="text-center">
                <div className="relative mx-auto mb-6">
                  <div className="relative mx-auto flex h-[104px] w-[104px] items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/[0.05]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/10">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-indigo-400">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white shadow-lg shadow-indigo-500/30">01</div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Open your codebase</h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-[280px] mx-auto">Point CogniCode at any folder. It builds a structural graph of every file, class, function, and import — instantly.</p>
              </motion.div>

              {/* Step 02 */}
              <motion.div variants={fadeChild} className="text-center">
                <div className="relative mx-auto mb-6">
                  <div className="relative mx-auto flex h-[104px] w-[104px] items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/[0.05]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/10">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-purple-400">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-purple-500 text-[11px] font-bold text-white shadow-lg shadow-purple-500/30">02</div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Get instant insights</h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-[280px] mx-auto">Architecture patterns, risk scores, dependency maps, and auto-generated documentation appear in seconds — no config needed.</p>
              </motion.div>

              {/* Step 03 */}
              <motion.div variants={fadeChild} className="text-center">
                <div className="relative mx-auto mb-6">
                  <div className="relative mx-auto flex h-[104px] w-[104px] items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/[0.05]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/10">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-cyan-400">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-[11px] font-bold text-white shadow-lg shadow-cyan-500/30">03</div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Ship with confidence</h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-[280px] mx-auto">Before every change, see the blast radius. The quality gate catches risky merges. Docs stay synced automatically.</p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Pricing</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Start free, scale as you grow</h2>
            <p className="mt-4 text-zinc-400">No credit card required. Cancel anytime.</p>
          </motion.div>

          <motion.div variants={stagger} initial="initial" whileInView="whileInView" viewport={{ once: true }} className="grid md:grid-cols-3 gap-4">
            {PRICING.map((p) => (
              <motion.div
                key={p.name}
                variants={fadeChild}
                className={`relative rounded-2xl border p-8 ${
                  p.highlight
                    ? "border-indigo-500/30 bg-gradient-to-b from-indigo-500/5 to-transparent"
                    : "border-zinc-800 bg-zinc-900/30"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-semibold text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-white">{p.name}</h3>
                <p className="text-xs text-zinc-500 mt-1">{p.desc}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">{p.price}</span>
                  <span className="text-sm text-zinc-500 mb-1">{p.period}</span>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-indigo-400">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button className={`mt-8 w-full rounded-xl py-3 text-sm font-semibold transition-all cursor-pointer ${
                  p.highlight
                    ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                    : "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
                }`}>
                  {p.cta}
                </button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="pointer-events-none absolute top-1/2 left-1/3 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-indigo-600/[0.06] blur-[100px]" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 -translate-y-1/2 h-[200px] w-[200px] rounded-full bg-purple-600/[0.05] blur-[80px]" />

        <motion.div {...fadeUp} className="relative mx-auto max-w-2xl text-center">
          <div className="relative rounded-2xl border border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm px-8 py-10 md:px-12 md:py-12 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-[1.2]">
              Ready to ship <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">safer code</span>?
            </h2>
            <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              Join hundreds of engineering teams using CogniCode to catch risky changes before production.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/" className="rounded-xl bg-indigo-600 px-7 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/25">
                Get Started Free →
              </Link>
              <a href="#features" className="rounded-xl border border-zinc-700 px-7 py-3 text-sm font-medium text-zinc-400 hover:border-zinc-500 hover:text-white transition-all">
                Explore Features
              </a>
            </div>
            <p className="mt-4 text-[10px] text-zinc-600">No credit card · Free plan forever · Deploy in 60s</p>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 px-6 py-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-zinc-400">CogniCode</span>
            <span className="text-[10px] text-zinc-600">© 2026</span>
          </div>

          <div className="flex items-center gap-5 text-[11px] text-zinc-500">
            <a href="#features" className="hover:text-zinc-300 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
          </div>

          <div className="flex items-center gap-4">
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
            </a>
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
