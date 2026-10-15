import { AgreementDetails } from '@/components/auth/AgreementDetails'
import type { UserDataPreferences } from './myTypes'
import { CARD, muted } from './myStyles'

interface SharingPreferencesSectionProps {
  dataPreferences: UserDataPreferences | null
  savingPreferences: boolean
  updateDataSharingPreference: (kind: 'anonymous_aggregate' | 'friend_sharing' | 'ai_practice_analysis', enabled: boolean) => Promise<void>
  updateScoreGuidePreference: (enabled: boolean) => Promise<void>
}

export default function SharingPreferencesSection({ dataPreferences, savingPreferences, updateDataSharingPreference, updateScoreGuidePreference }: SharingPreferencesSectionProps) {
  return (
    <section style={CARD} aria-labelledby="sharing-preferences-title">
      <h2 id="sharing-preferences-title" style={{ margin: '0 0 5px', fontSize: 16 }}>공유 및 도움말 설정</h2>
      <p style={{ ...muted, margin: '0 0 12px' }}>가입 때 선택한 항목을 관리합니다. 동의를 끄면 이후 분석에서 제외하거나 기존 라운드를 비공개로 바꿉니다. 가입 시 동의하지 않았더라도 여기서 설정을 바꿀 수 있습니다.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
          <input type="checkbox" checked={dataPreferences?.allow_anonymous_aggregate ?? false} disabled={savingPreferences} onChange={(event) => void updateDataSharingPreference('anonymous_aggregate', event.target.checked)} style={{ marginTop: 2 }} />
          <span><strong>익명 평균 분석 참여</strong><br />개별 라운드에서 익명 평균 참여를 선택한 기록만 구장·실력 그룹 비교에 사용합니다. 5명 이상 표본의 합계 평균만 표시합니다.</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
          <input type="checkbox" checked={dataPreferences?.allow_friend_sharing ?? false} disabled={savingPreferences} onChange={(event) => void updateDataSharingPreference('friend_sharing', event.target.checked)} style={{ marginTop: 2 }} />
          <span><strong>친구 비교 데이터 공유 허용</strong><br />친구로 수락한 회원에게는 내가 개별 라운드를 친구 공개로 지정한 경우에만 스코어·퍼트 평균을 제공합니다. 해제하면 친구 공개 기록을 모두 비공개로 변경합니다.</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
          <input type="checkbox" checked={dataPreferences?.allow_ai_practice_analysis ?? false} disabled={savingPreferences} onChange={(event) => void updateDataSharingPreference('ai_practice_analysis', event.target.checked)} style={{ marginTop: 2 }} />
          <span><strong>AI 연습 제안 분석</strong><br />선택 시 샷 기록 일부를 OpenAI API에 보내 연습 제안을 만듭니다. 해제하면 새 분석 요청을 보내지 않습니다.</span>
        </label>
        <AgreementDetails kind="ai" />
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
          <input type="checkbox" checked={dataPreferences?.score_guide_enabled ?? true} disabled={savingPreferences} onChange={(event) => void updateScoreGuidePreference(event.target.checked)} style={{ marginTop: 2 }} />
          <span><strong>스코어 입력 도움말 아이콘 표시 및 첫 사용 안내</strong><br />켜면 Score 탭 첫 사용 때 안내가 나오고, 입력 화면에서 물음표 아이콘으로 언제든 다시 볼 수 있습니다.</span>
        </label>
      </div>
    </section>
  )
}
