"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Zap,
  TrendingUp,
  BarChart3,
  Shield,
  LifeBuoy,
} from "lucide-react";
import { FaTelegramPlane, FaMediumM, FaDiscord } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import Trump from "../assets/videos/Trump_1_0001-0100_1.webm";
import React, { ReactNode, ElementType } from "react";

// Define types for component props
interface SocialIconProps {
  Icon: ElementType;
  href: string;
  className?: string;
}

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

interface StatCounterProps {
  value: string;
  label: string;
  startVal?: string;
}

interface SectionTitleProps {
  subtitle?: string;
  title: string;
  description?: string;
}

interface GradientButtonProps {
  children: ReactNode;
  primary?: boolean;
  className?: string;
  onClick?: () => void;
}

// Enhanced social icon component with animations
const SocialIcon: React.FC<SocialIconProps> = ({
  Icon,
  href,
  className = "text-cyan-400 hover:text-cyan-300",
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="transform transition-all duration-300 hover:scale-125 hover:rotate-6"
  >
    <Icon size={24} className={`transition-colors duration-300 ${className}`} />
  </a>
);

// Enhanced Feature card component with glass effect
const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
}) => (
  <div className="backdrop-blur-lg bg-white/5 rounded-2xl p-6 shadow-xl transition-all duration-500 transform hover:-translate-y-2 group will-change-transform">
    <div className="bg-gradient-to-br from-cyan-600 to-purple-600 rounded-full w-14 h-14 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 shadow-lg will-change-transform">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-gray-300 group-hover:text-white transition-colors duration-300">
      {description}
    </p>
  </div>
);

// Enhanced Stats counter component with animations
const StatCounter: React.FC<StatCounterProps> = ({
  value,
  label,
  startVal = "0",
}) => {
  const [displayValue, setDisplayValue] = useState(startVal);
  const counterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayValue(value);
        }
      },
      { threshold: 0.1 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => {
      if (counterRef.current) {
        observer.unobserve(counterRef.current);
      }
    };
  }, [value]);

  return (
    <div className="text-center group" ref={counterRef}>
      <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent transition-all duration-1000 transform group-hover:scale-110 will-change-transform">
        {displayValue}
      </div>
      <div className="text-gray-300 text-sm mt-2 transition-colors duration-300 group-hover:text-white">
        {label}
      </div>
    </div>
  );
};

// Animated section title component
const SectionTitle: React.FC<SectionTitleProps> = ({
  subtitle,
  title,
  description,
}) => (
  <div className="text-center mb-16 max-w-3xl mx-auto">
    {subtitle && (
      <div className="inline-block px-4 py-1.5 rounded-full bg-cyan-500/10 backdrop-blur-lg text-cyan-400 text-sm font-semibold mb-4 transition-all duration-500 hover:bg-cyan-500/15">
        {subtitle}
      </div>
    )}
    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 transition-all duration-500">
      {title}
    </h2>
    {description && (
      <p className="text-gray-300 text-lg max-w-2xl mx-auto">{description}</p>
    )}
  </div>
);

// Animated gradient button
const GradientButton: React.FC<GradientButtonProps> = ({
  children,
  primary = true,
  className = "",
  onClick = () => {}, // Default empty function to make onClick optional
}) => (
  <button
    onClick={onClick}
    className={`
      px-6 py-3.5 font-medium rounded-xl transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-2 active:scale-95 will-change-transform
      ${
        primary
          ? "bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white shadow-lg"
          : "backdrop-blur-2xl bg-white/10 hover:bg-white/15 text-cyan-400"
      }
      ${className}
    `}
  >
    {children}
  </button>
);

interface BannerItem {
  image: string;
  alt: string;
}

interface FeatureItem {
  icon: ReactNode;
  title: string;
  description: string;
}

interface StatItem {
  value: string;
  label: string;
}

interface VisibleSections {
  hero: boolean;
  features: boolean;
  stats: boolean;
  dex: boolean;
  cta: boolean;
}

export default function Page() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const dexRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [visibleSections, setVisibleSections] = useState<VisibleSections>({
    hero: false,
    features: false,
    stats: false,
    dex: false,
    cta: false,
  });

  const banners: BannerItem[] = [
    {
      image: "/1.png",
      alt: "Bad Bunny Tap to Earn",
    },
    {
      image: "/2.png",
      alt: "PancakeSwap v4",
    },
  ];

  // More comprehensive features data
  const features: FeatureItem[] = [
    {
      icon: <Zap className="h-6 w-6 text-white" />,
      title: "Lightning Fast Swaps",
      description:
        "Execute trades with minimal latency on the high-performance Sui blockchain for maximum efficiency",
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-white" />,
      title: "Optimal Routing",
      description:
        "Smart order routing ensures you always get the best possible exchange rates across multiple liquidity pools",
    },
    {
      icon: <BarChart3 className="h-6 w-6 text-white" />,
      title: "Earn with LP Rewards",
      description:
        "Provide liquidity and earn generous rewards from trading fees while supporting the ecosystem",
    },
    {
      icon: <Shield className="h-6 w-6 text-white" />,
      title: "Enhanced Security",
      description:
        "Cutting-edge protocols and audited smart contracts protect your assets at every step",
    },
    {
      icon: <LifeBuoy className="h-6 w-6 text-white" />,
      title: "24/7 Support",
      description:
        "Access our dedicated support team anytime through multiple channels for immediate assistance",
    },
    {
      icon: <FaDiscord className="h-6 w-6 text-white" />,
      title: "Vibrant Community",
      description:
        "Join thousands of traders and investors in our active community to share insights and strategies",
    },
  ];

  // Stats data
  const stats: StatItem[] = [
    { value: "$XX.XM+", label: "Total Value Locked" },
    { value: "X.XM+", label: "Transactions" },
    { value: "XK+", label: "Active Users" },
    { value: "XX+", label: "Trading Pairs" },
  ];

  useEffect(() => {
    // Use a more gentle automatic slide transition
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 6000);

    // Debounce resize events for better performance
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Any resize-based calculations would go here
      }, 100);
    };
    window.addEventListener("resize", handleResize);

    // Enhanced Intersection Observer for animations with improved thresholds
    const observeElement = (
      ref: React.RefObject<HTMLElement>,
      sectionName: string
    ) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (sectionName === "video") {
                setIsVideoVisible(true);
              } else {
                setVisibleSections((prev) => ({
                  ...prev,
                  [sectionName]: true,
                }));
              }
            }
          });
        },
        {
          threshold: 0.15,
          rootMargin: "0px 0px -10% 0px", // Trigger slightly before element comes into view
        }
      );

      if (ref.current) {
        observer.observe(ref.current);
      }

      return () => {
        if (ref.current) observer.unobserve(ref.current);
      };
    };

    observeElement(videoContainerRef, "video");
    observeElement(featuresRef, "features");
    observeElement(statsRef, "stats");
    observeElement(heroRef, "hero");
    observeElement(dexRef, "dex");
    observeElement(ctaRef, "cta");

    // Smoother video loading
    if (videoRef.current) {
      videoRef.current.addEventListener("loadeddata", () => {
        // Ensure video container is visible only after video is loaded
        setIsVideoVisible(true);
      });
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Preload next image for smoother banner transitions
  useEffect(() => {
    const nextIndex = (currentSlide + 1) % banners.length;
    const nextImage = new Image();
    nextImage.src = banners[nextIndex].image;
  }, [currentSlide, banners]);

  // Function to smoothly change slides with a slight delay
  const changeSlide = (index: number) => {
    // Add a small timeout for a more polished transition feel
    setTimeout(() => {
      setCurrentSlide(index);
    }, 50);
  };

  return (
    <main className="min-h-screen overflow-x-hidden perspective-1000">
      {/* Enhanced Rotating Banner Section */}
      <section className=" mt-4 relative h-[200px]   ">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {banners.map((banner, index) => (
            <div key={index} className="min-w-full">
              <img
                src={banner.image || "/placeholder.svg"}
                alt={banner.alt}
                className="w-full h-[200px] object-contain"
              />
            </div>
          ))}
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full ${
                currentSlide === index ? "bg-white" : "bg-white/50"
              }`}
              onClick={() => setCurrentSlide(index)}
            />
          ))}
        </div>

        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full"
          onClick={() =>
            setCurrentSlide(
              (prev) => (prev - 1 + banners.length) % banners.length
            )
          }
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full"
          onClick={() => setCurrentSlide((prev) => (prev + 1) % banners.length)}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </section>

      {/* Enhanced Hero Section */}
      <section
        ref={heroRef}
        className={`py-5 px-8 relative z-10 transition-all duration-1000 transform ${
          visibleSections.hero
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0"
        }`}
      >
        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-block px-4 py-1.5 rounded-full bg-green-500/10 backdrop-blur-md text-green-400 text-sm font-semibold">
              Sui's Premier DEX
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              <div className="space-y-4">
                <div className="flex items-center">
                  <span>Unleashing</span>
                  <div className="ml-3 h-1.5 w-16 bg-gradient-to-r from-cyan-400 to-green-500 rounded-full"></div>
                </div>
                <div className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                  the Next
                </div>
                <div>Wave of DeFi on Sui</div>
              </div>
            </h1>

            <p className="text-gray-300 text-lg">
              Pioneering DeFi on Sui blockchain with unparalleled flexibility
              and seamless trading, powered by V2 technology for maximum
              efficiency and security
            </p>

            <div className="flex flex-wrap gap-4">
              <GradientButton primary>
                Swap Now <ArrowRight className="h-5 w-5" />
              </GradientButton>
              <GradientButton primary={false}>Learn More</GradientButton>
            </div>
          </div>

          <div className="order-first md:order-last" ref={videoContainerRef}>
            <div
              className={`transition-all duration-1000 ${
                isVideoVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              }`}
            >
              <div className="relative">
                {/* Video glass container */}
                {/* <div className="absolute -inset-4 backdrop-blur-xl bg-white/5 rounded-3xl"></div> */}

                <video
                  ref={videoRef}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full max-w-[600px] mx-auto relative hover:shadow-cyan-500/20 transition-all duration-500 z-10"
                >
                  <source src={Trump} type="video/webm" />
                  Your browser does not support the video tag.
                </video>

                {/* Floating particles decorations with improved animation */}
                <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-cyan-500 rounded-full opacity-70 animate-float-smooth will-change-transform"></div>
                <div
                  className="absolute bottom-1/3 left-1/4 w-3 h-3 bg-purple-500 rounded-full opacity-70 animate-float-smooth will-change-transform"
                  style={{ animationDelay: "1s" }}
                ></div>
                <div
                  className="absolute top-2/3 right-1/3 w-2 h-2 bg-green-500 rounded-full opacity-70 animate-float-smooth will-change-transform"
                  style={{ animationDelay: "2s" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section
        ref={featuresRef}
        className={`py-15 px-8 relative z-10 transition-all duration-1000 transform ${
          visibleSections.features
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0"
        }`}
      >
        <div className="container mx-auto">
          <SectionTitle
            subtitle="Why Choose SuiTrump DEX"
            title="Advanced Features for Modern Traders"
            description="Our platform offers the best trading experience with cutting-edge technology and innovative solutions"
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Stats Section */}
      <section
        ref={statsRef}
        className={`py-10 px-8 relative z-10 transition-all duration-1000 transform ${
          visibleSections.stats
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0"
        }`}
      >
        <div className="container mx-auto">
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-10 shadow-2xl transform transition-all duration-500 hover:bg-white/8">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Growing Rapidly
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-cyan-500 to-purple-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <StatCounter
                  key={index}
                  value={stat.value}
                  label={stat.label}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced DEX Section */}
      <section
        ref={dexRef}
        className={`py-15 px-8 relative z-10 transition-all duration-1000 transform ${
          visibleSections.dex
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0"
        }`}
      >
        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="relative">
              {/* Glass effect behind image */}
              {/* <div className="absolute -inset-6 backdrop-blur-xl bg-white/5 rounded-3xl"></div> */}

              <img
                src="/Suitrump1.png"
                alt="SuiTrump DEX"
                className="w-full max-w-[500px] mx-auto relative transform transition-all duration-700 hover:scale-105 rounded-2xl shadow-xl z-10 will-change-transform"
                loading="lazy"
              />

              {/* Light glow effects */}
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-cyan-500/20 filter blur-xl animate-pulse-slow"></div>
              <div
                className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-purple-500/20 filter blur-xl animate-pulse-slow"
                style={{ animationDelay: "2s" }}
              ></div>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                The DEX{" "}
              </span>
              <span className="text-white">where </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                Everybody Wins
              </span>
            </h2>

            <p className="text-gray-300 text-lg">
              Trade, Earn and Own crypto on SUI, with tremendous returns and
              cutting-edge security. Our platform is designed for both beginners
              and experienced traders.
            </p>

            <div className="space-y-4">
              <p className="text-gray-300 text-lg">
                Join our growing community
              </p>

              <div className="flex justify-start space-x-8">
                <SocialIcon
                  Icon={FaXTwitter}
                  href="https://x.com/SUITRUMPCOIN"
                />
                <SocialIcon
                  Icon={FaTelegramPlane}
                  href="https://t.me/+cFvZCZYolVFiNDk1"
                />
                <SocialIcon Icon={FaMediumM} href="https://medium.com" />
              </div>
            </div>

            <GradientButton primary>
              Trade Now <ArrowRight className="h-5 w-5" />
            </GradientButton>
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section
        ref={ctaRef}
        className={`py-15 px-8 relative z-10 transition-all duration-1000 transform ${
          visibleSections.cta
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0"
        }`}
      >
        <div className="container mx-auto">
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-12 shadow-2xl relative overflow-hidden transform transition-all duration-500 hover:bg-white/8">
            {/* Light effects with animation */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/10 filter blur-xl animate-pulse-slow"></div>
            <div
              className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-purple-500/10 filter blur-xl animate-pulse-slow"
              style={{ animationDelay: "3s" }}
            ></div>

            <div className="text-center space-y-8 relative z-10">
              <h2 className="text-4xl font-bold text-white">
                Ready to start trading?
              </h2>
              <p className="text-gray-300 max-w-2xl mx-auto text-lg">
                Join thousands of traders already experiencing the future of
                DeFi on the Sui blockchain with industry-leading security and
                performance
              </p>
              <GradientButton
                primary
                className="px-8 py-4 text-lg mx-auto inline-flex"
              >
                Launch App <ArrowRight className="h-5 w-5 ml-1" />
              </GradientButton>
            </div>
          </div>
        </div>
      </section>

      {/* Add enhanced global CSS for smoother animations */}
      <style>
        {`
          .perspective-1000 {
            perspective: 1000px;
          }
          
          @keyframes float-smooth {
            0% { transform: translateY(0) translateZ(0); }
            50% { transform: translateY(-10px) translateZ(0); }
            100% { transform: translateY(0) translateZ(0); }
          }
          
          .animate-float-smooth {
            animation: float-smooth 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          
          .animate-pulse-slow {
            animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          
          .will-change-transform {
            will-change: transform;
          }
          
          /* Optimize animations for devices that prefer reduced motion */
          @media (prefers-reduced-motion: reduce) {
            .animate-float-smooth,
            .animate-pulse-slow {
              animation: none;
            }
            
            * {
              transition-duration: 0.1s !important;
            }
          }
        `}
      </style>
    </main>
  );
}
