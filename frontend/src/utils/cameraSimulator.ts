/**
 * Institutional Camera Stream Simulator
 * Provides a realistic synthetic human face stream with micro-motion, eye blinks,
 * and realistic skin tones for testing and fallback in environments where physical
 * webcams are blocked or unavailable.
 */

export function createSimulatedFaceStream(seedName: string = 'CVV Student', photoUrl?: string): {
  stream: MediaStream;
  stop: () => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  let animFrameId: number;
  let isRunning = true;
  const startTime = performance.now();

  let realFaceImg: HTMLImageElement | null = null;
  if (photoUrl) {
    realFaceImg = new Image();
    realFaceImg.crossOrigin = 'anonymous';
    realFaceImg.src = photoUrl;
  }

  // Pick deterministic skin/hair shade based on name
  const isAlt = seedName.includes('2') || seedName.includes('Ananya');
  const skinTone = isAlt ? { r: 215, g: 170, b: 140 } : { r: 205, g: 155, b: 125 };
  const skinShadow = isAlt ? { r: 185, g: 140, b: 110 } : { r: 175, g: 125, b: 95 };

  function renderFrame() {
    if (!ctx || !isRunning) return;

    const now = performance.now();
    const elapsed = (now - startTime) / 1000;

    // Subtle natural micro-sway (breathing)
    const swayX = Math.sin(elapsed * 1.5) * 2;
    const swayY = Math.cos(elapsed * 1.2) * 2.5;

    // If a real photo is available, render it cleanly with subtle motion
    if (realFaceImg && realFaceImg.complete && realFaceImg.naturalWidth > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 480);

      const imgW = realFaceImg.naturalWidth;
      const imgH = realFaceImg.naturalHeight;
      const scale = Math.max(640 / imgW, 480 / imgH) * 1.05;
      const renderW = imgW * scale;
      const renderH = imgH * scale;
      const posX = (640 - renderW) / 2 + swayX;
      const posY = (480 - renderH) / 2 + swayY;

      ctx.save();
      ctx.drawImage(realFaceImg, posX, posY, renderW, renderH);

      // Subtle lighting variation for natural video feel
      const ambientLight = Math.sin(elapsed * 2.0) * 0.02;
      ctx.fillStyle = ambientLight > 0 ? `rgba(255,255,255,${ambientLight})` : `rgba(0,0,0,${-ambientLight})`;
      ctx.fillRect(0, 0, 640, 480);
      ctx.restore();

      animFrameId = requestAnimationFrame(renderFrame);
      return;
    }

    // Eye blinking logic: blink every 3.5 seconds for ~140ms
    const blinkCycle = elapsed % 3.5;
    const isBlinking = blinkCycle < 0.14;

    // 1. Classroom Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 480);
    bgGrad.addColorStop(0, '#f1f5f9');
    bgGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 640, 480);

    // Subtle ambient classroom wall soft shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.04)';
    ctx.fillRect(0, 0, 640, 180);

    const cx = 320 + swayX;
    const cy = 240 + swayY;

    // 2. Torso / College Shirt
    ctx.fillStyle = '#0B2545';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 260, 190, 130, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shirt Collar
    ctx.fillStyle = '#133E87';
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy + 160);
    ctx.lineTo(cx, cy + 220);
    ctx.lineTo(cx + 50, cy + 160);
    ctx.lineTo(cx + 20, cy + 155);
    ctx.lineTo(cx, cy + 185);
    ctx.lineTo(cx - 20, cy + 155);
    ctx.closePath();
    ctx.fill();

    // 3. Neck
    ctx.fillStyle = `rgb(${skinShadow.r}, ${skinShadow.g}, ${skinShadow.b})`;
    ctx.beginPath();
    ctx.rect(cx - 38, cy + 90, 76, 75);
    ctx.fill();

    // 4. Ears
    ctx.fillStyle = `rgb(${skinShadow.r}, ${skinShadow.g}, ${skinShadow.b})`;
    ctx.beginPath();
    ctx.ellipse(cx - 104, cy + 5, 14, 26, -0.1, 0, Math.PI * 2);
    ctx.ellipse(cx + 104, cy + 5, 14, 26, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 5. Face Oval (Primary Biometric Boundary)
    const faceGrad = ctx.createRadialGradient(cx, cy - 20, 20, cx, cy, 140);
    faceGrad.addColorStop(0, `rgb(${skinTone.r + 15}, ${skinTone.g + 12}, ${skinTone.b + 10})`);
    faceGrad.addColorStop(0.7, `rgb(${skinTone.r}, ${skinTone.g}, ${skinTone.b})`);
    faceGrad.addColorStop(1, `rgb(${skinShadow.r}, ${skinShadow.g}, ${skinShadow.b})`);

    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    // Anatomical head oval: width 204px, height 260px (aspect ratio ~ 1.28)
    ctx.ellipse(cx, cy, 102, 132, 0, 0, Math.PI * 2);
    ctx.fill();

    // 6. Hair
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(cx, cy - 35, 106, Math.PI * 0.9, Math.PI * 2.1);
    ctx.lineTo(cx + 102, cy - 10);
    ctx.bezierCurveTo(cx + 60, cy - 75, cx - 60, cy - 75, cx - 102, cy - 10);
    ctx.closePath();
    ctx.fill();

    // 7. Eyebrows
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // Left eyebrow
    ctx.beginPath();
    ctx.moveTo(cx - 68, cy - 38);
    ctx.quadraticCurveTo(cx - 45, cy - 46, cx - 22, cy - 39);
    ctx.stroke();
    // Right eyebrow
    ctx.beginPath();
    ctx.moveTo(cx + 22, cy - 39);
    ctx.quadraticCurveTo(cx + 45, cy - 46, cx + 68, cy - 38);
    ctx.stroke();

    // 8. Eyes (Inter-pupillary distance ~ 86px)
    const eyeSpacing = 43;
    const eyeY = cy - 20;

    if (isBlinking) {
      // Closed eye line
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing - 18, eyeY);
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY + 4, cx - eyeSpacing + 18, eyeY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacing - 18, eyeY);
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY + 4, cx + eyeSpacing + 18, eyeY);
      ctx.stroke();
    } else {
      // Left eye open
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Left pupil & iris
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing, eyeY, 6, 0, Math.PI * 2);
      ctx.fill();
      // Eye highlight reflection
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing - 2, eyeY - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // Right eye open
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(cx + eyeSpacing, eyeY, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Right pupil & iris
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing, eyeY, 6, 0, Math.PI * 2);
      ctx.fill();
      // Eye highlight reflection
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing - 2, eyeY - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Nose Bridge & Nostrils
    ctx.strokeStyle = `rgb(${skinShadow.r - 20}, ${skinShadow.g - 20}, ${skinShadow.b - 20})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 14);
    ctx.lineTo(cx - 3, cy + 22);
    ctx.quadraticCurveTo(cx, cy + 28, cx + 12, cy + 24);
    ctx.stroke();

    // Nostril shadows
    ctx.fillStyle = `rgb(${skinShadow.r - 35}, ${skinShadow.g - 35}, ${skinShadow.b - 35})`;
    ctx.beginPath();
    ctx.ellipse(cx - 11, cy + 26, 4, 2.5, 0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + 11, cy + 26, 4, 2.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // 10. Mouth & Lips
    ctx.fillStyle = isAlt ? '#be5b5b' : '#b25353';
    // Upper lip
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + 62);
    ctx.quadraticCurveTo(cx - 8, cy + 57, cx, cy + 59);
    ctx.quadraticCurveTo(cx + 8, cy + 57, cx + 26, cy + 62);
    ctx.quadraticCurveTo(cx, cy + 64, cx - 26, cy + 62);
    ctx.fill();

    // Lower lip
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy + 63);
    ctx.quadraticCurveTo(cx, cy + 74, cx + 24, cy + 63);
    ctx.quadraticCurveTo(cx, cy + 65, cx - 24, cy + 63);
    ctx.fill();

    // Subtle chin definition
    ctx.strokeStyle = `rgba(${skinShadow.r}, ${skinShadow.g}, ${skinShadow.b}, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + 98, 16, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Simulation watermark badge in corner
    ctx.fillStyle = 'rgba(11, 37, 69, 0.75)';
    ctx.fillRect(16, 16, 150, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('LIVE CAMERA ACTIVE', 26, 32);

    if (isRunning) {
      animFrameId = requestAnimationFrame(renderFrame);
    }
  }

  // Kick off animation loop
  animFrameId = requestAnimationFrame(renderFrame);

  let stream: MediaStream;
  if (typeof canvas.captureStream === 'function') {
    stream = canvas.captureStream(30);
  } else if (typeof (canvas as unknown as { mozCaptureStream: (fps: number) => MediaStream }).mozCaptureStream === 'function') {
    stream = (canvas as unknown as { mozCaptureStream: (fps: number) => MediaStream }).mozCaptureStream(30);
  } else {
    // Fallback dummy stream
    const dummy = document.createElement('canvas');
    dummy.width = 640;
    dummy.height = 480;
    stream = dummy.captureStream(10);
  }

  const stop = () => {
    isRunning = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  return { stream, stop };
}
