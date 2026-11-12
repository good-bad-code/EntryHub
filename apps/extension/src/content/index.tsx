import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import { initVerificationWatcher, syncEntryNickname } from './verifier';

declare const chrome: any;

console.log('[Entry-Hub] Content script loaded on https://playentry.org/ws/*');

/**
 * 1. Page Context에 entry-bridge 스크립트 주입 (window.Entry 접근 허용)
 */
function injectBridgeScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('entry-bridge.js');
    script.onload = () => {
      console.log('[Entry-Hub] Bridge script successfully injected into page context');
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (err) {
    console.warn('[Entry-Hub] Bridge injection fallback, attempting inline injection:', err);
  }
}

/**
 * 2. #entryButtonTab 최우측에 'Entry-Hub' 버튼 주입 및 사이드바 마운트
 */
function initSidebarInjector() {
  let isSidebarOpen = false;
  let rootElement: HTMLElement | null = null;
  let reactRoot: any = null;

  function ensureMountContainer() {
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'entry-hub-sidebar-root';
      document.body.appendChild(rootElement);
      reactRoot = createRoot(rootElement);
    }
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    renderSidebar();
  }

  function renderSidebar() {
    ensureMountContainer();
    if (isSidebarOpen) {
      reactRoot.render(
        <React.StrictMode>
          <App onClose={() => {
            isSidebarOpen = false;
            renderSidebar();
          }} />
        </React.StrictMode>
      );
    } else {
      reactRoot.render(null);
    }
  }

  function tryAttachButton() {
    const buttonTab = document.querySelector('#entryButtonTab');
    if (!buttonTab) return false;

    // 이미 주입되어 있다면 중복 부착 방지
    if (document.querySelector('#entryHubTabButton')) return true;

    console.log('[Entry-Hub] Found #entryButtonTab! Attaching Entry-Hub button...');

    // 엔트리 기본 보관함 버튼과 분리하는 세로 구분선
    const divider = document.createElement('div');
    divider.id = 'entryHubDivider';
    divider.style.width = '1px';
    divider.style.height = '14px';
    divider.style.backgroundColor = '#d5dbe2';
    divider.style.margin = '0 6px';
    divider.style.display = 'inline-block';
    divider.style.verticalAlign = 'middle';

    const btn = document.createElement('div');
    btn.id = 'entryHubTabButton';
    btn.className = 'entryTabButton'; // 엔트리 기존 탭 스타일 호환
    btn.title = 'Entry-Hub 에셋 보관함 열기';
    btn.style.cursor = 'pointer';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.width = '34px';
    btn.style.height = '34px';
    btn.style.borderRadius = '8px';
    btn.style.border = '1px solid #d5dbe2';
    btn.style.backgroundColor = '#ffffff';
    btn.style.marginRight = '6px'; // 우측 끝과의 여백
    btn.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
    btn.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
    btn.style.verticalAlign = 'middle';

    const iconImg = document.createElement('img');
    iconImg.src = chrome.runtime.getURL('icons/icon48.png');
    iconImg.alt = 'Entry-Hub';
    iconImg.style.width = '24px';
    iconImg.style.height = '24px';
    iconImg.style.borderRadius = '5px';
    iconImg.style.objectFit = 'contain';
    iconImg.style.transition = 'transform 0.2s ease';
    btn.appendChild(iconImg);

    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#f0f7ff';
      btn.style.borderColor = '#0070f3';
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 3px 8px rgba(0, 112, 243, 0.18)';
      iconImg.style.transform = 'scale(1.1)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = '#ffffff';
      btn.style.borderColor = '#d5dbe2';
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
      iconImg.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    buttonTab.appendChild(divider);
    buttonTab.appendChild(btn);
    return true;
  }

  // 엔트리 에디터는 SPA 형태이므로 MutationObserver로 DOM 로딩 대기
  const attached = tryAttachButton();
  if (!attached) {
    const observer = new MutationObserver(() => {
      if (tryAttachButton()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// 도메인별 실행 분기
const hostname = window.location.hostname;
const isEntryHubSite =
  hostname.includes('entry-hub-site.vercel.app') ||
  hostname.includes('localhost') ||
  hostname.includes('127.0.0.1');

if (isEntryHubSite) {
  // Entry-Hub 웹사이트에 확장프로그램 설치 표식 등록
  document.documentElement.setAttribute('data-entry-hub-installed', 'true');
  window.postMessage({ type: 'ENTRY_HUB_EXTENSION_INSTALLED', version: '1.2.4' }, '*');

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'CHECK_ENTRY_HUB_INSTALLED') {
      document.documentElement.setAttribute('data-entry-hub-installed', 'true');
      window.postMessage({ type: 'ENTRY_HUB_EXTENSION_PONG', version: '1.2.4' }, '*');
    }
  });

  console.log('[Entry-Hub] Extension installation beacon active on Entry-Hub website');
}

const isPlayEntry = hostname.includes('playentry.org');

if (isPlayEntry) {
  injectBridgeScript();
  initSidebarInjector();
  initVerificationWatcher();

  // 엔트리 페이지 로드 후 닉네임 실시간 자동 동기화 (확장 프로그램 컨텍스트 유효성 검사 포함)
  setTimeout(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        syncEntryNickname();
      }
    } catch { }
  }, 2500);

  const syncTimer = setInterval(() => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        clearInterval(syncTimer);
        return;
      }
      syncEntryNickname();
    } catch {
      clearInterval(syncTimer);
    }
  }, 60000);
}
