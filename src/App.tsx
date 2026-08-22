import { useState } from 'react';
import AppShell from './components/layout/AppShell';
import MobileApp from './components/mobile/MobileApp';
import LoginScreen from './components/auth/LoginScreen';
import { isUnlocked } from './services/auth';
import { isMobileUI, isTouchDevice, setUIMode } from './utils/device';

export default function App() {
  const [unlocked, setUnlocked] = useState<boolean>(() => isUnlocked());
  // 只在啟動時判斷一次：正在排行程時把視窗拉窄，不該整個介面換掉
  const [mobile, setMobile] = useState<boolean>(() => isMobileUI());

  if (!unlocked) {
    return <LoginScreen onSuccess={() => setUnlocked(true)} />;
  }

  // 手機/平板 → 唯讀看行程 + 記流水帳；排行程一律用電腦版
  if (mobile) {
    return <MobileApp />;
  }

  return (
    <>
      <AppShell />
      {/* 真手機硬切到電腦版時，留一顆回手機版的路 */}
      {isTouchDevice() && (
        <button
          className="mv-back-to-mobile"
          onClick={() => {
            setUIMode('mobile');
            setMobile(true);
          }}
        >
          手機版
        </button>
      )}
    </>
  );
}
