'use client'

import type { Dispatch, SetStateAction } from 'react'
import { palette } from '@/utils/theme'
import { AgreementDetails } from '../AgreementDetails'

/** 가입에 필요 없는 선택 동의: 익명 평균 분석, 친구 비교 공유, AI 연습 제안. */
export default function OptionalConsents({ isSignUp, allowAnonymousAggregate, setAllowAnonymousAggregate, allowFriendSharing, setAllowFriendSharing, allowAiAnalysis, setAllowAiAnalysis }: { isSignUp: boolean; allowAnonymousAggregate: boolean; setAllowAnonymousAggregate: Dispatch<SetStateAction<boolean>>; allowFriendSharing: boolean; setAllowFriendSharing: Dispatch<SetStateAction<boolean>>; allowAiAnalysis: boolean; setAllowAiAnalysis: Dispatch<SetStateAction<boolean>> }) {
  return (
    <>
      {isSignUp && <fieldset style={{ display: 'grid', gap: 10, margin: 0, padding: 12, border: `1px solid ${palette.slate300}`, borderRadius: 10, background: palette.slate50 }}>
        <legend style={{ padding: '0 4px', color: palette.slate900, fontSize: 12, fontWeight: 800 }}>선택 동의 · 동의하지 않아도 가입할 수 있습니다</legend>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: palette.slate700, fontSize: 12, lineHeight: 1.5 }}>
          <input type="checkbox" checked={allowAnonymousAggregate} onChange={(event) => setAllowAnonymousAggregate(event.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          <span><strong>라운드 통계의 익명 평균 분석 참여</strong><br />구장·플레이 방식·실력 그룹별 스코어, 퍼트, 페어웨이·그린 적중 통계를 비교 평균에 포함합니다. 이름·이메일·계정 ID는 비교 화면에 표시하지 않으며 5명 이상 표본에서만 결과를 제공합니다. 동의를 끄면 내 라운드는 평균 계산에서 제외됩니다.</span>
        </label>
        <details style={{ margin: '-5px 0 0 24px', color: palette.slate600, fontSize: 11, lineHeight: 1.55 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>통계 분석 항목과 이용 목적</summary>
          <p style={{ margin: '5px 0 0' }}>선택한 라운드의 구장, 필드/스크린 방식, 실력 그룹, 총 스코어·퍼트 및 홀별 페어웨이·그린 적중 정보를 서버에서 합산해 이용자 비교와 연습 분석을 제공합니다. 이름·이메일·계정 ID·샷별 목록은 평균 결과에 공개하지 않습니다. 설정을 철회하면 이후 평균 계산에서 제외됩니다.</p>
        </details>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: palette.slate700, fontSize: 12, lineHeight: 1.5 }}>
          <input type="checkbox" checked={allowFriendSharing} onChange={(event) => setAllowFriendSharing(event.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          <span><strong>친구 비교 데이터 공유 동의</strong><br />상호 친구로 수락한 회원에게 내가 개별 라운드를 ‘친구 공개’로 지정한 경우에만 해당 라운드의 스코어·퍼트 평균을 제공합니다. 샷별 기록과 연락처는 공개하지 않습니다.</span>
        </label>
        <details style={{ margin: '-5px 0 0 24px', color: palette.slate600, fontSize: 11, lineHeight: 1.55 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>제공 대상·항목·철회 방법</summary>
          <p style={{ margin: '5px 0 0' }}>제공받는 사람은 서로 친구 요청을 수락한 서비스 회원이며 목적은 친구 간 라운드 평균 비교입니다. 공개 대상으로 지정한 완료 라운드의 스코어와 퍼트 집계만 제공합니다. 동의를 끄면 친구 공개 중인 라운드도 비공개로 바뀌며 다시 공개하려면 라운드별로 지정해야 합니다. 동의 거부 시 기본 스코어 기록은 계속 이용할 수 있습니다.</p>
        </details>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}><input type="checkbox" checked={allowAiAnalysis} onChange={e => setAllowAiAnalysis(e.target.checked)} /><span><strong>AI 연습 제안 분석</strong><br />샷 기록을 OpenAI API에 보내 개인 연습 제안을 받습니다.</span></label>
        <AgreementDetails kind="ai" />
        <p style={{ margin: 0, color: palette.slate500, fontSize: 10, lineHeight: 1.5 }}>선택 동의는 언제든 MY에서 변경할 수 있습니다.</p>
      </fieldset>}
    </>
  )
}
