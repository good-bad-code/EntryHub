'use client';

import React from 'react';
import { Header } from '../../infrastructure/components/layout/Header';
import { Footer } from '../../infrastructure/components/layout/Footer';
import { useTheme } from '../../infrastructure/theme/ThemeContext';

export default function PrivacyPolicyPage() {
  const { colors } = useTheme();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.canvas }}>
      <Header />

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 16px', color: colors.ink }}>
          개인정보 처리방침
        </h1>
        <p style={{ fontSize: '14px', color: colors.mute, marginBottom: '40px' }}>
          시행일자: 2026년 10월 26일
        </p>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '32px', color: colors.body, lineHeight: '1.7', fontSize: '15px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              1. 수집하는 개인정보 항목
            </h2>
            <p style={{ margin: 0 }}>
              Entry-Hub(이하 "서비스")는 이용자의 계정 생성, 엔트리 계정 소유권 확인, 서비스 제공 및 운영을 위해 다음과 같은 최소한의 개인정보를 수집합니다:
            </p>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li><strong>필수 항목:</strong> 이메일 주소, 비밀번호(단방향 암호화), 닉네임, 엔트리 아이디/닉네임</li>
              <li><strong>선택 항목:</strong> 프로필 아바타 이미지, 엔트리 프로필 링크</li>
              <li><strong>서비스 이용 중 자동 생성/수집 정보:</strong> 접속 로그, 에셋 업로드/좋아요/북마크 기록</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              2. 개인정보의 수집 및 이용 목적
            </h2>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li>회원 가입 의사 확인 및 본인 식별/인증 (엔트리 계정 소유권 확인)</li>
              <li>에셋 업로드, 관리, 북마크, 좋아요 등 플랫폼 기능 제공</li>
              <li>부정 이용 방지, 비정상적 스크립트 모니터링 및 커뮤니티 운영 관리</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              3. 개인정보의 보유 및 파기
            </h2>
            <p style={{ margin: 0 }}>
              이용자의 개인정보는 원칙적으로 회원 탈퇴 시 지체 없이 파기됩니다. 단, 관계 법령에 따라 보존 의무가 있는 정보는 관련 법령이 정한 기간 동안 안전하게 보관 후 파기됩니다.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              4. 개인정보의 제3자 제공 및 위탁
            </h2>
            <p style={{ margin: 0 }}>
              서비스는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 안정적인 데이터베이스 호스팅 및 인증 시스템 관리를 위해 <strong>Supabase (AWS Cloud)</strong>를 인프라 위탁 사업자로 사용하고 있습니다.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.ink, margin: '0 0 8px' }}>
              5. 이용자의 권리 및 문의
            </h2>
            <p style={{ margin: 0 }}>
              이용자는 언제든지 본인의 개인정보를 조회, 수정, 삭제 요청할 수 있으며, 관련 문의는 서비스 관리자(learn.code.ing.ing@gmail.com)를 통해 처리할 수 있습니다.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
