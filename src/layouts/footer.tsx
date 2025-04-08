"use client";

import { useState } from "react";
import {
  FaFacebookF,
  FaTelegramPlane,
  FaMediumM,
  FaDiscord,
  FaGithub,
  FaChevronUp,
} from "react-icons/fa";
import { FaXTwitter, FaInstagram } from "react-icons/fa6";
import { ArrowRight, Mail, Globe, Zap, Shield, BarChart3 } from "lucide-react";
import { suidex } from "../assets"; // Import the SUIDEX logo

interface SocialIconProps {
  Icon: React.ElementType;
  href: string;
  label: string;
  color?: string;
}

const SocialIcon: React.FC<SocialIconProps> = ({
  Icon,
  href,
  label,
  color = "from-cyan-500 to-purple-500",
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className="transform transition-all duration-300 hover:scale-125 hover:rotate-6 group"
  >
    <div
      className={`relative rounded-full p-2.5 bg-white/5 backdrop-blur-sm hover:bg-gradient-to-r ${color} group-hover:shadow-lg`}
    >
      <Icon
        size={20}
        className="text-gray-300 group-hover:text-white transition-colors duration-300"
      />
    </div>
  </a>
);

const FooterLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <a
    href={href}
    className="text-gray-400 hover:text-cyan-400 transition-colors duration-300 inline-block py-1"
  >
    {children}
  </a>
);

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement actual newsletter subscription
    setSubscribed(true);
    setTimeout(() => setSubscribed(false), 3000);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 pt-16 pb-8 overflow-hidden">
      {/* Glassmorphism background effect */}
      <div className="absolute inset-0 backdrop-blur-lg bg-black/20 z-0"></div>

      {/* Decorative elements */}
      <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-cyan-500/5 filter blur-[100px]"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-500/5 filter blur-[100px]"></div>

      {/* Main content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: About - With logo image instead of text */}
          <div className="space-y-6">
            <div className="flex items-center">
              {/* SUIDEX logo image instead of text */}
              <img src={suidex} alt="SuiDeX Logo" className="h-8 w-auto" />
            </div>

            <p className="text-gray-400 pr-4">
              The premier DEX on the Sui blockchain, offering lightning-fast
              swaps, optimal routing, and industry-leading security.
            </p>

            {/* Social icons grid */}
            <div className="flex flex-wrap gap-3">
              <SocialIcon
                Icon={FaXTwitter}
                href="https://x.com/SUITRUMPCOIN"
                label="Twitter"
              />
              <SocialIcon
                Icon={FaTelegramPlane}
                href="https://t.me/+cFvZCZYolVFiNDk1"
                label="Telegram"
              />
              <SocialIcon
                Icon={FaDiscord}
                href="https://discord.gg"
                label="Discord"
              />
              <SocialIcon
                Icon={FaMediumM}
                href="https://medium.com"
                label="Medium"
              />
              <SocialIcon
                Icon={FaGithub}
                href="https://github.com"
                label="GitHub"
                color="from-gray-600 to-gray-700"
              />
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-6 text-lg">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <FooterLink href="/swap">Swap Tokens</FooterLink>
              </li>
              <li>
                <FooterLink href="/pools">Liquidity Pools</FooterLink>
              </li>
              <li>
                <FooterLink href="/farm">Yield Farming</FooterLink>
              </li>
              <li>
                <FooterLink href="/stats">Analytics</FooterLink>
              </li>
              <li>
                <FooterLink href="/bridge">Bridge</FooterLink>
              </li>
              <li>
                <FooterLink href="/governance">Governance</FooterLink>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
            <h3 className="text-white font-semibold mb-6 text-lg">Resources</h3>
            <ul className="space-y-2">
              <li>
                <FooterLink href="/docs">Documentation</FooterLink>
              </li>
              <li>
                <FooterLink href="/guides">User Guides</FooterLink>
              </li>
              <li>
                <FooterLink href="/api">API</FooterLink>
              </li>
              <li>
                <FooterLink href="/developers">Developers</FooterLink>
              </li>
              <li>
                <FooterLink href="/blog">Blog</FooterLink>
              </li>
              <li>
                <FooterLink href="/faq">FAQ</FooterLink>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div>
            <h3 className="text-white font-semibold mb-6 text-lg">
              Stay Updated
            </h3>
            <p className="text-gray-400 mb-4">
              Subscribe to our newsletter for the latest updates and features.
            </p>

            {subscribed ? (
              <div className="bg-green-500/20 backdrop-blur-sm text-green-400 py-3 px-4 rounded-xl text-sm">
                Thank you for subscribing!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    required
                    className="w-full py-3 px-4 bg-white/5 backdrop-blur-md text-white rounded-xl border border-white/10 focus:border-cyan-500/50 outline-none transition-all duration-300"
                  />
                  <button
                    type="submit"
                    className="absolute right-1 top-1 bottom-1 px-3 bg-gradient-to-r from-cyan-500 to-green-500 hover:from-cyan-600 hover:to-green-600 rounded-lg flex items-center justify-center transition-all duration-300"
                  >
                    <ArrowRight size={18} className="text-white" />
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center space-x-2 mt-5">
              <Shield size={16} className="text-cyan-500" />
              <span className="text-gray-400 text-xs">
                Your data is secure with us
              </span>
            </div>
          </div>
        </div>

        {/* Middle section with partners */}
        <div className="my-10 py-10 border-t border-b border-white/10">
          <h4 className="text-center text-sm font-medium text-gray-400 mb-6">
            TRUSTED BY TOP PARTNERS IN THE ECOSYSTEM
          </h4>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-70">
            {/* Partner logos - replace with actual images */}
            <div className="h-8 w-24 bg-white/10 backdrop-blur-md rounded-md flex items-center justify-center">
              <span className="text-xs text-gray-400">Partner 1</span>
            </div>
            <div className="h-8 w-24 bg-white/10 backdrop-blur-md rounded-md flex items-center justify-center">
              <span className="text-xs text-gray-400">Partner 2</span>
            </div>
            <div className="h-8 w-24 bg-white/10 backdrop-blur-md rounded-md flex items-center justify-center">
              <span className="text-xs text-gray-400">Partner 3</span>
            </div>
            <div className="h-8 w-24 bg-white/10 backdrop-blur-md rounded-md flex items-center justify-center">
              <span className="text-xs text-gray-400">Partner 4</span>
            </div>
            <div className="h-8 w-24 bg-white/10 backdrop-blur-md rounded-md flex items-center justify-center">
              <span className="text-xs text-gray-400">Partner 5</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center mt-8">
          <div className="text-gray-500 text-sm mb-4 md:mb-0">
            © {currentYear} SuiDeX. All rights reserved.
          </div>

          <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-sm">
            <FooterLink href="/terms">Terms of Service</FooterLink>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/risk">Risk Disclosure</FooterLink>
            <FooterLink href="/cookies">Cookie Policy</FooterLink>
          </div>

          {/* Back to top button */}
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 bg-gradient-to-r from-cyan-500/80 to-purple-500/80 backdrop-blur-md p-3 rounded-full shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 cursor-pointer"
            aria-label="Scroll to top"
          >
            <FaChevronUp className="text-white" size={16} />
          </button>
        </div>
      </div>

      {/* Compliance bar */}
      <div className="bg-black/30 backdrop-blur-md mt-10 py-4 text-center text-gray-500 text-xs">
        <div className="container mx-auto px-6">
          <p>
            SuiDeX is a decentralized exchange protocol. Trading
            cryptocurrencies involves significant risk. Please do your own
            research before trading.
          </p>
        </div>
      </div>
    </footer>
  );
}
