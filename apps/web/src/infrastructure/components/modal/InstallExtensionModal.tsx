'use client';

import React, { useState, useEffect } from 'react';
import { Puzzle, X, Download } from 'lucide-react';
import { colors } from '@entry-hub/shared';

export function useExtensionInstalled() {
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    const checkDom = () => {
      if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-entry-hub-installed') === 'true') {
        setIsInstalled(true);
      }
    };
    checkDom();

    const handleMsg = (e: MessageEvent) => {
      if (
        e.data?.type === 'ENTRY_HUB_EXTENSION_INSTALLED' ||
        e.data?.type === 'ENTRY_HUB_EXTENSION_PONG'
      ) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('message', handleMsg);
    window.postMessage({ type: 'CHECK_ENTRY_HUB_INSTALLED' }, '*');

    const timer = setInterval(() => {
      checkDom();
      window.postMessage({ type: 'CHECK_ENTRY_HUB_INSTALLED' }, '*');
    }, 1500);

    return () => {
      clearInterval(timer);
      window.removeEventListener('message', handleMsg);
    };
  }, []);

  return isInstalled;
}

export function InstallExtensionModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          maxWidth: '460px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: colors.mute,
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <Puzzle size={24} />
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: colors.ink }}>
          Entry-Hub 크롬 확장프로그램 설치
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: colors.mute, lineHeight: 1.6 }}>
          엔트리 작품 만들기(에디터) 화면에서 블록 코드, 오브젝트, 장면 에셋을 클릭 한 번으로 자유롭게 공유하고 불러올 수 있습니다.
        </p>

        <div
          style={{
            backgroundColor: colors.canvasSoft2,
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: colors.body,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '6px', color: colors.ink }}>
            설치 안내:
          </div>
          <ol style={{ margin: 0, paddingLeft: '18px' }}>
            <li>Chrome 브라우저 주소창에 <strong>chrome://extensions</strong> 입력</li>
            <li>우측 상단 <strong>[개발자 모드]</strong> 켜기</li>
            <li><strong>[압축해제된 확장 프로그램을 로드합니다]</strong> 클릭 후 다운로드한 폴더 선택</li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${colors.hairlineStrong}`,
              backgroundColor: '#fff',
              color: colors.body,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1.5,
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: colors.primary,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Download size={14} />
            <span>크롬 웹스토어로 가기</span>
          </a>
        </div>
      </div>
    </div>
  );
}
