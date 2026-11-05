import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n";
import { focusOf, frameOf, hashGuide } from "./scan/capture";
import type { Frame } from "./scan/search";
import { guideRect } from "./scan/frame";
import { AutoCapture, focusColor, FOCUS_OK } from "./scan/sharpness";

const POLL_MS = 250;

/**
 * Live camera with a card-shaped guide. The guide goes from red to green with the focus of what is
 * inside it; once a card is held still and sharp the picture is taken by itself, card after card (or with the button). The caller gets
 * the picture to look for the card in; it is never stored or sent.
 */
export function ScanCamera({ onCapture, onStop, auto }: { onCapture: (frame: Frame) => void; onStop: () => void; auto: boolean }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const autoCapture = useRef(new AutoCapture());
  const callback = useRef(onCapture);
  callback.current = onCapture;
  const autoOn = useRef(auto);
  autoOn.current = auto;

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("scan.camera.unsupported"));
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        const el = video.current;
        if (!el) return;
        el.srcObject = stream;
        await el.play();
        setSize({ w: el.videoWidth, h: el.videoHeight });
        timer = setInterval(() => {
          const v = video.current;
          if (!v || v.readyState < 2) return;
          const next = focusOf(v);
          setLevel(next);
          if (autoOn.current && autoCapture.current.update({ level: next, hash: hashGuide(v) })) callback.current(frameOf(v));
        }, POLL_MS);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // The camera is started once per mount; the texts only matter for an error message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="scan-camera-error">
        <p className="error">{t("scan.camera.denied", { message: error })}</p>
        <button type="button" onClick={onStop}>
          {t("scan.camera.stop")}
        </button>
      </div>
    );
  }

  const guide = size ? guideRect(size.w, size.h) : null;
  const color = focusColor(level);
  const take = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    autoCapture.current.rearm();
    callback.current(frameOf(v));
  };

  return (
    <div className="scan-camera">
      <div className="scan-view" style={size ? { aspectRatio: `${size.w} / ${size.h}` } : undefined}>
        <video ref={video} playsInline muted />
        {guide && (
          <div
            className="scan-guide"
            data-testid="scan-guide"
            style={{ left: `${guide.x * 100}%`, top: `${guide.y * 100}%`, width: `${guide.w * 100}%`, height: `${guide.h * 100}%`, borderColor: color }}
          />
        )}
      </div>
      <div className="scan-focus" role="meter" aria-label={t("scan.focus")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
        <span style={{ width: `${level * 100}%`, background: color }} />
      </div>
      <p className="hint">{level >= FOCUS_OK ? t("scan.focus.ok") : t("scan.focus.hint")}</p>
      <div className="scan-camera-actions">
        <button type="button" className="btn-primary" onClick={take} disabled={!size}>
          {t("scan.capture")}
        </button>
        <button type="button" onClick={onStop}>
          {t("scan.camera.stop")}
        </button>
      </div>
    </div>
  );
}
