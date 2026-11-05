'use client';

import React from 'react';
import { Header } from '../../infrastructure/components/layout/Header';
import { Footer } from '../../infrastructure/components/layout/Footer';
import { useTheme } from '../../infrastructure/theme/ThemeContext';

export default function TermsPage() {
  const { colors } = useTheme();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
      <Header />

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 16px', color: colors.ink }}>
          이용약관 및 운영 정책
        </h1>
        <p style={{ fontSize: '14px', color: colors.mute, marginBottom: '40px' }}>
          최종 개정일: 2026년 10월 26일
        </p>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '32px', color: colors.body, lineHeight: '1.7', fontSize: '15px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              제 1 조 (목적 및 서비스 정의)
            </h2>
            <p style={{ margin: 0 }}>
              Entry-Hub(이하 "서비스")는 네이버 엔트리(Entry) 플랫폼 사용자들이 자유롭게 블록 코드, 오브젝트, 장면 에셋을 공유하고 상호 주입/불러오기 할 수 있도록 지원하는 비공식 오픈 커뮤니티 플랫폼입니다. 본 서비스는 네이버 엔트리 연구소와 직접적인 제휴 관계가 없습니다.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              제 2 조 (지적재산권 및 에셋 공유 규칙)
            </h2>
            <p style={{ margin: 0 }}>
              1. 사용자가 서비스에 업로드한 에셋의 저작권은 원작자에게 있습니다.<br />
              2. 사용자는 타인의 작품을 무단으로 복제하거나 지적재산권을 침해하는 코드를 업로드해서는 안 됩니다.<br />
              3. 타인의 권리를 침해하거나 악의적인 무한 루프, 렉 유발 스크립트가 포함된 에셋은 관리자 또는 신고 시스템에 의해 사전 고지 없이 숨김/삭제 처리될 수 있습니다.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              제 3 조 (개인정보의 처리)
            </h2>
            <p style={{ margin: 0 }}>
              서비스는 회원가입 및 서비스 제공을 위해 최소한의 정보(이메일, 닉네임, 엔트리 프로필 링크)만을 수집하며, 비밀번호는 Supabase Auth를 통해 강력한 단방향 암호화 처리되어 안전하게 보관됩니다.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              제 4 조 (면책조항)
            </h2>
            <p style={{ margin: 0 }}>
              서비스는 사용자가 공유한 에셋의 완전성, 무결성, 특정 목적에 대한 적합성에 관해 어떠한 보증도 하지 않으며, 엔트리 에디터 주입 과정에서 발생하는 예기치 못한 데이터 손실에 대해 책임을 지지 않습니다.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
