// Landing page enhancements: PWA install support detection.
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

// Show different "install" hint depending on platform.
const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua);
const isAndroid = /Android/.test(ua);

const hint = document.querySelector<HTMLParagraphElement>(".hint");
if (hint) {
  if (isIOS) {
    hint.textContent =
      "iPhone / iPad の場合は Safari の共有ボタンから「ホーム画面に追加」を選んでください。";
  } else if (isAndroid) {
    hint.textContent =
      "Android では Chrome のメニュー → 「アプリをインストール」でホーム画面に追加できます。";
  }
}

// Listen for the install prompt and offer a button if available.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  const btn = document.createElement("button");
  btn.textContent = "📲 このページからインストール";
  btn.className = "cta";
  btn.style.marginLeft = "12px";
  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    deferredPrompt = null;
    btn.remove();
  });
  document.querySelector(".hero .container")?.appendChild(btn);
});

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
