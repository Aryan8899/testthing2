import { useEffect, useRef, useState } from "react";

const SuiPremiumBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size with high DPI support
    const setCanvasSize = () => {
      if (!canvas) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({ width, height });

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
    };

    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    // Create premium background with deep gradient
    const createGradientBackground = () => {
      // Premium dark gradient with subtle color shifts
      const gradient = ctx.createRadialGradient(
        canvas.width / 2 / dpr,
        canvas.height / 2 / dpr,
        0,
        canvas.width / 2 / dpr,
        (canvas.height * 0.8) / dpr,
        canvas.width / dpr
      );

      // Rich color progression from center to edges
      gradient.addColorStop(0, "#09081e"); // Deep blue-black center
      gradient.addColorStop(0.3, "#0c1032"); // Dark blue
      gradient.addColorStop(0.6, "#131245"); // Indigo tone
      gradient.addColorStop(1, "#1b1052"); // Rich purple edge

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    };

    // Enhanced Ripple System
    // Subtle Particle System
    class ParticleSystem {
      particles: Array<{
        x: number;
        y: number;
        size: number;
        color: string;
        opacity: number;
        speed: number;
        angle: number;
        pulse: number;
        pulseSpeed: number;
      }>;
      maxParticles: number;

      constructor() {
        this.particles = [];
        // Scale particle count based on screen size
        const area = window.innerWidth * window.innerHeight;
        this.maxParticles = Math.min(
          150,
          Math.max(80, Math.floor(area / 10000))
        );

        this.initParticles();
      }

      initParticles() {
        for (let i = 0; i < this.maxParticles; i++) {
          this.addParticle();
        }
      }

      addParticle() {
        // Particle colors in Sui blue/purple brand colors
        const colors = [
          "#6366f1", // Indigo
          "#4f46e5", // Violet
          "#4338ca", // Indigo/Blue
          "#7c3aed", // Purple
          "#8b5cf6", // Light purple
        ];

        const color = colors[Math.floor(Math.random() * colors.length)];

        // Create premium-looking particle
        this.particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: 0.5 + Math.random() * 1.5,
          color: color,
          opacity: 0.2 + Math.random() * 0.3,
          speed: 0.1 + Math.random() * 0.2,
          angle: Math.random() * Math.PI * 2,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.01 + Math.random() * 0.02,
        });
      }

      update() {
        this.particles.forEach((p) => {
          // Very gentle movement
          p.x += Math.cos(p.angle) * p.speed;
          p.y += Math.sin(p.angle) * p.speed;

          // Subtle change in direction
          p.angle += (Math.random() - 0.5) * 0.03;

          // Pulse opacity for sparkle effect
          p.pulse += p.pulseSpeed;
          p.opacity = 0.2 + Math.sin(p.pulse) * 0.2;

          // Wrap around screen
          if (p.x < -10) p.x = window.innerWidth + 10;
          if (p.x > window.innerWidth + 10) p.x = -10;
          if (p.y < -10) p.y = window.innerHeight + 10;
          if (p.y > window.innerHeight + 10) p.y = -10;
        });
      }

      draw(ctx: CanvasRenderingContext2D) {
        this.particles.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;

          // Add glow effect to larger particles
          if (p.size > 1) {
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.size * 3;
          }

          ctx.fill();

          // Reset shadow
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        });
      }
    }

    // Energy Orbs System
    class EnergyOrbsSystem {
      orbs: Array<{
        x: number;
        y: number;
        radius: number;
        color: string;
        opacity: number;
        pulseSpeed: number;
        pulsePhase: number;
      }>;

      constructor() {
        this.orbs = [];

        // Add energy orbs at strategic positions
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Create 3-5 orbs at strategic positions
        const numOrbs = Math.floor(3 + Math.random() * 3);

        // Use golden ratio positions
        const goldenRatio = 0.618;

        this.addOrb(
          width * goldenRatio,
          height * goldenRatio,
          120 + Math.random() * 60
        );
        this.addOrb(
          width * (1 - goldenRatio),
          height * (1 - goldenRatio),
          100 + Math.random() * 50
        );

        // Add remaining orbs
        for (let i = 2; i < numOrbs; i++) {
          // Add at rule of thirds intersections
          const x = (width * (1 + Math.floor(Math.random() * 2))) / 3;
          const y = (height * (1 + Math.floor(Math.random() * 2))) / 3;
          this.addOrb(x, y, 80 + Math.random() * 40);
        }
      }

      addOrb(x: number, y: number, radius: number) {
        // Deep blue to purple colors
        const hues = [240, 250, 260, 270]; // Blue to purple range
        const hue = hues[Math.floor(Math.random() * hues.length)];

        this.orbs.push({
          x,
          y,
          radius,
          color: `hsl(${hue}, 70%, 50%)`,
          opacity: 0.06 + Math.random() * 0.04,
          pulseSpeed: 0.003 + Math.random() * 0.002,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }

      update() {
        this.orbs.forEach((orb) => {
          // Update pulse
          orb.pulsePhase += orb.pulseSpeed;
        });
      }

      draw(ctx: CanvasRenderingContext2D) {
        this.orbs.forEach((orb) => {
          // Calculate pulse scale
          const pulse = 0.9 + Math.sin(orb.pulsePhase) * 0.1;
          const currentRadius = orb.radius * pulse;

          // Draw orb with gradient
          const gradient = ctx.createRadialGradient(
            orb.x,
            orb.y,
            0,
            orb.x,
            orb.y,
            currentRadius
          );

          // Create smooth gradient with transparency
          gradient.addColorStop(
            0,
            `${orb.color.replace("hsl", "hsla").replace(")", ", 0)")}`
          );
          gradient.addColorStop(
            0.4,
            `${orb.color
              .replace("hsl", "hsla")
              .replace(")", ", " + orb.opacity * 0.5 + ")")}`
          );
          gradient.addColorStop(
            0.7,
            `${orb.color
              .replace("hsl", "hsla")
              .replace(")", ", " + orb.opacity * 0.3 + ")")}`
          );
          gradient.addColorStop(
            1,
            `${orb.color.replace("hsl", "hsla").replace(")", ", 0)")}`
          );

          ctx.beginPath();
          ctx.arc(orb.x, orb.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;

          // Add subtle glow
          ctx.shadowColor = orb.color;
          ctx.shadowBlur = 20;

          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }
    }

    // Shimmering Highlights System
    class ShimmeringHighlightsSystem {
      highlights: Array<{
        x: number;
        y: number;
        size: number;
        opacity: number;
        speed: number;
        color: string;
      }>;
      maxHighlights: number;

      constructor() {
        this.highlights = [];
        // Scale based on screen size
        const area = window.innerWidth * window.innerHeight;
        this.maxHighlights = Math.min(
          20,
          Math.max(10, Math.floor(area / 40000))
        );

        for (let i = 0; i < this.maxHighlights; i++) {
          this.addHighlight();
        }
      }

      addHighlight() {
        // Position highlight
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;

        // Size variations
        const size = 1 + Math.random() * 3;

        // Colors - bright versions of Sui colors
        const colors = [
          "rgba(255, 255, 255, 0.8)",
          "rgba(200, 210, 255, 0.8)",
          "rgba(180, 180, 255, 0.8)",
        ];

        this.highlights.push({
          x,
          y,
          size,
          opacity: 0,
          speed: 0.02 + Math.random() * 0.03,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      update() {
        this.highlights.forEach((highlight, index) => {
          // Increase opacity until fully visible
          highlight.opacity += highlight.speed;

          // Once fully visible, create a new highlight
          if (highlight.opacity >= 1) {
            // Reset this highlight
            this.highlights[index] = {
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              size: 1 + Math.random() * 3,
              opacity: 0,
              speed: 0.02 + Math.random() * 0.03,
              color: highlight.color,
            };
          }
        });
      }

      draw(ctx: CanvasRenderingContext2D) {
        this.highlights.forEach((highlight) => {
          // Draw shimmering highlight
          ctx.beginPath();
          ctx.arc(highlight.x, highlight.y, highlight.size, 0, Math.PI * 2);
          ctx.fillStyle = highlight.color;
          ctx.globalAlpha = highlight.opacity;

          // Add glow
          ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
          ctx.shadowBlur = highlight.size * 5;

          ctx.fill();

          // Reset
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        });
      }
    }

    // Subtle Sui Symbol System
    class SuiSymbolsSystem {
      symbols: Array<{
        x: number;
        y: number;
        size: number;
        opacity: number;
        pulsePhase: number;
        pulseSpeed: number;
      }>;

      constructor() {
        this.symbols = [];

        // Create Sui symbols
        this.addSymbol(window.innerWidth * 0.8, window.innerHeight * 0.2, 60);
        this.addSymbol(window.innerWidth * 0.2, window.innerHeight * 0.8, 70);
      }

      addSymbol(x: number, y: number, size: number) {
        this.symbols.push({
          x,
          y,
          size,
          opacity: 0.07,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.005 + Math.random() * 0.002,
        });
      }

      update() {
        this.symbols.forEach((symbol) => {
          // Pulse opacity
          symbol.pulsePhase += symbol.pulseSpeed;
          symbol.opacity = 0.07 + Math.sin(symbol.pulsePhase) * 0.03;
        });
      }

      draw(ctx: CanvasRenderingContext2D) {
        this.symbols.forEach((symbol) => {
          ctx.save();

          ctx.translate(symbol.x, symbol.y);
          ctx.globalAlpha = symbol.opacity;

          ctx.lineWidth = 2;

          // Add subtle glow
          ctx.shadowColor = "#6366f1";
          ctx.shadowBlur = 10;

          ctx.stroke();
          ctx.restore();
        });
      }
    }

    // Initialize systems
    const particles = new ParticleSystem();
    const energyOrbs = new EnergyOrbsSystem();
    const shimmeringHighlights = new ShimmeringHighlightsSystem();
    const suiSymbols = new SuiSymbolsSystem();

    // Main animation loop
    const animate = (time: number) => {
      // Clear canvas and draw background
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      createGradientBackground();

      // Update all systems
      particles.update();
      energyOrbs.update();
      shimmeringHighlights.update();
      suiSymbols.update();

      // Draw in correct order (background to foreground)
      energyOrbs.draw(ctx);
      suiSymbols.draw(ctx);
      particles.draw(ctx);
      shimmeringHighlights.draw(ctx);

      // Add premium vignette effect
      const gradient = ctx.createRadialGradient(
        canvas.width / 2 / dpr,
        canvas.height / 2 / dpr,
        0,
        canvas.width / 2 / dpr,
        canvas.height / 2 / dpr,
        Math.max(canvas.width, canvas.height) / dpr
      );

      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(0.85, "rgba(0, 0, 0, 0.4)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      // Continue animation loop
      animationFrameId = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrameId = requestAnimationFrame(animate);

    // Cleanup function
    return () => {
      window.removeEventListener("resize", setCanvasSize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10 w-full h-full"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
        }}
      />

      {/* Premium Lens Flare */}
      <div
        className="fixed inset-0 -z-9 pointer-events-none opacity-20"
        style={{
          background: `radial-gradient(circle at 75% 25%, rgba(99, 102, 241, 0.7) 0%, rgba(0, 0, 0, 0) 35%)`,
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      {/* Subtle light beam */}
      <div
        className="fixed inset-0 -z-9 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(0, 0, 0, 0) 60%)`,
          pointerEvents: "none",
        }}
      />
    </>
  );
};

export default SuiPremiumBackground;
