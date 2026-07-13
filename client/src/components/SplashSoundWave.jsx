import React, { useEffect, useRef } from 'react';

export default function SplashSoundWave() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = canvas.parentElement.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight || window.innerHeight);

    // Initialize mouse at center
    mouseRef.current = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2
    };

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e) => {
      // Get mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = e.clientX - rect.left;
      mouseRef.current.targetY = e.clientY - rect.top;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Wave parameters
    const barCount = 120;
    const innerRadius = 85; // slightly larger than the logo container
    const bars = Array.from({ length: barCount }, (_, i) => {
      const angle = (i / barCount) * Math.PI * 2;
      return {
        angle,
        amplitude: 0,
        targetAmplitude: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.05 + Math.random() * 0.05
      };
    });

    const animate = () => {
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Distance from mouse to center
      const dx = mouse.x - centerX;
      const dy = mouse.y - centerY;
      const mouseDistance = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate angle of mouse relative to center
      const mouseAngle = Math.atan2(dy, dx);

      // Draw sound waves
      bars.forEach((bar, i) => {
        // Frequency modulator
        bar.phase += bar.speed;
        
        // Base sound wave oscillation
        let baseWave = Math.sin(bar.phase) * 15 + Math.cos(bar.phase * 2.5) * 8;
        if (baseWave < 0) baseWave = Math.abs(baseWave) * 0.3; // keep it mostly outward

        // Mouse interaction: boost amplitude if mouse is close
        const distanceInfluence = Math.max(0, 1 - mouseDistance / 400); // 400px range
        
        // Angle similarity: waves pointing towards the mouse get an extra boost
        let angleDiff = Math.abs(bar.angle - mouseAngle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
        const directionInfluence = Math.max(0, 1 - angleDiff / (Math.PI / 3)); // 60 deg cone

        const mouseBoost = distanceInfluence * (15 + directionInfluence * 35);
        
        bar.targetAmplitude = 8 + baseWave + mouseBoost;
        // Smooth interpolation
        bar.amplitude += (bar.targetAmplitude - bar.amplitude) * 0.2;

        const startX = centerX + Math.cos(bar.angle) * innerRadius;
        const startY = centerY + Math.sin(bar.angle) * innerRadius;
        
        // Dynamic length
        const endX = centerX + Math.cos(bar.angle) * (innerRadius + bar.amplitude);
        const endY = centerY + Math.sin(bar.angle) * (innerRadius + bar.amplitude);

        // Soundwave styling (gradient & glowing lines)
        const lineGrad = ctx.createLinearGradient(startX, startY, endX, endY);
        lineGrad.addColorStop(0, 'rgba(6, 182, 212, 0.9)'); // bright cyan near logo
        lineGrad.addColorStop(0.5, 'rgba(124, 58, 237, 0.8)'); // purple middle
        lineGrad.addColorStop(1, 'rgba(255, 174, 0, 0)'); // fade out to gold/transparent

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        
        // Add glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.4)';

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      });

      // Draw secondary concentric expanding sound ripples
      ctx.shadowBlur = 0;
      for (let r = 0; r < 3; r++) {
        const ripplePhase = (Date.now() * 0.001 + r * 0.5) % 1.5; // expansion phase
        const radius = innerRadius + ripplePhase * 120;
        const opacity = Math.max(0, 1 - ripplePhase / 1.5) * 0.12;
        
        ctx.strokeStyle = `rgba(124, 58, 237, ${opacity})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}
