import { useEffect, useState } from 'react';

export function useOtpCountdown(initialSeconds = 120) {
  const [countdown, setCountdown] = useState(initialSeconds);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const reset = (seconds = initialSeconds) => setCountdown(seconds);

  const formatted =
    countdown > 0
      ? `${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`
      : null;

  return { countdown, formatted, reset, canResend: countdown <= 0 };
}
