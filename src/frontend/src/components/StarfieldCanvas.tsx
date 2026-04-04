import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  speed: number;
  twinkleOffset: number;
}

export default function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let stars: Star[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 250 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random(),
        size: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.7 + 0.2,
        speed: Math.random() * 0.15 + 0.05,
        twinkleOffset: Math.random() * Math.PI * 2,
      }));
    };

    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const draw = () => {
      t += 0.01;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bg.addColorStop(0, "#040B14");
      bg.addColorStop(0.6, "#071423");
      bg.addColorStop(1, "#0A1C2D");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const nebula = ctx.createRadialGradient(
        canvas.width * 0.85,
        canvas.height * 0.3,
        0,
        canvas.width * 0.85,
        canvas.height * 0.3,
        canvas.width * 0.5,
      );
      nebula.addColorStop(0, "rgba(35, 230, 242, 0.04)");
      nebula.addColorStop(0.5, "rgba(11, 58, 90, 0.03)");
      nebula.addColorStop(1, "rgba(4, 11, 20, 0)");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const nebula2 = ctx.createRadialGradient(
        canvas.width * 0.15,
        canvas.height * 0.7,
        0,
        canvas.width * 0.15,
        canvas.height * 0.7,
        canvas.width * 0.35,
      );
      nebula2.addColorStop(0, "rgba(100, 60, 180, 0.03)");
      nebula2.addColorStop(0.5, "rgba(50, 20, 100, 0.02)");
      nebula2.addColorStop(1, "rgba(4, 11, 20, 0)");
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const star of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.5 + star.twinkleOffset);
        const alpha = star.opacity * (0.6 + 0.4 * twinkle);

        star.y -= star.speed * (star.z * 0.8 + 0.2);
        if (star.y < -2) star.y = canvas.height + 2;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${
          star.z > 0.5 ? "111, 251, 255" : "234, 243, 255"
        }, ${alpha})`;
        ctx.fill();

        if (star.z > 0.7 && star.size > 1) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(35, 230, 242, ${alpha * 0.15})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
