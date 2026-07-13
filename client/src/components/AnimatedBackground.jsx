import React, { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };
    const handleMouseLeave = () => {
      mouseRef.current.targetX = -1000;
      mouseRef.current.targetY = -1000;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Node parameter definitions
    const nodeCount = 75;
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      radius: Math.random() * 2 + 1,
    }));

    // Animation cycle settings (3 seconds total)
    // 0ms to 1200ms -> lines fade in (joining)
    // 1200ms to 1800ms -> lines fully joined
    // 1800ms to 3000ms -> lines fade out (removed)
    const cycleDuration = 3000; 

    const animate = () => {
      const mouse = mouseRef.current;
      // Ease mouse tracking
      if (mouse.targetX !== -1000) {
        if (mouse.x === -1000) {
          mouse.x = mouse.targetX;
          mouse.y = mouse.targetY;
        } else {
          mouse.x += (mouse.targetX - mouse.x) * 0.1;
          mouse.y += (mouse.targetY - mouse.y) * 0.1;
        }
      } else {
        mouse.x = -1000;
        mouse.y = -1000;
      }

      // Draw plain dark theme background
      ctx.fillStyle = '#060814';
      ctx.fillRect(0, 0, width, height);

      // Draw futuristic faint grid matrix
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      const gridSpacing = 80;
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Calculate line opacity cycle modifier
      const now = Date.now();
      const elapsedInCycle = now % cycleDuration;
      let lineOpacityModifier = 0;

      if (elapsedInCycle < 1200) {
        // First 1.2s: fade-in connecting lines (join)
        lineOpacityModifier = elapsedInCycle / 1200;
      } else if (elapsedInCycle >= 1200 && elapsedInCycle < 1800) {
        // Middle 0.6s: keep fully connected (joined)
        lineOpacityModifier = 1;
      } else {
        // Last 1.2s: fade-out connecting lines (remove)
        lineOpacityModifier = 1 - (elapsedInCycle - 1800) / 1200;
      }

      // Update and draw floating nodes
      nodes.forEach((node) => {
        // Move nodes
        node.x += node.vx;
        node.y += node.vy;

        // Wall collisions
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Draw particle dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw connecting lines if cycle opacity modifier is active
      if (lineOpacityModifier > 0) {
        ctx.lineWidth = 1;
        const maxDist = 120;

        for (let i = 0; i < nodeCount; i++) {
          const n1 = nodes[i];
          for (let j = i + 1; j < nodeCount; j++) {
            const n2 = nodes[j];
            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < maxDist) {
              // Calculate transparency based on distance + our cycle fade timing
              const proximity = 1 - dist / maxDist;
              const alpha = proximity * 0.22 * lineOpacityModifier;

              ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(n1.x, n1.y);
              ctx.lineTo(n2.x, n2.y);
              ctx.stroke();
            }
          }

          // Dynamic line connection to mouse cursor
          if (mouse.x !== -1000) {
            const mdx = n1.x - mouse.x;
            const mdy = n1.y - mouse.y;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 180) {
              const mproximity = 1 - mdist / 180;
              const malpha = mproximity * 0.3 * lineOpacityModifier;
              ctx.strokeStyle = `rgba(255, 255, 255, ${malpha})`;
              ctx.beginPath();
              ctx.moveTo(n1.x, n1.y);
              ctx.lineTo(mouse.x, mouse.y);
              ctx.stroke();
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}
