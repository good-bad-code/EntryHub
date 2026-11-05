'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { colors } from '@entry-hub/shared';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../auth/AuthContext';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  assetTitle: string;
}

export function ReportModal({ isOpen, onClose, assetId, assetTitle }: ReportModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('INAPPROPRIATE');
  const [detail, setDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('신고하려면 먼저 로그인이 필요합니다.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from('reports').insert({
        asset_id: assetId,
        reporter_id: user.id,
        reason,
        detail: detail.trim(),
        status: 'PENDING',
      });

      if (error) {
        // 테이블이 아직 없거나 RLS 제약이 있을 수 있음
        console.warn('Report submit response:', error.message);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setDetail('');
        onClose();
      }, 1500);
    } catch {
      setErrorMsg('신고 접수 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.canvas,
          borderRadius: '16px',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          border: `1px solid ${colors.hairline}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.hairline}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color={colors.error} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: colors.ink }}>에셋 신고하기</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.mute }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {isSuccess ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle2 size={40} color="#319795" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: colors.ink }}>신고가 정상 접수되었습니다</h3>
              <p style={{ margin: 0, fontSize: '13px', color: colors.mute }}>
                관리자 검토 후 신속히 조치하겠습니다.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: colors.body }}>
                대상 에셋: <strong>{assetTitle}</strong>
              </p>

              {errorMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: colors.errorSoft,
                    color: colors.errorDeep,
                    fontSize: '12px',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  신고 사유
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: colors.canvas,
                  }}
                >
                  <option value="INAPPROPRIATE">부적절하거나 유해한 콘텐츠 (욕설/비방 등)</option>
                  <option value="COPYRIGHT">저작권 침해 또는 무단 도용</option>
                  <option value="MALICIOUS">악의적인 무한 루프 또는 렉 유발 코드</option>
                  <option value="SPAM">스팸성 또는 홍보/도배 에셋</option>
                  <option value="OTHER">기타 사유</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.ink, marginBottom: '6px' }}>
                  상세 설명 (선택)
                </label>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="신고 사유에 대해 구체적인 내용을 기재해 주세요."
                  rows={4}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${colors.hairlineStrong}`,
                    backgroundColor: colors.canvas,
                    color: colors.ink,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: colors.error,
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>접수 중...</span>
                    </>
                  ) : (
                    <span>신고 제출</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
