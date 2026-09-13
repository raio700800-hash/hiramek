/**
 * =============================================================================
 * 📲 PWA ＆ オフラインサポートモジュール (pwa.js)
 * =============================================================================
 * Service Worker の登録と、オフライン状態の監視、
 * 「ホーム画面に追加」バナーを親切にコントロールします。
 */

// Service Worker の登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('✅ PWA Service Worker 登録成功:', reg.scope);
      })
      .catch(err => {
        console.warn('⚠️ Service Worker 登録失敗 (ローカルfileプロトコル等の場合):', err);
      });
  });
}

// オンライン/オフライン状態の監視
window.addEventListener('online', () => {
  showNetworkToast('📡 オンラインに復帰しました！', 'bg-emerald-600');
});

window.addEventListener('offline', () => {
  showNetworkToast('⚡ 現在オフラインですが、全機能そのまま使えます！', 'bg-amber-600');
});

function showNetworkToast(text, bgClass) {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 z-50 px-4 py-2 text-white text-xs font-medium rounded-xl shadow-lg transition-all transform translate-y-2 ${bgClass}`;
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2');
  }, 50);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
