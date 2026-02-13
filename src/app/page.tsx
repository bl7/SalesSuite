"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Cormorant_Garamond } from "next/font/google";

const displaySerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
});

function useScrollAnimation() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return { ref, isVisible };
}

function ScrollSection({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <section
      ref={ref}
      id={id}
      className={`${className} transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {children}
    </section>
  );
}

function Header() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        setHasSession(res.ok);
      })
      .catch(() => {
        setHasSession(false);
      });
  }, []);

  return (
    <header className="flex items-center justify-between">
      <div className="relative flex h-[80px] w-[190px] items-center">
        <Image
          src="/logo.svg"
          alt="SalesSuite logo"
          width={190}
          height={80}
          priority
          className="dark:hidden"
        />
        <Image
          src="/logo-dark.svg"
          alt="SalesSuite logo dark"
          width={190}
          height={80}
          priority
          className="hidden dark:block"
        />
      </div>
      {hasSession === null ? (
        <div className="h-[42px] w-[120px] animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
      ) : (
        <Link
          href={hasSession ? "/dashboard" : "/auth/signup"}
          className="rounded-full bg-zinc-800 px-10 py-3 text-[16px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {hasSession ? "Dashboard" : "Sign up"}
        </Link>
      )}
    </header>
  );
}

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SalesSuite",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Android",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "NPR",
    },
    description: "Field sales management platform for distributors. Verify visits with geofencing, capture leads, and process orders.",
    url: "https://kora.vercel.app",
    publisher: {
      "@type": "Organization",
      name: "Gopala Sales Management Pvt Ltd",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="relative min-h-screen overflow-x-hidden bg-[#121316] text-zinc-900 dark:text-zinc-100">
        {/* Main content — sits above the sticky footer, has rounded bottom + background */}
        <main className="relative z-10 overflow-x-hidden rounded-b-[4.5rem] bg-[#f3f2f6] pb-24 dark:bg-[#0d1117]">
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-8 lg:px-12">
          <Header />

        <section className="pt-16 pb-8 text-center">
          <div className="mx-auto inline-flex items-center rounded-full border border-zinc-200 bg-white/70 px-6 py-2 text-[14px] text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: "0.1s" }}>
            Built for distributors and sales reps
          </div>
          <h1
            className={`${displaySerif.className} mx-auto mt-8 max-w-[920px] text-[clamp(3.8rem,8vw,8.2rem)] leading-[0.95] tracking-[-0.02em] text-zinc-900 dark:text-zinc-100 animate-in fade-in slide-in-from-bottom-4 duration-700`}
            style={{ animationDelay: "0.2s" }}
          >
            Field visits,
            <br />
            leads, and orders.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[clamp(0.95rem,1.3vw,1.35rem)] leading-[1.5] text-zinc-600 dark:text-zinc-400 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: "0.3s" }}>
            SalesSuite detects shop arrivals using geofencing, logs visits with time and duration, and lets reps submit orders with totals, straight to back office.
          </p>
          <div className="mt-8 flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: "0.4s" }}>
            <Link
              href="#contact"
              className="rounded-full bg-zinc-800 px-11 py-3 text-[17px] font-medium text-white transition-all duration-300 hover:scale-105 hover:shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
            >
              Request demo
            </Link>
          </div>

          <div className="relative mx-auto mt-12 h-[90vh] w-full overflow-hidden">
            <div className="relative h-full w-full pt-[60px] pb-[60px]">
              <div
                className="absolute left-1/2 top-[10%] z-10 h-[28vh] w-[min(56vw,100%)] -translate-x-1/2 rounded-[999px] blur-[40px]"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(220,20,60,0.55) 0%, rgba(220,20,60,0.2) 45%, rgba(220,20,60,0) 75%)",
                }}
              />
              <div
                className="absolute left-[30%] top-[42%] z-10 h-[30vh] w-[min(24vw,100%)] rounded-[999px] blur-[45px]"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(220,20,60,0.38) 0%, rgba(220,20,60,0) 72%)",
                }}
              />
              <div
                className="absolute right-[30%] top-[42%] z-10 h-[30vh] w-[min(24vw,100%)] rounded-[999px] blur-[45px]"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(0,56,147,0.35) 0%, rgba(0,56,147,0) 72%)",
                }}
              />
              <div
                className="absolute left-1/2 top-[33%] z-10 h-[46vh] w-[min(46vw,100%)] -translate-x-1/2 rounded-[999px] opacity-80"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 38%, rgba(220,20,60,0.28), rgba(220,20,60,0) 58%), radial-gradient(circle at 50% 63%, rgba(0,56,147,0.26), rgba(0,56,147,0) 60%), repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14) 0 2px, rgba(255,255,255,0) 2px 10px)",
                  filter: "blur(1px)",
                }}
              />
              <div
                className="absolute bottom-[6%] left-1/2 z-10 h-[26vh] w-[min(56vw,100%)] -translate-x-1/2 rounded-[999px] opacity-90 blur-[45px]"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(0,56,147,0.5) 0%, rgba(0,56,147,0.2) 38%, rgba(220,20,60,0.12) 58%, rgba(0,56,147,0) 86%)",
                }}
              />
              <Image
                src="/phones.png"
                alt="SalesSuite mobile app preview"
                width={900}
                height={900}
                className="absolute left-1/2 top-[52%] z-20 h-auto w-[min(100vw,120vh)] max-w-[900px] -translate-x-1/2 -translate-y-1/2 sm:w-[min(145vw,150vh)] sm:max-w-none"
              />
            </div>
          </div>
        </section>

        <ScrollSection className="mt-28 text-center">
          <h2 className={`${displaySerif.className} text-4xl leading-tight sm:text-5xl`}>
            From first visit,
            <br />
            to final order.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Everything a field rep needs, arrival detection, visit logs, lead capture, and order submission.
          </p>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <InfoCard
              title="Visits"
              subtitle="Verified visits, automatically."
              description="SalesSuite detects arrival using geofencing, logs time on site, and records outcomes, notes, and photos."
              footer="Less guessing, more accountability."
              delay="0ms"
            />
            <InfoCard
              title="Leads"
              subtitle="Capture new shops in seconds."
              description="Add a lead with name, contact, location, and notes. Convert to a customer when you're ready."
              delay="100ms"
            />
            <InfoCard
              title="Orders"
              subtitle="Fast order capture with totals."
              description="Build an order with items and quantities, see the grand total, then submit to back office in one tap."
              footer="Exports available for easy processing."
              delay="200ms"
            />
          </div>
        </ScrollSection>

        {/* How it works strip */}
        <ScrollSection id="how-it-works" className="mx-auto mt-16 max-w-4xl">
          <div className="grid grid-cols-3 gap-6 rounded-2xl border border-zinc-200 bg-white px-8 py-6 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                1
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Arrive</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                2
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Log visit</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                3
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Send order</p>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-zinc-600 dark:text-zinc-400">
            Tracking is configurable, SalesSuite focuses on visit verification during working routes, not personal surveillance.
          </p>
        </ScrollSection>

        <ScrollSection className="mt-16 rounded-[2rem] bg-white/70 px-6 py-10 text-center dark:bg-zinc-900/70">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Coverage</p>
          <h3 className={`${displaySerif.className} mt-2 text-4xl leading-tight`}>
            Coverage and performance,
            <br />
            all in one place.
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            See visits per rep, shops covered vs missed, new leads captured, and orders submitted, by day and territory.
          </p>
        </ScrollSection>

        <ScrollSection className="mt-16 rounded-[2rem] bg-[#ebe8f2] px-5 py-10 dark:bg-zinc-900">
          <h3 className={`${displaySerif.className} text-center text-4xl leading-tight`}>
            Teams trust SalesSuite
          </h3>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <QuoteCard quote="We finally have proof of visits, not just promises." author="Regional Manager, Paint Distribution" delay="0ms" />
            <QuoteCard quote="Lead follow-ups are cleaner because every note is logged." author="Sales Ops, FMCG" delay="100ms" />
            <QuoteCard quote="Orders come through with totals and item lists, no more messy calls." author="Back Office Lead, Wholesale" delay="200ms" />
          </div>
        </ScrollSection>

        <ScrollSection className="mx-auto mt-16 mb-0 max-w-3xl">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">FAQ</p>
          <h3 className={`${displaySerif.className} mt-2 text-center text-4xl leading-tight`}>
            Got questions?
            <br />
            Here are the answers.
          </h3>
          <div className="mt-8 space-y-3">
            {[
              { q: "How does SalesSuite detect shop visits?", a: "SalesSuite uses geofencing around shop locations and prompts reps when they arrive. Visits record time, duration, and outcome." },
              { q: "Can reps fake a visit?", a: "Visits require arrival detection and are stamped with time and location. You can also enforce minimum time on site." },
              { q: "Does SalesSuite track reps all day?", a: "You control tracking mode. SalesSuite is designed for visit verification, not personal surveillance." },
              { q: "Will it drain battery?", a: "SalesSuite uses Android background location responsibly and only increases accuracy near visit zones." },
              { q: "Can reps capture orders from the field?", a: "Yes, reps can build orders with items and quantities, see totals, then submit to back office." },
              { q: "How do orders reach back office?", a: "Orders are delivered to the manager dashboard and can be exported for processing." },
              { q: "Is SalesSuite Android only?", a: "Yes, Android only for now." },
            ].map((item) => (
              <FAQItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </ScrollSection>

        {/* Contact Form Section */}
        <ScrollSection id="contact" className="mx-auto mt-20 mb-20 max-w-2xl">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Request a Demo</p>
          <h3 className={`${displaySerif.className} mt-2 text-center text-4xl leading-tight`}>
            Request a demo
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-600 dark:text-zinc-400">
            Tell us your team size and workflow, we&apos;ll set up SalesSuite for your route.
          </p>
          <ContactForm />
        </ScrollSection>

        </div>{/* close inner max-w-7xl wrapper */}
      </main>{/* close main — rounded-b content layer */}

      {/* Footer — sticky underneath, revealed as main scrolls away */}
      <footer className="sticky bottom-0 z-0 -mt-px bg-[#121316] text-zinc-200 [background-image:radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.03),transparent_28%),repeating-linear-gradient(90deg,rgba(255,255,255,0.012)_0px,rgba(255,255,255,0.012)_1px,transparent_1px,transparent_10px)]">
        <div className="mx-auto max-w-7xl px-8 pb-8 pt-16 md:px-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="flex items-start">
              <Image src="/icon.svg" alt="SalesSuite icon" width={72} height={72} />
            </div>
            <FooterLinks
              title="Platform"
              links={["Overview", "Visits", "Leads", "Orders"]}
            />
            <FooterLinks
              title="Company"
              links={["About", "Security", "Privacy", "Terms"]}
            />
            <FooterLinks title="Connect" links={["Contact", "Support", "WhatsApp"]} />
          </div>
          <p className="mt-6 text-xs text-center text-zinc-500">
            SalesSuite is a product of Gopala Sales Management Pvt Ltd.
          </p>
        </div>

        {/* Big SalesSuite wordmark — bottom ~30–40% buried below visible area */}
        <div className="relative h-[clamp(5rem,15vw,16rem)] overflow-hidden">
          <p className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none text-[clamp(8rem,22vw,24rem)] leading-[0.82] font-semibold tracking-[-0.02em] text-white/95">
            SalesSuite
          </p>
        </div>
      </footer>
    </div>
    </>
  );
}

function InfoCard(props: { title: string; subtitle: string; description: string; footer?: string; delay?: string }) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all duration-500 hover:shadow-md hover:-translate-y-1 dark:border-zinc-700 dark:bg-zinc-800 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: props.delay || "0ms" }}
    >
      <p className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100">{props.title}</p>
      <p className="mt-2 text-xl font-serif text-zinc-900 dark:text-zinc-100">{props.subtitle}</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{props.description}</p>
      {props.footer && (
        <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">{props.footer}</p>
      )}
    </div>
  );
}

function QuoteCard(props: { quote: string; author: string; delay?: string }) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`rounded-xl bg-white px-4 py-4 transition-all duration-500 hover:shadow-md hover:-translate-y-1 dark:bg-zinc-800 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: props.delay || "0ms" }}
    >
      <p className="font-serif text-lg text-zinc-900 dark:text-zinc-100">&quot;{props.quote}&quot;</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {props.author}
      </p>
    </div>
  );
}

function FAQItem(props: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-[#f7f7f8] shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-all duration-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${displaySerif.className} flex w-full items-center justify-between px-7 py-5 text-left text-[22px] text-zinc-800 dark:text-zinc-100 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50`}
      >
        <span>{props.question}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[14px] text-zinc-500 transition-all duration-300 dark:bg-zinc-700 dark:text-zinc-300 ${open ? "rotate-180" : ""}`}>
          v
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-200/80 px-7 pb-5 pt-3 animate-in fade-in slide-in-from-top-2 duration-300 dark:border-zinc-700">
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{props.answer}</p>
        </div>
      )}
    </div>
  );
}

function ContactForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        company,
        email,
        phone: `+977${phoneDigits}`,
        teamSize,
        message,
      }),
    });

    const data = (await res.json()) as { ok: boolean; error?: string };
    setLoading(false);

    if (!res.ok || !data.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSuccess(true);
    setName("");
    setCompany("");
    setEmail("");
    setPhoneDigits("");
    setTeamSize("");
    setMessage("");
  }

  if (success) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center dark:border-emerald-800/40 dark:bg-emerald-900/20">
        <p className={`${displaySerif.className} text-xl text-emerald-700 dark:text-emerald-400`}>
          Thank you for reaching out!
        </p>
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-300">
          We&apos;ve received your message and will get back to you soon.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 py-4 text-[18px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />

      <input
        required
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company / Business name"
        className="w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 py-4 text-[18px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />

      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        className="w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 py-4 text-[18px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />

      <div className="grid grid-cols-[92px_1fr] gap-2">
        <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-[#f7f7f8] text-[18px] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          +977
        </div>
        <input
          required
          inputMode="numeric"
          pattern="\d{10}"
          maxLength={10}
          value={phoneDigits}
          onChange={(e) => setPhoneDigits(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
          placeholder="98XXXXXXXX"
          className="w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 py-4 text-[18px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      </div>

      <select
        required
        value={teamSize}
        onChange={(e) => setTeamSize(e.target.value)}
        className="w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 py-4 text-[18px] text-zinc-800 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
      >
        <option value="">Team size</option>
        <option value="1-5">1–5 reps</option>
        <option value="6-15">6–15 reps</option>
        <option value="16-50">16–50 reps</option>
        <option value="50+">50+ reps</option>
      </select>

      <textarea
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Your message"
        rows={5}
        className="w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 py-4 text-[18px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-zinc-800 py-4 text-[18px] font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Sending..." : "Request demo"}
      </button>
    </form>
  );
}

function FooterLinks(props: { title: string; links: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-white">{props.title}</p>
      <ul className="mt-3 space-y-2 text-sm text-zinc-400">
        {props.links.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
