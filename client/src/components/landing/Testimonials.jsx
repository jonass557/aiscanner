import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote, ShieldCheck, Globe, Sparkles } from 'lucide-react';
import { reviewApi } from '../../services/endpoints.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

const DEFAULT_REVIEWS = [
  {
    _id: '1',
    name: 'Alexandre M.',
    role: 'Trader Prop Firm FTMO',
    rating: 5,
    country: 'FR',
    comment: "J'ai validé mon challenge FTMO 100k en 12 jours grâce au Robot Haute Probabilité et aux confluences SMC. La détection des liquidités et des FVG est d'une précision chirurgicale.",
  },
  {
    _id: '2',
    name: 'Jean-Marc D.',
    role: 'Trader Forex & Or (XAU/USD)',
    rating: 5,
    country: 'CI',
    comment: "Le robot et le scanner m'évitent le surtrading et les erreurs émotionnelles. Quand l'IA donne un score supérieur à 90% sur l'or, le take profit est touché 9 fois sur 10.",
  },
  {
    _id: '3',
    name: 'Sarah L.',
    role: 'Swing Trader Indices (NAS100 / US30)',
    rating: 5,
    country: 'SN',
    comment: "Le mode Multi-Timeframe Confluence et la surveillance automatique ont transformé mon quotidien. Plus besoin de rester scotché aux écrans 8h par jour.",
  },
  {
    _id: '4',
    name: 'Kevin B.',
    role: 'Spécialiste Indices Synthétiques Deriv',
    rating: 5,
    country: 'CM',
    comment: "Enfin une IA qui comprend réellement le Volatility 75, Crash 1000 et Boom 1000 ! Les signaux sont ultra nets et les points d'entrée au millimètre.",
  },
  {
    _id: '5',
    name: 'Moussa K.',
    role: 'Day Trader Crypto & Forex',
    rating: 5,
    country: 'SN',
    comment: "Le copilote vocal et le validateur de trade avant chaque prise de position ont divisé mes pertes par 3. Un investissement rentabilisé dès la première semaine.",
  },
  {
    _id: '6',
    name: 'David T.',
    role: 'Trader Part-Time & Développeur',
    rating: 5,
    country: 'BE',
    comment: "La clarté des ratios Risque/Rendement (1:3 à 1:5) et le backtesting replay avec l'outil cut permettent d'affiner n'importe quelle stratégie en quelques minutes.",
  },
];

export default function Testimonials() {
  const [reviews, setReviews] = useState(DEFAULT_REVIEWS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  useEffect(() => {
    reviewApi
      .getPublic()
      .then(({ data }) => {
        const fetched = data?.data?.reviews;
        if (Array.isArray(fetched) && fetched.length > 0) {
          setReviews(fetched);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll carousel every 4.5 seconds when not hovered
  useEffect(() => {
    if (isPaused || reviews.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, reviews.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };

  return (
    <section className="relative py-20 bg-slate-950 overflow-hidden border-t border-slate-900">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              {isEn ? 'VERIFIED TRADER FEEDBACK' : 'TÉMOIGNAGES CLIENTS VÉRIFIÉS'}
            </span>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              {isEn ? 'What Traders Say About Our AI' : 'Ce que Disent les Traders de Notre IA'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {isEn
                ? 'Prop firm candidates and independent traders share their real results.'
                : 'Traders indépendants et candidats prop firms partagent leurs résultats réels.'}
            </p>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-cyan-500 hover:text-white"
              aria-label="Previous review"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNext}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-cyan-500 hover:text-white"
              aria-label="Next review"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div
          className="relative overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Show a sliding window of 3 cards */}
            {[0, 1, 2].map((offset) => {
              const idx = (currentIndex + offset) % reviews.length;
              const r = reviews[idx];
              if (!r) return null;

              return (
                <motion.div
                  key={`${r._id}-${idx}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-6 backdrop-blur-xl shadow-lg hover:border-cyan-500/40 transition-all"
                >
                  <div>
                    {/* Stars & Quote Icon */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 text-amber-400">
                        {Array.from({ length: r.rating || 5 }).map((_, s) => (
                          <Star key={s} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <Quote className="h-6 w-6 text-slate-700" />
                    </div>

                    {/* Testimonial Quote */}
                    <p className="mt-4 text-xs leading-relaxed text-slate-300 italic">
                      “{r.comment}”
                    </p>
                  </div>

                  {/* Author Meta */}
                  <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 font-bold text-slate-950 shadow-md shadow-cyan-500/20">
                        {r.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white">{r.name}</p>
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" title="Avis vérifié" />
                        </div>
                        <p className="text-[11px] text-cyan-400">{r.role}</p>
                      </div>
                    </div>

                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                      {r.country || 'FR'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Carousel Dots */}
          <div className="mt-8 flex justify-center gap-1.5">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === i ? 'w-6 bg-cyan-400' : 'w-2 bg-slate-800'
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
