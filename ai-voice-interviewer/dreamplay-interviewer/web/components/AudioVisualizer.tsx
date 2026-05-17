"use client";

import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
}

const BAR_COUNT = 32;

export function AudioVisualizer({ isActive, isSpeaking }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let audioCtx: AudioContext | null = null;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;
        draw();
      } catch {
        drawIdle();
      }
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const analyser = analyserRef.current;
      if (!analyser) return;

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / BAR_COUNT) * 0.6;
      const gap = (width / BAR_COUNT) * 0.4;

      for (let i = 0; i < BAR_COUNT; i++) {
        const value = data[i] ?? 0;
        const barHeight = Math.max(4, (value / 255) * height * 0.85);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        const alpha = 0.4 + (value / 255) * 0.6;
        ctx.fillStyle = `rgba(0, 194, 255, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    function drawIdle() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width, height } = canvas;
      const barWidth = (width / BAR_COUNT) * 0.6;
      const gap = (width / BAR_COUNT) * 0.4;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * (barWidth + gap);
        const barHeight = 4;
        const y = (height - barHeight) / 2;
        ctx.fillStyle = "rgba(0, 194, 255, 0.2)";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    }

    void setup();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
      analyserRef.current = null;
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive && !isSpeaking) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width, height } = canvas;
      const barWidth = (width / BAR_COUNT) * 0.6;
      const gap = (width / BAR_COUNT) * 0.4;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * (barWidth + gap);
        ctx.fillStyle = "rgba(0, 194, 255, 0.12)";
        ctx.beginPath();
        ctx.roundRect(x, height / 2 - 2, barWidth, 4, 2);
        ctx.fill();
      }
    }
  }, [isActive, isSpeaking]);

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={80}
      style={{ width: "100%", maxWidth: 480, height: 80 }}
      aria-label="Audio visualizer"
    />
  );
}
